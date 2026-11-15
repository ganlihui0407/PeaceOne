import { Router } from 'express';
import { prisma } from '../db.js';
import { listAdminInterviewStats } from '../lib/interviewQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';

export const adminInterviewsRouter = Router();

adminInterviewsRouter.use(requireAuth, requireRole('ADMIN'));

adminInterviewsRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const payload = await listAdminInterviewStats(prisma);
    res.status(200).json(payload);
  }),
);
