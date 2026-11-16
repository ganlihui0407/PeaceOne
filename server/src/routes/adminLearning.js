import { Router } from 'express';
import { prisma } from '../db.js';
import {
  LearningError,
  adminCourseListQuerySchema,
  archiveAdminCourse,
  createAdminAssessment,
  createAdminCourse,
  createAdminLesson,
  createAssessmentBodySchema,
  createCourseBodySchema,
  createLessonBodySchema,
  deleteAdminCourse,
  emptyLearningBodySchema,
  findAdminCourse,
  findAdminUserProgress,
  learningIdParamsSchema,
  listAdminCourseEnrollments,
  listAdminCourses,
  listAdminLearningStats,
  publishAdminCourse,
  unpublishAdminCourse,
  updateAdminAssessment,
  updateAdminCourse,
  updateAdminLesson,
  updateAssessmentBodySchema,
  updateCourseBodySchema,
  updateLessonBodySchema,
} from '../lib/learningQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const adminLearningRouter = Router();

adminLearningRouter.use(requireAuth, requireRole('ADMIN'));

function sendLearningError(res, error) {
  if (error instanceof LearningError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

adminLearningRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const payload = await listAdminLearningStats(prisma);
    res.status(200).json(payload);
  }),
);

adminLearningRouter.get(
  '/courses',
  validateQuery(adminCourseListQuerySchema),
  asyncHandler(async (req, res) => {
    const payload = await listAdminCourses(prisma, req.validatedQuery);
    res.status(200).json(payload);
  }),
);

adminLearningRouter.post(
  '/courses',
  validateBody(createCourseBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const course = await createAdminCourse(prisma, req.validatedBody);
      res.status(201).json({ course });
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.get(
  '/courses/:id',
  validateParams(learningIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await findAdminCourse(prisma, req.validatedParams.id);
      res.status(200).json(payload);
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.put(
  '/courses/:id',
  validateParams(learningIdParamsSchema),
  validateBody(updateCourseBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const course = await updateAdminCourse(prisma, req.validatedParams.id, req.validatedBody);
      res.status(200).json({ course });
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.patch(
  '/courses/:id/publish',
  validateParams(learningIdParamsSchema),
  validateBody(emptyLearningBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const course = await publishAdminCourse(prisma, req.validatedParams.id);
      res.status(200).json({ course });
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.patch(
  '/courses/:id/unpublish',
  validateParams(learningIdParamsSchema),
  validateBody(emptyLearningBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const course = await unpublishAdminCourse(prisma, req.validatedParams.id);
      res.status(200).json({ course });
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.patch(
  '/courses/:id/archive',
  validateParams(learningIdParamsSchema),
  validateBody(emptyLearningBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const course = await archiveAdminCourse(prisma, req.validatedParams.id);
      res.status(200).json({ course });
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.delete(
  '/courses/:id',
  validateParams(learningIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await deleteAdminCourse(prisma, req.validatedParams.id);
      res.status(200).json(payload);
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.post(
  '/courses/:id/lessons',
  validateParams(learningIdParamsSchema),
  validateBody(createLessonBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const lesson = await createAdminLesson(prisma, req.validatedParams.id, req.validatedBody);
      res.status(201).json({ lesson });
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.post(
  '/courses/:id/assessments',
  validateParams(learningIdParamsSchema),
  validateBody(createAssessmentBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const assessment = await createAdminAssessment(prisma, req.validatedParams.id, req.validatedBody);
      res.status(201).json({ assessment });
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.get(
  '/courses/:id/enrollments',
  validateParams(learningIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await listAdminCourseEnrollments(prisma, req.validatedParams.id);
      res.status(200).json(payload);
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.put(
  '/assessments/:id',
  validateParams(learningIdParamsSchema),
  validateBody(updateAssessmentBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const assessment = await updateAdminAssessment(prisma, req.validatedParams.id, req.validatedBody);
      res.status(200).json({ assessment });
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.put(
  '/lessons/:id',
  validateParams(learningIdParamsSchema),
  validateBody(updateLessonBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const lesson = await updateAdminLesson(prisma, req.validatedParams.id, req.validatedBody);
      res.status(200).json({ lesson });
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminLearningRouter.get(
  '/users/:id/progress',
  validateParams(learningIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const payload = await findAdminUserProgress(prisma, req.validatedParams.id);
      res.status(200).json(payload);
    } catch (error) {
      if (sendLearningError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
