import { Request, Response } from 'express';
import { generateNotifications } from './engine';
import { Notification } from './model';

export class NotificationController {
  async findAll(req: Request, res: Response) {
    const userId = req.user!.userId;
    const notifications = await generateNotifications(userId);
    res.json({ success: true, data: notifications });
  }

  async markRead(req: Request, res: Response) {
    const userId = req.user!.userId;
    const notificationId = req.params.id;
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { isRead: true } },
      { new: true }
    ).lean();
    res.json({ success: true, data: notification });
  }

  async markAllRead(req: Request, res: Response) {
    const userId = req.user!.userId;
    await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  }
}
