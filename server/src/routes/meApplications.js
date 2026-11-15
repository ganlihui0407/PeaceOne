import { Router } from 'express';
import { prisma } from '../db.js';
import {
  ApplicationError,
  applicationIdParamsSchema,
  candidateApplicationListQuerySchema,
  emptyApplicationBodySchema,
  findOwnedApplication,
  listOwnedApplications,
  sendOwnedApplicationPdf,
  withdrawOwnedApplication,
} from '../lib/applicationQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const meApplicationsRouter = Router();

meApplicationsRouter.use(requireAuth, requireRole('STUDENT', 'JOB_SEEKER'));

function sendApplicationError(res, error) {
  if (error instanceof ApplicationError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

meApplicationsRouter.get(
  '/',
  validateQuery(candidateApplicationListQuerySchema),
  asyncHandler(async (req, res) => {
    const payload = await listOwnedApplications(prisma, req.user.id, req.validatedQuery);
    res.status(200).json(payload);
  }),
);

meApplicationsRouter.get(
  '/:id/resume.pdf',
  validateParams(applicationIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      await sendOwnedApplicationPdf(prisma, req.user.id, req.validatedParams.id, res);
    } catch (error) {
      if (sendApplicationError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meApplicationsRouter.get(
  '/:id',
  validateParams(applicationIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const application = await findOwnedApplication(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json({ application });
    } catch (error) {
      if (sendApplicationError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meApplicationsRouter.post(
  '/:id/withdraw',
  validateParams(applicationIdParamsSchema),
  validateBody(emptyApplicationBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const application = await withdrawOwnedApplication(
        prisma,
        req.user.id,
        req.validatedParams.id,
      );
      res.status(200).json({ application });
    } catch (error) {
      if (sendApplicationError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
