import { Router } from 'express';
import { prisma } from '../db.js';
import {
  JobError,
  closeOwnedJob,
  createJobBodySchema,
  createOwnedJob,
  deleteOwnedJob,
  emptyJobBodySchema,
  findOwnedJob,
  jobIdParamsSchema,
  listOwnedJobs,
  publishOwnedJob,
  staffJobListQuerySchema,
  updateJobBodySchema,
  updateOwnedJob,
} from '../lib/jobQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const meJobsRouter = Router();

meJobsRouter.use(requireAuth, requireRole('COMPANY_STAFF'));

function sendJobError(res, error) {
  if (error instanceof JobError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

meJobsRouter.get(
  '/',
  validateQuery(staffJobListQuerySchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await listOwnedJobs(prisma, req.user.id, req.validatedQuery);
      res.status(200).json(payload);
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meJobsRouter.post(
  '/',
  validateBody(createJobBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const job = await createOwnedJob(prisma, req.user.id, req.validatedBody);
      res.status(201).json({ job });
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meJobsRouter.get(
  '/:id',
  validateParams(jobIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const job = await findOwnedJob(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json({ job });
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meJobsRouter.patch(
  '/:id',
  validateParams(jobIdParamsSchema),
  validateBody(updateJobBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const job = await updateOwnedJob(prisma, req.user.id, req.validatedParams.id, req.validatedBody);
      res.status(200).json({ job });
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meJobsRouter.post(
  '/:id/submit',
  validateParams(jobIdParamsSchema),
  validateBody(emptyJobBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const job = await publishOwnedJob(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json({ job });
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meJobsRouter.post(
  '/:id/close',
  validateParams(jobIdParamsSchema),
  validateBody(emptyJobBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const job = await closeOwnedJob(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json({ job });
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meJobsRouter.delete(
  '/:id',
  validateParams(jobIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const result = await deleteOwnedJob(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json(result);
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
