import { Router } from 'express';
import { prisma } from '../db.js';
import {
  ApplicationError,
  submitApplicationBodySchema,
  submitOwnedApplication,
} from '../lib/applicationQuery.js';
import {
  JobError,
  candidateJobListQuerySchema,
  findCandidateJob,
  jobIdParamsSchema,
  listCandidateJobs,
} from '../lib/jobQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const jobsRouter = Router();

function sendJobError(res, error) {
  if (error instanceof JobError || error instanceof ApplicationError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

jobsRouter.get(
  '/',
  validateQuery(candidateJobListQuerySchema),
  asyncHandler(async (req, res) => {
    const payload = await listCandidateJobs(prisma, req.validatedQuery);
    res.status(200).json(payload);
  }),
);

jobsRouter.get(
  '/:id',
  validateParams(jobIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const job = await findCandidateJob(prisma, req.validatedParams.id);
      res.status(200).json({ job });
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

jobsRouter.post(
  '/:id/applications',
  requireAuth,
  requireRole('STUDENT', 'JOB_SEEKER'),
  validateParams(jobIdParamsSchema),
  validateBody(submitApplicationBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const application = await submitOwnedApplication(
        prisma,
        req.user.id,
        req.validatedParams.id,
        req.validatedBody.resumeId,
      );
      res.status(201).json({ application });
    } catch (error) {
      if (sendJobError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
