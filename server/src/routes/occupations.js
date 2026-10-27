import { Router } from 'express';
import { prisma } from '../db.js';
import {
  occupationByUriQuerySchema,
  occupationIdParamsSchema,
  occupationListQuerySchema,
  occupationSkillsQuerySchema,
  occupationListWhere,
  paginationMeta,
  serializeOccupationDetail,
  serializeOccupationSkill,
  serializeOccupationSummary,
} from '../lib/escoQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateParams, validateQuery } from '../middleware/validate.js';

const occupationOrder = [{ preferredLabel: 'asc' }, { sourceUri: 'asc' }];
const occupationSkillOrder = [
  { relationType: 'asc' },
  { skill: { preferredLabel: 'asc' } },
  { skill: { sourceUri: 'asc' } },
];

const occupationSelect = {
  id: true,
  sourceUri: true,
  preferredLabel: true,
  sourceSystem: true,
  sourceMetadata: true,
};

export const occupationsRouter = Router();

occupationsRouter.get(
  '/',
  validateQuery(occupationListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery;
    const where = occupationListWhere(query);
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      prisma.occupation.count({ where }),
      prisma.occupation.findMany({
        where,
        orderBy: occupationOrder,
        skip,
        take: query.limit,
        select: occupationSelect,
      }),
    ]);
    res.status(200).json({
      items: rows.map(serializeOccupationSummary),
      ...paginationMeta(query.page, query.limit, total),
    });
  }),
);

occupationsRouter.get(
  '/by-uri',
  validateQuery(occupationByUriQuerySchema),
  asyncHandler(async (req, res) => {
    const occupation = await prisma.occupation.findFirst({
      where: { sourceUri: req.validatedQuery.uri, sourceSystem: 'ESCO' },
      select: occupationSelect,
    });
    if (!occupation) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json({ occupation: serializeOccupationDetail(occupation) });
  }),
);

occupationsRouter.get(
  '/:id/skills',
  validateParams(occupationIdParamsSchema),
  validateQuery(occupationSkillsQuerySchema),
  asyncHandler(async (req, res) => {
    const occupation = await prisma.occupation.findFirst({
      where: { id: req.validatedParams.id, sourceSystem: 'ESCO' },
      select: { id: true },
    });
    if (!occupation) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const query = req.validatedQuery;
    const where = {
      occupationId: occupation.id,
      sourceSystem: 'ESCO',
    };
    if (query.relationType) {
      where.relationType = query.relationType;
    }
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      prisma.occupationSkillRelation.count({ where }),
      prisma.occupationSkillRelation.findMany({
        where,
        orderBy: occupationSkillOrder,
        skip,
        take: query.limit,
        select: {
          relationType: true,
          skill: {
            select: {
              id: true,
              sourceUri: true,
              preferredLabel: true,
              skillType: true,
              sourceSystem: true,
            },
          },
        },
      }),
    ]);
    res.status(200).json({
      items: rows.map(serializeOccupationSkill),
      ...paginationMeta(query.page, query.limit, total),
    });
  }),
);

occupationsRouter.get(
  '/:id',
  validateParams(occupationIdParamsSchema),
  asyncHandler(async (req, res) => {
    const occupation = await prisma.occupation.findFirst({
      where: { id: req.validatedParams.id, sourceSystem: 'ESCO' },
      select: occupationSelect,
    });
    if (!occupation) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json({ occupation: serializeOccupationDetail(occupation) });
  }),
);
