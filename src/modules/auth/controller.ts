import { Request, Response } from 'express';
import { AuthService } from './service';
import { HttpStatus } from '../../common/constants/httpStatus';
import { logger } from '../../common/utils/logger';

const authService = new AuthService();

function requestMeta(req: Request) {
  return {
    userAgent: req.get('user-agent') || '',
    ipAddress: req.ip || req.socket.remoteAddress || '',
  };
}

export class AuthController {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body, requestMeta(req));
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  }

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body, requestMeta(req));
    logger.info(`User logged in successfully: ${result.user.email}`);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }

  async refresh(req: Request, res: Response) {
    const result = await authService.refresh(req.body.refreshToken, requestMeta(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }

  async logout(req: Request, res: Response) {
    await authService.logout(req.user!.userId, req.body?.refreshToken);
    res.status(HttpStatus.OK).json({ success: true, message: 'Logged out' });
  }

  async forgotPassword(req: Request, res: Response) {
    const result = await authService.requestPasswordReset(req.body.email);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }

  async resetPassword(req: Request, res: Response) {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }
}
