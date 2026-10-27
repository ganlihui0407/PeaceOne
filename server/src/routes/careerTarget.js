import { Router } from 'express';
import { prisma } from '../db.js';
import {
  careerTargetOccupationSelect,
  serializeCareerTarget,
  updateCareerTargetBodySchema,
} from '../lib/careerTargetQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';

export const careerTargetRouter = Router();

careerTargetRouter.use(requireAuth, requireRole('STUDENT', 'JOB_SEEKER'));

async function loadOwnedTarget(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      targetOccupation: { select: careerTargetOccupationSelect },
    },
  });
  return user?.targetOccupation ?? null;
}

careerTargetRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const occupation = await loadOwnedTarget(req.user.id);
    res.status(200).json(serializeCareerTarget(occupation));
  }),
);

careerTargetRouter.put(
  '/',
  validateBody(updateCareerTargetBodySchema),
  asyncHandler(async (req, res) => {
    const occupation = await prisma.occupation.findFirst({
      where: { id: req.validatedBody.occupationId, sourceSystem: 'ESCO' },
      select: careerTargetOccupationSelect,
    });
    if (!occupation) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { targetOccupationId: occupation.id },
    });
    res.status(200).json(serializeCareerTarget(occupation));
  }),
);

careerTargetRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { targetOccupationId: null },
    });
    res.status(200).json({ occupation: null });
  }),
);
