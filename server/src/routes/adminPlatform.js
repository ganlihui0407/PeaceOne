import { Router } from 'express';
import { prisma } from '../db.js';
import {
  listAdminContentMonitoring,
  listAdminPlatformStats,
  listAdminReports,
} from '../lib/adminPlatformQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';

export const adminStatsRouter = Router();
adminStatsRouter.use(requireAuth, requireRole('ADMIN'));
adminStatsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const payload = await listAdminPlatformStats(prisma);
    res.status(200).json(payload);
  }),
);

export const adminReportsRouter = Router();
adminReportsRouter.use(requireAuth, requireRole('ADMIN'));
adminReportsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const payload = await listAdminReports(prisma);
    res.status(200).json(payload);
  }),
);

export const adminContentMonitoringRouter = Router();
adminContentMonitoringRouter.use(requireAuth, requireRole('ADMIN'));
adminContentMonitoringRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const payload = await listAdminContentMonitoring(prisma);
    res.status(200).json(payload);
  }),
);
