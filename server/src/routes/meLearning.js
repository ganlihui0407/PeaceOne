import { Router } from 'express';
import { prisma } from '../db.js';
import {
  LearningError,
  assessmentAttemptBodySchema,
  completeOwnLesson,
  emptyLearningBodySchema,
  enrollBodySchema,
  enrollInCourse,
  findOwnAssessment,
  findOwnLesson,
  learningIdParamsSchema,
  listOwnEnrollments,
  listOwnHistory,
  recommendCourses,
  submitOwnAttempt,
} from '../lib/learningQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams } from '../middleware/validate.js';

export const meLearningRouter = Router();

meLearningRouter.use(requireAuth, requireRole('STUDENT', 'JOB_SEEKER'));

function sendLearningError(res, error) {
  if (error instanceof LearningError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

meLearningRouter.get(
  '/recommendations',
  asyncHandler(async (req, res) => {
    const payload = await recommendCourses(prisma, req.user.id);
    res.status(200).json(payload);
  }),
);

meLearningRouter.get(
  '/enrollments',
  asyncHandler(async (req, res) => {
    const payload = await listOwnEnrollments(prisma, req.user.id);
    res.status(200).json(payload);
  }),
);

meLearningRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const payload = await listOwnHistory(prisma, req.user.id);
    res.status(200).json(payload);
  }),
);

meLearningRouter.post(
  '/enrollments',
  validateBody(enrollBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await enrollInCourse(prisma, req.user.id, req.validatedBody.contentId);
      res.status(201).json(payload);
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meLearningRouter.get(
  '/lessons/:id',
  validateParams(learningIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await findOwnLesson(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json(payload);
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meLearningRouter.post(
  '/lessons/:id/complete',
  validateParams(learningIdParamsSchema),
  validateBody(emptyLearningBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await completeOwnLesson(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json(payload);
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meLearningRouter.get(
  '/assessments/:id',
  validateParams(learningIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await findOwnAssessment(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json(payload);
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meLearningRouter.post(
  '/assessments/:id/attempts',
  validateParams(learningIdParamsSchema),
  validateBody(assessmentAttemptBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await submitOwnAttempt(
        prisma,
        req.user.id,
        req.validatedParams.id,
        req.validatedBody.answers,
      );
      res.status(201).json(payload);
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
