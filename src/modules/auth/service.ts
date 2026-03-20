import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User, IUser } from '../users/model';
import { env } from '../../common/config/env';
import { AppError } from '../../common/utils/AppError';
import { RegisterInput, LoginInput } from './validation';

function generateAccessToken(userId: string): string {
  const opts: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as any };
  return jwt.sign({ userId }, env.JWT_SECRET, opts);
}

function generateRefreshToken(userId: string): string {
  const opts: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any };
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, opts);
}

export class AuthService {
  async register(input: RegisterInput) {
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

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    user.refreshToken = refreshToken;
    await user.save();

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput) {
    const user = await User.findOne({ email: input.email }).select('+password +refreshToken');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    user.refreshToken = refreshToken;
    await user.save();

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    let payload: { userId: string };
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }

    const user = await User.findById(payload.userId).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 401);
    }

    const newAccessToken = generateAccessToken(user._id.toString());
    const newRefreshToken = generateRefreshToken(user._id.toString());

    user.refreshToken = newRefreshToken;
    await user.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string) {
    await User.findByIdAndUpdate(userId, { refreshToken: null });
  }
}
