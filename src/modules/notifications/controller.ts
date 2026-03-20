import { Request, Response } from 'express';
import { generateNotifications } from './engine';

export class NotificationController {
  async findAll(req: Request, res: Response) {
    const userId = req.user!.userId;
    const notifications = await generateNotifications(userId);
    res.json({ success: true, data: notifications });
  }

  async markRead(req: Request, res: Response) {
    // Since notifications are computed on-the-fly, marking as read is handled client-side
    res.json({ success: true });
  }

  async markAllRead(req: Request, res: Response) {
    res.json({ success: true });
  }
}
