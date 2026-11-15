import { Router } from 'express';
import { prisma } from '../db.js';
import {
  JobError,
  adminCloseJobBodySchema,
  adminJobListQuerySchema,
  adminSuspendJobBodySchema,
  closeAdminJob,
  findAdminJob,
  jobIdParamsSchema,
  listAdminJobs,
  suspendAdminJob,
} from '../lib/jobQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const adminJobsRouter = Router();

adminJobsRouter.use(requireAuth, requireRole('ADMIN'));

function sendJobError(res, error) {
  if (error instanceof JobError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

adminJobsRouter.get(
  '/',
  validateQuery(adminJobListQuerySchema),
  asyncHandler(async (req, res) => {
    const payload = await listAdminJobs(prisma, req.validatedQuery);
    res.status(200).json(payload);
  }),
);

adminJobsRouter.get(
  '/:id',
  validateParams(jobIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const job = await findAdminJob(prisma, req.validatedParams.id);
      res.status(200).json({ job });
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminJobsRouter.post(
  '/:id/suspend',
  validateParams(jobIdParamsSchema),
  validateBody(adminSuspendJobBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const job = await suspendAdminJob(prisma, {
        jobId: req.validatedParams.id,
        actorUserId: req.user.id,
        reason: req.validatedBody.reason,
      });
      res.status(200).json({ job });
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminJobsRouter.post(
  '/:id/close',
  validateParams(jobIdParamsSchema),
  validateBody(adminCloseJobBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const job = await closeAdminJob(prisma, {
        jobId: req.validatedParams.id,
        actorUserId: req.user.id,
        reason: req.validatedBody.reason ?? null,
      });
      res.status(200).json({ job });
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
