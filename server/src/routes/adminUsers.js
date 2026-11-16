import { Router } from 'express';
import { prisma } from '../db.js';
import {
  AdminUserError,
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
  adminUserStatusBodySchema,
  findAdminUser,
  listAdminUserStats,
  listAdminUsers,
  updateAdminUserStatus,
} from '../lib/adminUserQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth, requireRole('ADMIN'));

function sendAdminUserError(res, error) {
  if (error instanceof AdminUserError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

adminUsersRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const payload = await listAdminUserStats(prisma);
    res.status(200).json(payload);
  }),
);

adminUsersRouter.get(
  '/',
  validateQuery(adminUserListQuerySchema),
  asyncHandler(async (req, res) => {
    const payload = await listAdminUsers(prisma, req.validatedQuery);
    res.status(200).json(payload);
  }),
);

adminUsersRouter.get(
  '/:id',
  validateParams(adminUserIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const user = await findAdminUser(prisma, req.validatedParams.id);
      res.status(200).json({ user });
    } catch (error) {
      if (sendAdminUserError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminUsersRouter.patch(
  '/:id/status',
  validateParams(adminUserIdParamsSchema),
  validateBody(adminUserStatusBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const user = await updateAdminUserStatus(prisma, {
        actorUserId: req.user.id,
        userId: req.validatedParams.id,
        accountStatus: req.validatedBody.accountStatus,
      });
      res.status(200).json({ user });
    } catch (error) {
      if (sendAdminUserError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
