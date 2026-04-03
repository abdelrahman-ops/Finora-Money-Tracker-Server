import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { User, IUser, IRefreshSession } from '../users/model';
import { env } from '../../common/config/env';
import { AppError } from '../../common/utils/AppError';
import { RegisterInput, LoginInput } from './validation';
import { sendPasswordResetEmail } from '../../common/utils/mailer';
import { logger } from '../../common/utils/logger';

export interface AuthRequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

interface AccessTokenPayload {
  userId: string;
  tokenVersion: number;
}

interface RefreshTokenPayload extends AccessTokenPayload {
  sessionId: string;
  jti: string;
  type: 'refresh';
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function getTokenExpiryDate(token: string): Date {
  const decoded = jwt.decode(token) as JwtPayload | null;
  if (!decoded?.exp) {
    throw new AppError('Failed to compute refresh token expiry', 500);
  }
  return new Date(decoded.exp * 1000);
}

function generateAccessToken(userId: string, tokenVersion: number): string {
  const opts: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as any };
  return jwt.sign({ userId, tokenVersion }, env.JWT_SECRET, opts);
}

function generateRefreshToken(payload: RefreshTokenPayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, opts);
}

function verifyRefreshToken(rawToken: string): RefreshTokenPayload {
  try {
    return jwt.verify(rawToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }
}

export class AuthService {
  private trimRefreshSessions(user: IUser): void {
    if (!user.refreshSessions || user.refreshSessions.length <= env.MAX_REFRESH_SESSIONS) {
      return;
    }

    const sorted = [...user.refreshSessions].sort(
      (a, b) => new Date(b.lastRotatedAt).getTime() - new Date(a.lastRotatedAt).getTime(),
    );
    user.refreshSessions = sorted.slice(0, env.MAX_REFRESH_SESSIONS) as any;
  }

  private issueNewSessionTokens(user: IUser, meta: AuthRequestMeta): {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  } {
    const sessionId = randomUUID();
    const accessToken = generateAccessToken(user._id.toString(), user.tokenVersion);
    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      tokenVersion: user.tokenVersion,
      sessionId,
      jti: randomUUID(),
      type: 'refresh',
    });

    const session: IRefreshSession = {
      sessionId,
      tokenHash: hashToken(refreshToken),
      createdAt: new Date(),
      expiresAt: getTokenExpiryDate(refreshToken),
      lastRotatedAt: new Date(),
      userAgent: meta.userAgent || '',
      ipAddress: meta.ipAddress || '',
    };

    user.refreshSessions = [...(user.refreshSessions || []), session] as any;
    this.trimRefreshSessions(user);

    return {
      accessToken,
      refreshToken,
      sessionId,
    };
  }

  private async revokeAllSessions(user: IUser, reason?: string): Promise<void> {
    user.refreshSessions = [] as any;
    user.tokenVersion += 1;
    await user.save();

    if (reason) {
      logger.warn(`Auth sessions revoked for user ${user._id.toString()}: ${reason}`);
    }
  }

  async register(input: RegisterInput, meta: AuthRequestMeta = {}) {
    const existing = await User.findOne({ email: input.email }).lean();
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(input.password, salt);

    const user = await User.create({
      email: input.email,
      password: hashedPassword,
      name: input.name,
      currency: input.currency || 'EGP',
    });

    const { accessToken, refreshToken } = this.issueNewSessionTokens(user, meta);
    await user.save();

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput, meta: AuthRequestMeta = {}) {
    const user = await User.findOne({ email: input.email }).select('+password +refreshSessions +tokenVersion');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const { accessToken, refreshToken } = this.issueNewSessionTokens(user, meta);
    await user.save();

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string, meta: AuthRequestMeta = {}) {
    const payload = verifyRefreshToken(refreshToken);

    const user = await User.findById(payload.userId).select('+refreshSessions +tokenVersion');
    if (!user) {
      throw new AppError('Invalid refresh token', 401);
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new AppError('Invalid refresh token', 401);
    }

    const session = user.refreshSessions.find((s) => s.sessionId === payload.sessionId);
    if (!session) {
      throw new AppError('Invalid refresh token', 401);
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      user.refreshSessions = user.refreshSessions.filter((s) => s.sessionId !== payload.sessionId) as any;
      await user.save();
      throw new AppError('Refresh token expired. Please sign in again.', 401);
    }

    const incomingHash = hashToken(refreshToken);
    if (session.tokenHash !== incomingHash) {
      await this.revokeAllSessions(user, 'Refresh token reuse detected');
      throw new AppError('Session security check failed. Please sign in again.', 401);
    }

    const newAccessToken = generateAccessToken(user._id.toString(), user.tokenVersion);
    const newRefreshToken = generateRefreshToken({
      userId: user._id.toString(),
      tokenVersion: user.tokenVersion,
      sessionId: session.sessionId,
      jti: randomUUID(),
      type: 'refresh',
    });

    session.tokenHash = hashToken(newRefreshToken);
    session.expiresAt = getTokenExpiryDate(newRefreshToken);
    session.lastRotatedAt = new Date();
    if (meta.userAgent) session.userAgent = meta.userAgent;
    if (meta.ipAddress) session.ipAddress = meta.ipAddress;

    this.trimRefreshSessions(user);
    await user.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string, refreshToken?: string) {
    const user = await User.findById(userId).select('+refreshSessions');
    if (!user) return;

    if (!refreshToken) {
      user.refreshSessions = [] as any;
      await user.save();
      return;
    }

    const decoded = jwt.decode(refreshToken) as Partial<RefreshTokenPayload> | null;
    if (!decoded?.sessionId || decoded.userId !== userId) {
      user.refreshSessions = [] as any;
      await user.save();
      return;
    }

    user.refreshSessions = user.refreshSessions.filter((s) => s.sessionId !== decoded.sessionId) as any;
    await user.save();
  }

  async requestPasswordReset(email: string) {
    const message = 'If the email exists, a password reset link has been sent.';

    const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpiresAt');
    if (!user) {
      return { message };
    }

    const rawResetToken = randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hashToken(rawResetToken);
    user.passwordResetExpiresAt = new Date(
      Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000,
    );
    await user.save();

    const resetUrl = `${env.APP_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawResetToken)}`;

    let emailSent = false;
    try {
      emailSent = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (err) {
      logger.error('Failed to send password reset email:', err);
    }

    if (!emailSent && env.NODE_ENV !== 'production') {
      return {
        message,
        debugResetToken: rawResetToken,
        debugResetUrl: resetUrl,
      };
    }

    return { message };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = hashToken(rawToken);

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+password +passwordResetTokenHash +passwordResetExpiresAt +refreshSessions +tokenVersion');

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;

    await this.revokeAllSessions(user, 'Password reset completed');

    return {
      message: 'Password reset successful. Please sign in again.',
    };
  }
}
