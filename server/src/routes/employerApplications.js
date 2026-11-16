import { Router } from 'express';
import { prisma } from '../db.js';
import {
  ApplicationError,
  applicationIdParamsSchema,
  employerApplicationActionBodySchema,
  employerApplicationListQuerySchema,
  findCompanyApplication,
  listCompanyApplicationStats,
  listCompanyApplications,
  sendCompanyApplicationOriginal,
  sendCompanyApplicationPdf,
  transitionCompanyApplication,
} from '../lib/applicationQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const employerApplicationsRouter = Router();

employerApplicationsRouter.use(requireAuth, requireRole('COMPANY_STAFF'));

function sendApplicationError(res, error) {
  if (error instanceof ApplicationError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

function handleTransition(action) {
  return asyncHandler(async (req, res) => {
    try {
      const application = await transitionCompanyApplication(
        prisma,
        req.user.id,
        req.validatedParams.id,
        action,
        req.validatedBody,
      );
      res.status(200).json({ application });
    } catch (error) {
      if (sendApplicationError(res, error)) {
        return;
      }
      throw error;
    }
  });
}

employerApplicationsRouter.get(
  '/',
  validateQuery(employerApplicationListQuerySchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await listCompanyApplications(prisma, req.user.id, req.validatedQuery);
      res.status(200).json(payload);
    } catch (error) {
      if (sendApplicationError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerApplicationsRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    try {
      const payload = await listCompanyApplicationStats(prisma, req.user.id);
      res.status(200).json(payload);
    } catch (error) {
      if (sendApplicationError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerApplicationsRouter.get(
  '/:id/resume.pdf',
  validateParams(applicationIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      await sendCompanyApplicationPdf(prisma, req.user.id, req.validatedParams.id, res);
    } catch (error) {
      if (sendApplicationError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerApplicationsRouter.get(
  '/:id/resume.original',
  validateParams(applicationIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      await sendCompanyApplicationOriginal(prisma, req.user.id, req.validatedParams.id, res);
    } catch (error) {
      if (sendApplicationError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerApplicationsRouter.post(
  '/:id/review',
  validateParams(applicationIdParamsSchema),
  validateBody(employerApplicationActionBodySchema),
  handleTransition('review'),
);

employerApplicationsRouter.post(
  '/:id/shortlist',
  validateParams(applicationIdParamsSchema),
  validateBody(employerApplicationActionBodySchema),
  handleTransition('shortlist'),
);

employerApplicationsRouter.post(
  '/:id/reject',
  validateParams(applicationIdParamsSchema),
  validateBody(employerApplicationActionBodySchema),
  handleTransition('reject'),
);

employerApplicationsRouter.post(
  '/:id/offer',
  validateParams(applicationIdParamsSchema),
  validateBody(employerApplicationActionBodySchema),
  handleTransition('offer'),
);

employerApplicationsRouter.get(
  '/:id',
  validateParams(applicationIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const application = await findCompanyApplication(
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
