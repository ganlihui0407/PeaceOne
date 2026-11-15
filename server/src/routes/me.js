import { Router } from 'express';
import { prisma } from '../db.js';
import {
  hasDisallowedMeProfileFields,
  meProfileSelect,
  meProfileUpdateData,
  serializeMeProfile,
  updateMeProfileBodySchema,
} from '../lib/meProfileQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';

export const meRouter = Router();

meRouter.use(requireAuth);

async function loadOwnProfile(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: meProfileSelect,
  });
}

meRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await loadOwnProfile(req.user.id);
    if (!user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    res.status(200).json({ user: serializeMeProfile(user) });
  }),
);

meRouter.patch(
  '/',
  validateBody(updateMeProfileBodySchema),
  asyncHandler(async (req, res) => {
    if (hasDisallowedMeProfileFields(req.user.role, req.validatedBody)) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: meProfileUpdateData(req.validatedBody),
      select: meProfileSelect,
    });

    res.status(200).json({ user: serializeMeProfile(user) });
  }),
);
