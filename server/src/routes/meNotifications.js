import { Router } from 'express';
import { prisma } from '../db.js';
import {
  NotificationError,
  countOwnedUnreadNotifications,
  emptyNotificationBodySchema,
  listOwnedNotifications,
  markAllOwnedNotificationsRead,
  markOwnedNotificationRead,
  notificationIdParamsSchema,
  notificationListQuerySchema,
} from '../lib/notificationQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const meNotificationsRouter = Router();

meNotificationsRouter.use(requireAuth, requireRole('STUDENT', 'JOB_SEEKER', 'COMPANY_STAFF', 'ADMIN'));

function sendNotificationError(res, error) {
  if (error instanceof NotificationError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

meNotificationsRouter.get(
  '/',
  validateQuery(notificationListQuerySchema),
  asyncHandler(async (req, res) => {
    const payload = await listOwnedNotifications(prisma, req.user.id, req.validatedQuery);
    res.status(200).json(payload);
  }),
);

meNotificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const payload = await countOwnedUnreadNotifications(prisma, req.user.id);
    res.status(200).json(payload);
  }),
);

meNotificationsRouter.post(
  '/read-all',
  validateBody(emptyNotificationBodySchema),
  asyncHandler(async (req, res) => {
    const payload = await markAllOwnedNotificationsRead(prisma, req.user.id);
    res.status(200).json(payload);
  }),
);

meNotificationsRouter.patch(
  '/:id/read',
  validateParams(notificationIdParamsSchema),
  validateBody(emptyNotificationBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const notification = await markOwnedNotificationRead(
        prisma,
        req.user.id,
        req.validatedParams.id,
      );
      res.status(200).json({ notification });
    } catch (error) {
      if (sendNotificationError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
