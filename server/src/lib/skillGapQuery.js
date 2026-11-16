import { z } from 'zod';
import { serializeOccupationSummary, serializeSkillSummary } from './escoQuery.js';
import { USER_SKILL_PROFICIENCY_LEVELS } from './userSkillQuery.js';

export const SKILL_GAP_RELATION_LIMIT = 500;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFICIENCY_RANK = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
};

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

export const skillGapUserSkillSelect = {
  skillId: true,
  proficiencyLevel: true,
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

function proficiencyRank(level) {
  return PROFICIENCY_RANK[level] ?? 0;
}

export function indexRecordedSkills(userSkills) {
  const byId = new Map();
  const byUri = new Map();
  for (const record of Array.isArray(userSkills) ? userSkills : []) {
    const skillId = record?.skillId || record?.skill?.id;
    if (typeof skillId !== 'string' || !UUID_RE.test(skillId)) {
      continue;
    }
    if (!USER_SKILL_PROFICIENCY_LEVELS.includes(record.proficiencyLevel)) {
      continue;
    }
    const indexed = {
      skillId,
      proficiencyLevel: record.proficiencyLevel,
      skill: record.skill ?? { id: skillId },
    };
    const existing = byId.get(skillId);
    if (!existing || proficiencyRank(record.proficiencyLevel) > proficiencyRank(existing.proficiencyLevel)) {
      byId.set(skillId, indexed);
    }
    const sourceUri = indexed.skill?.sourceUri;
    if (typeof sourceUri === 'string' && sourceUri.length > 0) {
      const uriExisting = byUri.get(sourceUri);
      if (!uriExisting || proficiencyRank(record.proficiencyLevel) > proficiencyRank(uriExisting.proficiencyLevel)) {
        byUri.set(sourceUri, indexed);
      }
    }
  }
  return { byId, byUri };
}

export function findRecordedSkill(relationSkill, recorded) {
  if (!relationSkill?.id) {
    return undefined;
  }
  const byId = recorded.byId.get(relationSkill.id);
  if (byId) {
    return byId;
  }
  if (typeof relationSkill.sourceUri === 'string' && relationSkill.sourceUri.length > 0) {
    return recorded.byUri.get(relationSkill.sourceUri);
  }
  return undefined;
}

export function serializeSkillGapItem(relation, recorded) {
  const match = findRecordedSkill(relation.skill, recorded);
  const recordedFlag = match !== undefined;
  return {
    relationType: relation.relationType,
    recorded: recordedFlag,
    proficiencyLevel: recordedFlag ? match.proficiencyLevel : null,
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

export function explainSkillGapCoverage({
  occupationLabel,
  recordedSkillCount,
  matchedOccupationSkillCount,
  relationCount,
  unmatchedLabels,
}) {
  if (recordedSkillCount === 0) {
    return `No ESCO skills are recorded yet. ${relationCount} official occupation-skill link${relationCount === 1 ? '' : 's'} exist for ${occupationLabel}. PeaceOne matches exact ESCO skill identifiers, not similar words.`;
  }
  if (matchedOccupationSkillCount === 0) {
    const listed = unmatchedLabels.length > 0 ? ` Recorded but not on this occupation list: ${unmatchedLabels.join(', ')}.` : '';
    return `You have ${recordedSkillCount} recorded ESCO skill${recordedSkillCount === 1 ? '' : 's'}. None of them appear on the official occupation-skill list for ${occupationLabel} (${relationCount} linked skills).${listed} PeaceOne matches exact ESCO skill identifiers, not similar words.`;
  }
  const leftover = unmatchedLabels.length > 0
    ? ` ${unmatchedLabels.length} recorded skill${unmatchedLabels.length === 1 ? '' : 's'} ${unmatchedLabels.length === 1 ? 'is' : 'are'} not linked to this occupation: ${unmatchedLabels.join(', ')}.`
    : '';
  return `You have ${recordedSkillCount} recorded ESCO skill${recordedSkillCount === 1 ? '' : 's'}. ${matchedOccupationSkillCount} of ${relationCount} official occupation-linked skills match by ESCO identifier.${leftover} PeaceOne matches exact ESCO skill identifiers, not similar words.`;
}

export function serializeSkillGap(occupation, relations, userSkills) {
  const recorded = indexRecordedSkills(userSkills);
  const occupationSkillIds = new Set();
  const occupationUris = new Set();
  for (const relation of relations) {
    occupationSkillIds.add(relation.skill.id);
    if (relation.skill.sourceUri) {
      occupationUris.add(relation.skill.sourceUri);
    }
  }

  const items = relations.map((relation) => serializeSkillGapItem(relation, recorded));
  const unmatchedRecordedSkills = [];
  for (const record of recorded.byId.values()) {
    const onOccupation = occupationSkillIds.has(record.skillId)
      || (record.skill?.sourceUri && occupationUris.has(record.skill.sourceUri));
    if (onOccupation) {
      continue;
    }
    unmatchedRecordedSkills.push({
      proficiencyLevel: record.proficiencyLevel,
      skill: serializeSkillSummary({
        id: record.skill.id ?? record.skillId,
        sourceUri: record.skill.sourceUri ?? '',
        preferredLabel: record.skill.preferredLabel ?? 'Recorded skill',
        skillType: record.skill.skillType ?? null,
        sourceSystem: record.skill.sourceSystem ?? 'ESCO',
      }),
    });
  }
  unmatchedRecordedSkills.sort((left, right) => (
    left.skill.preferredLabel.localeCompare(right.skill.preferredLabel, 'en')
    || left.skill.sourceUri.localeCompare(right.skill.sourceUri, 'en')
  ));

  const matchedOccupationSkillCount = items.filter((item) => item.recorded).length;
  const totals = buildSkillGapTotals(items);
  return {
    occupation: serializeOccupationSummary(occupation),
    recordedSkillCount: recorded.byId.size,
    matchedOccupationSkillCount,
    unmatchedRecordedSkills,
    coverageExplanation: explainSkillGapCoverage({
      occupationLabel: occupation.preferredLabel,
      recordedSkillCount: recorded.byId.size,
      matchedOccupationSkillCount,
      relationCount: totals.relations,
      unmatchedLabels: unmatchedRecordedSkills.map((item) => item.skill.preferredLabel),
    }),
    totals,
    items,
  };
}
