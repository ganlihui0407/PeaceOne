import { Router } from 'express';
import { prisma } from '../db.js';
import {
  paginationMeta,
  serializeSkillSummary,
  skillListQuerySchema,
  skillListWhere,
} from '../lib/escoQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateQuery } from '../middleware/validate.js';

const skillOrder = [{ preferredLabel: 'asc' }, { sourceUri: 'asc' }];

export const skillsRouter = Router();

skillsRouter.get(
  '/',
  validateQuery(skillListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery;
    const where = skillListWhere(query);
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      prisma.skill.count({ where }),
      prisma.skill.findMany({
        where,
        orderBy: skillOrder,
        skip,
        take: query.limit,
        select: {
          id: true,
          sourceUri: true,
          preferredLabel: true,
          skillType: true,
          sourceSystem: true,
        },
      }),
    ]);
    res.status(200).json({
      items: rows.map(serializeSkillSummary),
      ...paginationMeta(query.page, query.limit, total),
    });
  }),
);
