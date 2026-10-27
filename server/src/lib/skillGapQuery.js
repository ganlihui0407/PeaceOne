import { z } from 'zod';
import { serializeOccupationSummary, serializeSkillSummary } from './escoQuery.js';

export const SKILL_GAP_RELATION_LIMIT = 500;

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

export const skillGapQuerySchema = z.object({
  occupationId: z.preprocess(singleQueryValue, z.string().regex(UUID_RE)),
});

export const skillGapOccupationSelect = {
  id: true,
  sourceUri: true,
  preferredLabel: true,
  sourceSystem: true,
  sourceMetadata: true,
};

export const skillGapRelationSelect = {
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
};

export const skillGapRelationOrder = [
  { relationType: 'asc' },
  { skill: { preferredLabel: 'asc' } },
  { skill: { sourceUri: 'asc' } },
];

export function serializeSkillGapItem(relation, recordedBySkillId) {
  const proficiencyLevel = recordedBySkillId.get(relation.skill.id);
  const recorded = proficiencyLevel !== undefined;
  return {
    relationType: relation.relationType,
    recorded,
    proficiencyLevel: recorded ? proficiencyLevel : null,
    skill: serializeSkillSummary(relation.skill),
  };
}

export function buildSkillGapTotals(items) {
  const essential = { total: 0, recorded: 0, notRecorded: 0 };
  const optional = { total: 0, recorded: 0, notRecorded: 0 };

  for (const item of items) {
    const bucket = item.relationType === 'optional' ? optional : essential;
    bucket.total += 1;
    if (item.recorded) {
      bucket.recorded += 1;
    } else {
      bucket.notRecorded += 1;
    }
  }

  return {
    relations: items.length,
    essential,
    optional,
  };
}

export function serializeSkillGap(occupation, relations, userSkills) {
  const recordedBySkillId = new Map(
    userSkills.map((record) => [record.skillId, record.proficiencyLevel]),
  );
  const items = relations.map((relation) => serializeSkillGapItem(relation, recordedBySkillId));
  return {
    occupation: serializeOccupationSummary(occupation),
    recordedSkillCount: userSkills.length,
    totals: buildSkillGapTotals(items),
    items,
  };
}
