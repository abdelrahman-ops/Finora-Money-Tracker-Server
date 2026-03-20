import { Event } from '../modules/events/model';
import { logger } from '../common/utils/logger';

export const EVENT_TYPES = {
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  TRANSACTION_UPDATED: 'TRANSACTION_UPDATED',
  TRANSACTION_DELETED: 'TRANSACTION_DELETED',
  BALANCE_ADJUSTED: 'BALANCE_ADJUSTED',
  BALANCE_DRIFT_FIXED: 'BALANCE_DRIFT_FIXED',
  DEBT_CREATED: 'DEBT_CREATED',
  DEBT_SETTLED: 'DEBT_SETTLED',
  DEBT_PAYMENT: 'DEBT_PAYMENT',
  SAVINGS_DEPOSIT: 'SAVINGS_DEPOSIT',
  SAVINGS_WITHDRAWAL: 'SAVINGS_WITHDRAWAL',
  SAVINGS_UPDATED: 'SAVINGS_UPDATED',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export async function logEvent(
  userId: string,
  type: EventType,
  entityType: string,
  entityId: string | null,
  payload: Record<string, any> = {},
): Promise<void> {
  try {
    await Event.create({
      userId,
      type,
      entityType,
      entityId: entityId || undefined,
      payload: JSON.parse(JSON.stringify(payload)),
    });
  } catch (err) {
    logger.error('[EventService] Failed to log event:', type, err);
  }
}

export async function getEventsForEntity(userId: string, entityType: string, entityId: string, limit = 50) {
  return Event.find({ userId, entityType, entityId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function getRecentEvents(userId: string, limit = 50) {
  return Event.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
