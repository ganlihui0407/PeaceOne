import { Router } from 'express';
import { prisma } from '../db.js';
import {
  InterviewError,
  cancelCompanyInterview,
  completeCompanyInterview,
  completeInterviewBodySchema,
  confirmCompanyInterviewReschedule,
  createCompanyInterview,
  createInterviewBodySchema,
  emptyInterviewBodySchema,
  findCompanyInterview,
  interviewIdParamsSchema,
  interviewListQuerySchema,
  listCompanyInterviewStats,
  listCompanyInterviews,
  updateCompanyInterviewSchedule,
  updateScheduleBodySchema,
} from '../lib/interviewQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const employerInterviewsRouter = Router();

employerInterviewsRouter.use(requireAuth, requireRole('COMPANY_STAFF'));

function sendInterviewError(res, error) {
  if (error instanceof InterviewError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

employerInterviewsRouter.get(
  '/',
  validateQuery(interviewListQuerySchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await listCompanyInterviews(prisma, req.user.id, req.validatedQuery);
      res.status(200).json(payload);
    } catch (error) {
      if (sendInterviewError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerInterviewsRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    try {
      const payload = await listCompanyInterviewStats(prisma, req.user.id);
      res.status(200).json(payload);
    } catch (error) {
      if (sendInterviewError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerInterviewsRouter.post(
  '/',
  validateBody(createInterviewBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const interview = await createCompanyInterview(prisma, req.user.id, req.validatedBody);
      res.status(201).json({ interview });
    } catch (error) {
      if (sendInterviewError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerInterviewsRouter.get(
  '/:id',
  validateParams(interviewIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const interview = await findCompanyInterview(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json({ interview });
    } catch (error) {
      if (sendInterviewError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerInterviewsRouter.post(
  '/:id/update-schedule',
  validateParams(interviewIdParamsSchema),
  validateBody(updateScheduleBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const interview = await updateCompanyInterviewSchedule(
        prisma,
        req.user.id,
        req.validatedParams.id,
        req.validatedBody,
      );
      res.status(200).json({ interview });
    } catch (error) {
      if (sendInterviewError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerInterviewsRouter.post(
  '/:id/confirm-reschedule',
  validateParams(interviewIdParamsSchema),
  validateBody(emptyInterviewBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const interview = await confirmCompanyInterviewReschedule(
        prisma,
        req.user.id,
        req.validatedParams.id,
      );
      res.status(200).json({ interview });
    } catch (error) {
      if (sendInterviewError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerInterviewsRouter.post(
  '/:id/cancel',
  validateParams(interviewIdParamsSchema),
  validateBody(emptyInterviewBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const interview = await cancelCompanyInterview(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json({ interview });
    } catch (error) {
      if (sendInterviewError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

employerInterviewsRouter.post(
  '/:id/complete',
  validateParams(interviewIdParamsSchema),
  validateBody(completeInterviewBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const interview = await completeCompanyInterview(
        prisma,
        req.user.id,
        req.validatedParams.id,
        req.validatedBody,
      );
      res.status(200).json({ interview });
    } catch (error) {
      if (sendInterviewError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
