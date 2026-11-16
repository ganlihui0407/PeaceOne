import { z } from 'zod';

export const PAGE_DEFAULT = 1;
export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 50;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function singleQueryValue(value) {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return String(value);
}

const optionalQueryString = z.preprocess(singleQueryValue, z.string().max(500).optional());

const pageQuery = z.preprocess((value) => {
  const normalized = singleQueryValue(value);
  return normalized === undefined ? String(PAGE_DEFAULT) : normalized;
}, z.string().regex(/^[1-9]\d{0,6}$/).transform((value) => Number.parseInt(value, 10)));

const limitQuery = z.preprocess((value) => {
  const normalized = singleQueryValue(value);
  return normalized === undefined ? String(LIMIT_DEFAULT) : normalized;
}, z.string().regex(/^[1-9]\d{0,2}$/).transform((value) => Number.parseInt(value, 10)).refine((value) => value <= LIMIT_MAX));

export const occupationIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

export const occupationListQuerySchema = z.object({
  q: optionalQueryString,
  page: pageQuery,
  limit: limitQuery,
  iscoGroup: z.preprocess(singleQueryValue, z.string().regex(/^[0-9]{1,8}$/).optional()),
});

export const occupationByUriQuerySchema = z.object({
  uri: z.preprocess(
    singleQueryValue,
    z.string().trim().min(1).max(500).refine((value) => /^https?:\/\//i.test(value)),
  ),
});

export const occupationSkillsQuerySchema = z.object({
  page: pageQuery,
  limit: limitQuery,
  relationType: z.preprocess(
    singleQueryValue,
    z.enum(['essential', 'optional']).optional(),
  ),
});

export const skillListQuerySchema = z.object({
  q: optionalQueryString,
  page: pageQuery,
  limit: limitQuery,
  skillType: optionalQueryString,
});

export function normalizeLabelSearch(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = value.trim().replaceAll(/[%_\\]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

export function paginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function metadataString(metadata, key) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const value = metadata[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function serializeOccupationSummary(occupation) {
  return {
    id: occupation.id,
    sourceUri: occupation.sourceUri,
    preferredLabel: occupation.preferredLabel,
    sourceSystem: occupation.sourceSystem,
    iscoGroup: metadataString(occupation.sourceMetadata, 'iscoGroup'),
  };
}

export function serializeOccupationDetail(occupation) {
  const metadata = occupation.sourceMetadata;
  return {
    ...serializeOccupationSummary(occupation),
    code: metadataString(metadata, 'code'),
    status: metadataString(metadata, 'status'),
    altLabels: metadataString(metadata, 'altLabels'),
    description: metadataString(metadata, 'description'),
    definition: metadataString(metadata, 'definition'),
    modifiedDate: metadataString(metadata, 'modifiedDate'),
  };
}

export function serializeSkillSummary(skill) {
  return {
    id: skill.id,
    sourceUri: skill.sourceUri,
    preferredLabel: skill.preferredLabel,
    skillType: skill.skillType ?? null,
    sourceSystem: skill.sourceSystem,
  };
}

export function serializeOccupationSkill(relation) {
  return {
    relationType: relation.relationType,
    skill: serializeSkillSummary(relation.skill),
  };
}

export function uriSearchVariants(search) {
  if (typeof search !== 'string' || search.length === 0) {
    return [];
  }
  const variants = new Set([search]);
  if (/^https:\/\//i.test(search)) {
    variants.add(`http://${search.slice(search.indexOf('://') + 3)}`);
  } else if (/^http:\/\//i.test(search)) {
    variants.add(`https://${search.slice(search.indexOf('://') + 3)}`);
  }
  return [...variants];
}

export function taxonomyCatalogueSearchOr(search) {
  const or = [
    { preferredLabel: { contains: search, mode: 'insensitive' } },
    {
      sourceMetadata: {
        path: ['altLabels'],
        string_contains: search,
        mode: 'insensitive',
      },
    },
  ];
  for (const variant of uriSearchVariants(search)) {
    or.push({ sourceUri: { contains: variant, mode: 'insensitive' } });
  }
  if (UUID_RE.test(search)) {
    or.push({ id: search });
  }
  return or;
}

export function occupationListWhere(query) {
  const where = { sourceSystem: 'ESCO' };
  const clauses = [];
  const search = normalizeLabelSearch(query.q);
  if (search) {
    clauses.push({ OR: taxonomyCatalogueSearchOr(search) });
  }
  if (query.iscoGroup) {
    clauses.push({
      sourceMetadata: {
        path: ['iscoGroup'],
        equals: query.iscoGroup,
      },
    });
  }
  if (clauses.length === 1) {
    Object.assign(where, clauses[0]);
  } else if (clauses.length > 1) {
    where.AND = clauses;
  }
  return where;
}

export function skillListWhere(query) {
  const where = { sourceSystem: 'ESCO' };
  const search = normalizeLabelSearch(query.q);
  if (search) {
    where.OR = taxonomyCatalogueSearchOr(search);
  }
  if (query.skillType === undefined) {
    return where;
  }
  const skillType = query.skillType.trim();
  if (skillType === 'null') {
    where.skillType = null;
  } else {
    where.skillType = skillType;
  }
  return where;
}
