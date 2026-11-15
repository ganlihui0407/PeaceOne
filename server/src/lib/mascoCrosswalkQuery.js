import { z } from 'zod';
import { prisma } from '../db.js';
import { normalizeLabelSearch, paginationMeta } from './escoQuery.js';

const MASCO_OCCUPATION_CODE_RE = /^\d{4}-\d{2}$/;
const MAPPING_STATUS_RE = /^[A-Z][A-Z0-9_]{0,99}$/;

const optionalString = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().max(200).optional(),
);

const optionalOccupationCode = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().regex(MASCO_OCCUPATION_CODE_RE).optional(),
);

const optionalMappingStatus = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().regex(MAPPING_STATUS_RE).optional(),
);

export const mascoOccupationCodeParamsSchema = z.object({
  code: z.string().regex(MASCO_OCCUPATION_CODE_RE),
});

export const mascoCrosswalkListQuerySchema = z.object({
  q: optionalString,
  historicalCode: optionalOccupationCode,
  currentCode: optionalOccupationCode,
  mappingStatus: optionalMappingStatus,
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const mascoCrosswalkSelect = {
  sourceVersion: true,
  targetVersion: true,
  historicalCode: true,
  currentCode: true,
  mappingStatus: true,
  reviewDecision: true,
  sourceMetadata: true,
};

const crosswalkOrder = [
  { historicalCode: 'asc' },
  { currentCode: 'asc' },
];

export function serializeMascoCrosswalk(record) {
  return {
    sourceVersion: record.sourceVersion,
    targetVersion: record.targetVersion,
    historicalCode: record.historicalCode,
    currentCode: record.currentCode,
    mappingStatus: record.mappingStatus,
    reviewDecision: record.reviewDecision ?? null,
    sourceMetadata: record.sourceMetadata ?? null,
  };
}

export function mascoCrosswalkListWhere(query) {
  const where = {
    sourceVersion: '2013',
    targetVersion: '2020',
  };
  const search = normalizeLabelSearch(query.q);

  if (search) {
    where.OR = [
      { historicalCode: { contains: search } },
      { currentCode: { contains: search } },
    ];
  }

  if (query.historicalCode) {
    where.historicalCode = query.historicalCode;
  }

  if (query.currentCode) {
    where.currentCode = query.currentCode;
  }

  if (query.mappingStatus) {
    where.mappingStatus = query.mappingStatus;
  }

  return where;
}

export async function findMascoOccupationByCode(code) {
  return prisma.mascoOccupationRecord.findFirst({
    where: {
      classification: 'MASCO',
      version: '2020',
      code,
    },
    select: {
      id: true,
      code: true,
      title: true,
    },
  });
}

export async function listMascoCrosswalks(where, page, limit) {
  const skip = (page - 1) * limit;
  const [total, records] = await Promise.all([
    prisma.mascoHistoricalCrosswalk.count({ where }),
    prisma.mascoHistoricalCrosswalk.findMany({
      where,
      select: mascoCrosswalkSelect,
      orderBy: crosswalkOrder,
      skip,
      take: limit,
    }),
  ]);

  return {
    items: records.map(serializeMascoCrosswalk),
    ...paginationMeta(page, limit, total),
  };
}

export async function listMascoOccupationCrosswalks(occupation) {
  const records = await prisma.mascoHistoricalCrosswalk.findMany({
    where: {
      sourceVersion: '2013',
      targetVersion: '2020',
      currentCode: occupation.code,
    },
    select: mascoCrosswalkSelect,
    orderBy: crosswalkOrder,
  });

  return records.map(serializeMascoCrosswalk);
}
