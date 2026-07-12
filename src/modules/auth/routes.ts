import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../users/model';
import { env } from '../../common/config/env';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../common/utils/mailer';
import { logger } from '../../common/utils/logger';
import { AppError } from '../../common/utils/AppError';

const router = Router();

// Helper to parse cookies
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

// Helper to set HTTP-only session cookie
function setSessionCookie(res: Response, token: string): void {
  const isProd = env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `session_token=${token}; HttpOnly; ${isProd ? 'Secure;' : ''} SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  );
}

// Helper to clear session cookie
function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    'session_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );
}

/**
 * POST /register
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, currency } = req.body;

    if (!email || !password || !name) {
      return next(new AppError('Email, password, and name are required', 400));
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(new AppError('Email already registered', 400));
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      currency: currency || 'EGP',
      emailVerified: false,
    });

    // Create session JWT
    const token = jwt.sign({ userId: user._id, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });
    setSessionCookie(res, token);

    // Send verification email
    try {
      const verificationToken = jwt.sign(
        { email: user.email, callbackURL: `${env.APP_URL}/login` },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      const verifyUrl = `${env.BACKEND_URL}/api/auth/verify-email?token=${verificationToken}`;
      
      logger.info(`✉️ Sending verification link to ${user.email}: ${verifyUrl}`);
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationUrl: verifyUrl,
      });
    } catch (err) {
      logger.error('Failed to send verification email during registration:', err);
    }

    return res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        emailVerified: user.emailVerified,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /login
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Email and password are required', 400));
    }

    // Find user and select password (since select: false is on schema)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !user.password) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Create session JWT
    const token = jwt.sign({ userId: user._id, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });
    setSessionCookie(res, token);

    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        emailVerified: user.emailVerified,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /logout
 */
router.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  return res.status(200).json({ success: true });
});

/**
 * GET /session
 */
router.get('/session', async (req: Request, res: Response) => {
  try {
    let token = '';

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies.session_token || '';
    }

    if (!token) {
      return res.status(200).json({ user: null });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    if (!decoded || !decoded.userId) {
      return res.status(200).json({ user: null });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(200).json({ user: null });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        emailVerified: user.emailVerified,
        role: user.role,
      },
    });
  } catch {
    return res.status(200).json({ user: null });
  }
});

/**
 * POST /send-verification
 */
router.post('/send-verification', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, callbackURL } = req.body;

    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Generate token
    const verificationToken = jwt.sign(
      { email: user.email, callbackURL: callbackURL || `${env.APP_URL}/login` },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    const verifyUrl = `${env.BACKEND_URL}/api/auth/verify-email?token=${verificationToken}`;

    logger.info(`✉️ Sending verification link to ${user.email}: ${verifyUrl}`);
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl: verifyUrl,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /verify-email
 */
router.get('/verify-email', async (req: Request, res: Response) => {
  const token = req.query.token as string;
  let callbackURL = env.APP_URL;

  try {
    if (!token) {
      throw new Error('Verification token is missing');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { email: string; callbackURL?: string };
    if (decoded.callbackURL) {
      callbackURL = decoded.callbackURL;
    }

    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      throw new Error('User not found');
    }

    user.emailVerified = true;
    await user.save();

    logger.info(`✅ User ${user.email} verified email successfully`);
    return res.redirect(`${callbackURL}?verified=true`);
  } catch (err: any) {
    logger.error('Email verification failed:', err);
    return res.redirect(`${callbackURL}/login?verified=false&error=${encodeURIComponent(err.message || 'invalid_token')}`);
  }
});

/**
 * POST /forgot-password
 */
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, redirectTo } = req.body;

    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return success to avoid user enumeration
      return res.status(200).json({ success: true });
    }

    // Generate password reset token
    // Include current password hash in the payload so changing the password invalidates the token automatically
    const resetToken = jwt.sign(
      { userId: user._id, passwordHash: user.password },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const resetUrl = `${redirectTo || `${env.APP_URL}/reset-password`}?token=${resetToken}`;

    logger.info(`✉️ Sending password reset link to ${user.email}: ${resetUrl}`);
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /reset-password
 */
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newPassword, token } = req.body;

    if (!newPassword || !token) {
      return next(new AppError('Token and new password are required', 400));
    }

    // Decode token
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; passwordHash: string };
    if (!decoded || !decoded.userId) {
      return next(new AppError('Invalid or expired reset token', 400));
    }

    const user = await User.findById(decoded.userId).select('+password');
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Validate that the password hasn't been changed since token issuance
    if (user.password !== decoded.passwordHash) {
      return next(new AppError('This reset token has already been used or is expired', 400));
    }

    // Hash the new password and save
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    logger.info(`🔑 Password reset successfully for ${user.email}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    return next(new AppError('Invalid or expired reset token', 400));
  }
});

export default router;
