import { Request, Response } from 'express';
import { TransactionService } from './service';
import { HttpStatus } from '../../common/constants/httpStatus';

const txnService = new TransactionService();

export class TransactionController {
  async findAll(req: Request, res: Response) {
    const result = await txnService.findAll(req.user!.userId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      accountId: req.query.accountId as string,
      type: req.query.type as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json({ success: true, data: result });
  }

  async findById(req: Request, res: Response) {
    const txn = await txnService.findById(req.user!.userId, String(req.params.id));
    res.json({ success: true, data: txn });
  }

  async create(req: Request, res: Response) {
    const result = await txnService.create(req.user!.userId, req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  }

  async update(req: Request, res: Response) {
    const txn = await txnService.update(req.user!.userId, String(req.params.id), req.body);
    res.json({ success: true, data: txn });
  }

  async delete(req: Request, res: Response) {
    await txnService.delete(req.user!.userId, String(req.params.id));
    res.status(HttpStatus.NO_CONTENT).send();
  }
}
