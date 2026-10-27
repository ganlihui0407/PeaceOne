import { Router } from 'express';
import { prisma } from '../db.js';
import {
  createUserSkillBodySchema,
  serializeUserSkill,
  updateUserSkillBodySchema,
  userSkillIdParamsSchema,
} from '../lib/userSkillQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const skillSelect = {
  id: true,
  sourceUri: true,
  preferredLabel: true,
  skillType: true,
  sourceSystem: true,
};

const userSkillInclude = {
  skill: { select: skillSelect },
};

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

async function findOwnedUserSkill(userId, id) {
  return prisma.userSkill.findFirst({
    where: { id, userId },
    include: userSkillInclude,
  });
}

export const userSkillsRouter = Router();

userSkillsRouter.use(requireAuth, requireRole('STUDENT', 'JOB_SEEKER'));

userSkillsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await prisma.userSkill.findMany({
      where: { userId: req.user.id },
      include: userSkillInclude,
      orderBy: [{ skill: { preferredLabel: 'asc' } }, { skill: { sourceUri: 'asc' } }],
    });
    res.status(200).json({
      items: rows.map(serializeUserSkill),
    });
  }),
);

userSkillsRouter.post(
  '/',
  validateBody(createUserSkillBodySchema),
  asyncHandler(async (req, res) => {
    const { skillId, proficiencyLevel } = req.validatedBody;
    const skill = await prisma.skill.findFirst({
      where: { id: skillId, sourceSystem: 'ESCO' },
      select: { id: true },
    });
    if (!skill) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const alreadyRecorded = await prisma.userSkill.findUnique({
      where: { userId_skillId: { userId: req.user.id, skillId: skill.id } },
      select: { id: true },
    });
    if (alreadyRecorded) {
      res.status(409).json({ error: 'Already recorded' });
      return;
    }

    try {
      const created = await prisma.userSkill.create({
        data: {
          userId: req.user.id,
          skillId: skill.id,
          proficiencyLevel,
        },
        include: userSkillInclude,
      });
      res.status(201).json({ userSkill: serializeUserSkill(created) });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        res.status(409).json({ error: 'Already recorded' });
        return;
      }
      throw error;
    }
  }),
);

userSkillsRouter.patch(
  '/:id',
  validateParams(userSkillIdParamsSchema),
  validateBody(updateUserSkillBodySchema),
  asyncHandler(async (req, res) => {
    const existing = await findOwnedUserSkill(req.user.id, req.validatedParams.id);
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const updated = await prisma.userSkill.update({
      where: { id: existing.id },
      data: { proficiencyLevel: req.validatedBody.proficiencyLevel },
      include: userSkillInclude,
    });
    res.status(200).json({ userSkill: serializeUserSkill(updated) });
  }),
);

userSkillsRouter.delete(
  '/:id',
  validateParams(userSkillIdParamsSchema),
  asyncHandler(async (req, res) => {
    const existing = await findOwnedUserSkill(req.user.id, req.validatedParams.id);
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await prisma.userSkill.delete({
      where: { id: existing.id },
    });
    res.status(200).json({ ok: true });
  }),
);
