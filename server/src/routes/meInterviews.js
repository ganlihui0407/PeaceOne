import { Router } from 'express';
import { prisma } from '../db.js';
import {
  InterviewError,
  acceptOwnedInterview,
  declineInterviewBodySchema,
  declineOwnedInterview,
  emptyInterviewBodySchema,
  findOwnedInterview,
  interviewIdParamsSchema,
  interviewListQuerySchema,
  listOwnedInterviews,
  rescheduleInterviewBodySchema,
  rescheduleOwnedInterview,
} from '../lib/interviewQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const meInterviewsRouter = Router();

meInterviewsRouter.use(requireAuth, requireRole('STUDENT', 'JOB_SEEKER'));

function sendInterviewError(res, error) {
  if (error instanceof InterviewError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

meInterviewsRouter.get(
  '/',
  validateQuery(interviewListQuerySchema),
  asyncHandler(async (req, res) => {
    const payload = await listOwnedInterviews(prisma, req.user.id, req.validatedQuery);
    res.status(200).json(payload);
  }),
);

meInterviewsRouter.get(
  '/:id',
  validateParams(interviewIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const interview = await findOwnedInterview(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json({ interview });
    } catch (error) {
      if (sendInterviewError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meInterviewsRouter.post(
  '/:id/accept',
  validateParams(interviewIdParamsSchema),
  validateBody(emptyInterviewBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const interview = await acceptOwnedInterview(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json({ interview });
    } catch (error) {
      if (sendInterviewError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meInterviewsRouter.post(
  '/:id/decline',
  validateParams(interviewIdParamsSchema),
  validateBody(declineInterviewBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const interview = await declineOwnedInterview(
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

meInterviewsRouter.post(
  '/:id/reschedule',
  validateParams(interviewIdParamsSchema),
  validateBody(rescheduleInterviewBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const interview = await rescheduleOwnedInterview(
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
