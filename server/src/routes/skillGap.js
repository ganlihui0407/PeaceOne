import { Router } from 'express';
import { prisma } from '../db.js';
import {
  SKILL_GAP_RELATION_LIMIT,
  serializeSkillGap,
  skillGapOccupationSelect,
  skillGapQuerySchema,
  skillGapRelationOrder,
  skillGapRelationSelect,
  skillGapUserSkillSelect,
} from '../lib/skillGapQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateQuery } from '../middleware/validate.js';

export const skillGapRouter = Router();

skillGapRouter.use(requireAuth, requireRole('STUDENT', 'JOB_SEEKER'));

skillGapRouter.get(
  '/',
  validateQuery(skillGapQuerySchema),
  asyncHandler(async (req, res) => {
    const occupationId = req.validatedQuery.occupationId;
    const [occupation, relations, userSkills] = await Promise.all([
      prisma.occupation.findFirst({
        where: { id: occupationId, sourceSystem: 'ESCO' },
        select: skillGapOccupationSelect,
      }),
      prisma.occupationSkillRelation.findMany({
        where: { occupationId, sourceSystem: 'ESCO' },
        orderBy: skillGapRelationOrder,
        take: SKILL_GAP_RELATION_LIMIT,
        select: skillGapRelationSelect,
      }),
      prisma.userSkill.findMany({
        where: { userId: req.user.id },
        select: skillGapUserSkillSelect,
      }),
    ]);

    if (!occupation) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json(serializeSkillGap(occupation, relations, userSkills));
  }),
);
