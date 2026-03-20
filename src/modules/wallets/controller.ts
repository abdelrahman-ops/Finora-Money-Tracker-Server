import { Request, Response } from 'express';
import { WalletService } from './service';
import { HttpStatus } from '../../common/constants/httpStatus';

const walletService = new WalletService();

export class WalletController {
  async findAll(req: Request, res: Response) {
    const wallets = await walletService.findAll(req.user!.userId);
    res.json({ success: true, data: wallets });
  }

  async findById(req: Request, res: Response) {
    const wallet = await walletService.findById(req.user!.userId, String(req.params.id));
    res.json({ success: true, data: wallet });
  }

  async create(req: Request, res: Response) {
    const wallet = await walletService.create(req.user!.userId, req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: wallet });
  }

  async update(req: Request, res: Response) {
    const wallet = await walletService.update(req.user!.userId, String(req.params.id), req.body);
    res.json({ success: true, data: wallet });
  }

  async delete(req: Request, res: Response) {
    await walletService.delete(req.user!.userId, String(req.params.id));
    res.status(HttpStatus.NO_CONTENT).send();
  }
}
