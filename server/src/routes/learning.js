import { Router } from 'express';
import { prisma } from '../db.js';
import {
  LearningError,
  findPublishedCourse,
  learningIdParamsSchema,
  listPublishedCourses,
  publishedCourseListQuerySchema,
} from '../lib/learningQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { optionalAuth } from '../middleware/requireAuth.js';
import { validateParams, validateQuery } from '../middleware/validate.js';

export const learningRouter = Router();

function sendLearningError(res, error) {
  if (error instanceof LearningError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

learningRouter.get(
  '/courses',
  optionalAuth,
  validateQuery(publishedCourseListQuerySchema),
  asyncHandler(async (req, res) => {
    const payload = await listPublishedCourses(prisma, req.validatedQuery, req.user?.id);
    res.status(200).json(payload);
  }),
);

learningRouter.get(
  '/courses/:id',
  optionalAuth,
  validateParams(learningIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await findPublishedCourse(prisma, req.validatedParams.id, req.user?.id);
      res.status(200).json(payload);
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
