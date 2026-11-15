import { Router } from 'express';
import { prisma } from '../db.js';
import {
  deleteOwnedResumeFile,
  sendOwnedResumeFile,
  uploadOwnedResumeFile,
} from '../lib/resumeFileQuery.js';
import {
  confirmOwnedResumeSkills,
  confirmResumeSkillsBodySchema,
  extractOwnedResumeSkills,
  extractResumeSkillsBodySchema,
} from '../lib/resumeSkillExtractQuery.js';
import { sendOwnedResumePdf } from '../lib/resumePdfQuery.js';
import {
  ResumeError,
  createOwnedResume,
  createResumeBodySchema,
  deleteOwnedResume,
  emptyResumeBodySchema,
  findOwnedResume,
  listOwnedResumes,
  resumeIdParamsSchema,
  setOwnedPrimaryResume,
  updateOwnedResume,
  updateResumeBodySchema,
} from '../lib/resumeQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams } from '../middleware/validate.js';

export const meResumesRouter = Router();

meResumesRouter.use(requireAuth, requireRole('STUDENT', 'JOB_SEEKER'));

function sendResumeError(res, error) {
  if (error instanceof ResumeError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

meResumesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await listOwnedResumes(prisma, req.user.id);
    res.status(200).json({ items });
  }),
);

meResumesRouter.post(
  '/',
  validateBody(createResumeBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const resume = await createOwnedResume(prisma, req.user.id, req.validatedBody);
      res.status(201).json({ resume });
    } catch (error) {
      if (sendResumeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meResumesRouter.post(
  '/:id/file',
  validateParams(resumeIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const uploaded = await uploadOwnedResumeFile(prisma, req.user.id, req.validatedParams.id, req);
      res.status(uploaded.created ? 201 : 200).json({
        file: uploaded.file,
        ...(uploaded.unchanged ? { unchanged: true } : {}),
      });
    } catch (error) {
      if (sendResumeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meResumesRouter.get(
  '/:id/file',
  validateParams(resumeIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      await sendOwnedResumeFile(prisma, req.user.id, req.validatedParams.id, res);
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (sendResumeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meResumesRouter.delete(
  '/:id/file',
  validateParams(resumeIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const result = await deleteOwnedResumeFile(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json(result);
    } catch (error) {
      if (sendResumeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meResumesRouter.post(
  '/:id/extract-skills',
  validateParams(resumeIdParamsSchema),
  validateBody(extractResumeSkillsBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const result = await extractOwnedResumeSkills(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json(result);
    } catch (error) {
      if (sendResumeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meResumesRouter.post(
  '/:id/confirm-skills',
  validateParams(resumeIdParamsSchema),
  validateBody(confirmResumeSkillsBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const result = await confirmOwnedResumeSkills(
        prisma,
        req.user.id,
        req.validatedParams.id,
        req.validatedBody,
      );
      res.status(200).json(result);
    } catch (error) {
      if (sendResumeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meResumesRouter.get(
  '/:id/pdf',
  validateParams(resumeIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      await sendOwnedResumePdf(prisma, req.user.id, req.validatedParams.id, res);
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (sendResumeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meResumesRouter.get(
  '/:id',
  validateParams(resumeIdParamsSchema),
  asyncHandler(async (req, res) => {
    const resume = await findOwnedResume(prisma, req.user.id, req.validatedParams.id);
    if (!resume) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json({ resume });
  }),
);

meResumesRouter.put(
  '/:id',
  validateParams(resumeIdParamsSchema),
  validateBody(updateResumeBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const resume = await updateOwnedResume(
        prisma,
        req.user.id,
        req.validatedParams.id,
        req.validatedBody,
      );
      res.status(200).json({ resume });
    } catch (error) {
      if (sendResumeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meResumesRouter.delete(
  '/:id',
  validateParams(resumeIdParamsSchema),
  asyncHandler(async (req, res) => {
    try {
      const result = await deleteOwnedResume(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json(result);
    } catch (error) {
      if (sendResumeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

meResumesRouter.post(
  '/:id/primary',
  validateParams(resumeIdParamsSchema),
  validateBody(emptyResumeBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const resume = await setOwnedPrimaryResume(prisma, req.user.id, req.validatedParams.id);
      res.status(200).json({ resume });
    } catch (error) {
      if (sendResumeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
