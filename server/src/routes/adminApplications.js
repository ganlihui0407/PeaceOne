import { Router } from 'express';
import { prisma } from '../db.js';
import { listAdminApplicationStats } from '../lib/applicationQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';

export const adminApplicationsRouter = Router();

adminApplicationsRouter.use(requireAuth, requireRole('ADMIN'));

adminApplicationsRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const payload = await listAdminApplicationStats(prisma);
    res.status(200).json(payload);
  }),
);
