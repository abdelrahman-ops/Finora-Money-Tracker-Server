import { Request, Response } from 'express';
import { AuthService } from './service';
import { HttpStatus } from '../../common/constants/httpStatus';
import { logger } from '../../common/utils/logger';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  }

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    logger.info('User logged in successfully', result);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }

  async refresh(req: Request, res: Response) {
    const result = await authService.refresh(req.body.refreshToken);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }

  async logout(req: Request, res: Response) {
    await authService.logout(req.user!.userId);
    res.status(HttpStatus.OK).json({ success: true, message: 'Logged out' });
  }
}
