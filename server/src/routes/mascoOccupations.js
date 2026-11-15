import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateParams, validateQuery } from '../middleware/validate.js';
import {
  normalizeLabelSearch,
  paginationMeta,
} from '../lib/escoQuery.js';
import {
  findMascoOccupationByCode,
  listMascoOccupationCrosswalks,
  mascoOccupationCodeParamsSchema,
} from '../lib/mascoCrosswalkQuery.js';

export const mascoOccupationsRouter = Router();

const optionalString = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().max(200).optional(),
);

const listQuerySchema = z.object({
  q: optionalString,
  unitGroup: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().regex(/^\d{4}$/).optional(),
  ),
  scope: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.enum(['V4_EXAMPLE', 'SUPPLEMENTAL_INDEX']).optional(),
  ),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const codeParamsSchema = mascoOccupationCodeParamsSchema;

const recordSelect = {
  code: true,
  title: true,
  classification: true,
  version: true,
  recordScope: true,
  unitGroup: {
    select: {
      code: true,
      title: true,
    },
  },
};

function serializeRecord(record) {
  return {
    code: record.code,
    title: record.title,
    classification: record.classification,
    version: record.version,
    recordScope: record.recordScope,
    unitGroup: record.unitGroup,
  };
}

mascoOccupationsRouter.get(
  '/',
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery;
    const search = normalizeLabelSearch(query.q);

    const where = {
      classification: 'MASCO',
      version: '2020',
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { code: { contains: search } },
      ];
    }

    if (query.unitGroup) {
      where.unitGroup = {
        is: {
          classification: 'MASCO',
          version: '2020',
          code: query.unitGroup,
        },
      };
    }

    if (query.scope) {
      where.recordScope = query.scope;
    }

    const skip = (query.page - 1) * query.limit;

    const [total, records] = await Promise.all([
      prisma.mascoOccupationRecord.count({ where }),
      prisma.mascoOccupationRecord.findMany({
        where,
        select: recordSelect,
        orderBy: [
          { title: 'asc' },
          { code: 'asc' },
        ],
        skip,
        take: query.limit,
      }),
    ]);

    res.status(200).json({
      items: records.map(serializeRecord),
      ...paginationMeta(query.page, query.limit, total),
    });
  }),
);

mascoOccupationsRouter.get(
  '/:code/crosswalks',
  requireAuth,
  requireRole('ADMIN'),
  validateParams(codeParamsSchema),
  asyncHandler(async (req, res) => {
    const occupation = await findMascoOccupationByCode(req.validatedParams.code);
    if (!occupation) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json({
      occupation: {
        code: occupation.code,
        title: occupation.title,
      },
      items: await listMascoOccupationCrosswalks(occupation),
    });
  }),
);

mascoOccupationsRouter.get(
  '/:code',
  validateParams(codeParamsSchema),
  asyncHandler(async (req, res) => {
    const record = await prisma.mascoOccupationRecord.findFirst({
      where: {
        classification: 'MASCO',
        version: '2020',
        code: req.validatedParams.code,
      },
      select: {
        ...recordSelect,
        sourceMetadata: true,
        unitGroup: {
          select: {
            code: true,
            title: true,
            description: true,
            tasks: true,
          },
        },
      },
    });

    if (!record) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json({
      occupation: {
        ...serializeRecord(record),
        sourceMetadata: record.sourceMetadata,
      },
    });
  }),
);
