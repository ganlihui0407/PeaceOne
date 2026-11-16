import { PROFICIENCY_LEVELS } from './userSkills.js'

export const MATCH_STATUS = {
  MATCHED: 'MATCHED',
  PROFICIENCY_GAP: 'PROFICIENCY_GAP',
  MISSING: 'MISSING',
}

export const JOB_SKILL_MATCH_UNAVAILABLE =
  'Skill matching is unavailable because this job has no recorded skill requirements.'

export const JOB_SKILL_MATCH_DISCLAIMER =
  'Skill overlap = matched required skills ÷ total required skills × 100. Matched means your recorded proficiency meets or exceeds the required level. This is a job-specific recorded-skill overlap indicator. It is not an employability probability, hiring recommendation, or AI compatibility score.'

export const JOB_SKILL_MATCH_EMPTY_CANDIDATE =
  'No ESCO skills are recorded in My Skills yet. PeaceOne compares only confirmed UserSkill records and does not infer skills from a resume.'

export const JOB_SKILL_MATCH_EMPTY_EMPLOYER =
  'This candidate has no recorded UserSkill entries yet. PeaceOne compares only confirmed UserSkill records and does not infer skills from a resume.'

export const JOB_SKILL_MATCH_EMPLOYER_INTRO =
  'PeaceOne compares the candidate’s current recorded UserSkill list with this vacancy’s required ESCO skill IDs. Job postings store required skills only; there is no optional-skill field.'

const PROFICIENCY_RANK = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
}

function skillIdOf(record) {
  const skillId = record?.skill?.id
  return typeof skillId === 'string' && skillId.length > 0 ? skillId : null
}

function proficiencyRank(level) {
  return PROFICIENCY_RANK[level] ?? null
}

function uniqueRequiredSkills(requiredSkills) {
  const seen = new Set()
  const unique = []
  for (const item of Array.isArray(requiredSkills) ? requiredSkills : []) {
    const skillId = skillIdOf(item)
    if (!skillId || seen.has(skillId)) {
      continue
    }
    if (!PROFICIENCY_LEVELS.includes(item.requiredLevel)) {
      continue
    }
    seen.add(skillId)
    unique.push(item)
  }
  return unique
}

function candidateBySkillId(candidateSkills) {
  const map = new Map()
  for (const item of Array.isArray(candidateSkills) ? candidateSkills : []) {
    const skillId = skillIdOf(item)
    const rank = proficiencyRank(item?.proficiencyLevel)
    if (!skillId || rank == null) {
      continue
    }
    const existing = map.get(skillId)
    if (!existing || proficiencyRank(existing.proficiencyLevel) < rank) {
      map.set(skillId, item)
    }
  }
  return map
}

function comparisonRow(required, candidateLevel, status) {
  return {
    skillId: required.skill.id,
    preferredLabel: required.skill.preferredLabel,
    requiredLevel: required.requiredLevel,
    candidateLevel,
    status,
  }
}

export function canComputeJobSkillOverlap(candidateSkills) {
  return Array.isArray(candidateSkills)
}

export function matchStatusLabel(status) {
  if (status === MATCH_STATUS.MATCHED) {
    return 'Matched'
  }
  if (status === MATCH_STATUS.PROFICIENCY_GAP) {
    return 'Proficiency gap'
  }
  if (status === MATCH_STATUS.MISSING) {
    return 'Not recorded'
  }
  return status
}

export function matchStatusTone(status) {
  if (status === MATCH_STATUS.MATCHED) {
    return 'success'
  }
  if (status === MATCH_STATUS.PROFICIENCY_GAP) {
    return 'warning'
  }
  if (status === MATCH_STATUS.MISSING) {
    return 'danger'
  }
  return 'default'
}

export function proficiencyGapExplanation(candidateLevel, requiredLevel, audience = 'candidate') {
  if (audience === 'employer') {
    return `The candidate’s recorded proficiency is ${candidateLevel}. This vacancy requires ${requiredLevel}. PeaceOne does not change recorded levels.`
  }
  return `Your recorded proficiency is ${candidateLevel}. This vacancy requires ${requiredLevel}. PeaceOne does not change your recorded level.`
}

export function missingSkillExplanation(audience = 'candidate') {
  if (audience === 'employer') {
    return 'This skill has not been recorded on the candidate’s UserSkill list. PeaceOne does not infer it from a resume.'
  }
  return 'This skill has not been recorded in My Skills. PeaceOne does not infer it from a resume.'
}

export function formatRecordedSkillOverlap(percent) {
  if (!Number.isInteger(percent)) {
    return null
  }
  return `Recorded-skill overlap: ${percent}%`
}

export function candidateSkillsPath(basePath) {
  return `${basePath}/skills`
}

export function candidateSkillGapPath(basePath) {
  return `${basePath}/skill-gap`
}

export function compareJobSkillOverlap(requiredSkills, candidateSkills) {
  // Vacancy overlap uses JobSkill ESCO IDs and the same UserSkill profile as skill gap.
  // It does not use OccupationSkillRelation. The overlap percent formula is unchanged.
  const uniqueRequired = uniqueRequiredSkills(requiredSkills)
  if (uniqueRequired.length === 0) {
    return {
      available: false,
      message: JOB_SKILL_MATCH_UNAVAILABLE,
      totalRequired: 0,
      matchedCount: 0,
      proficiencyGapCount: 0,
      missingCount: 0,
      overlapPercent: null,
      matched: [],
      proficiencyGaps: [],
      missing: [],
    }
  }

  const candidateMap = candidateBySkillId(candidateSkills)
  const matched = []
  const proficiencyGaps = []
  const missing = []

  for (const required of uniqueRequired) {
    const candidate = candidateMap.get(required.skill.id)
    if (!candidate) {
      missing.push(comparisonRow(required, null, MATCH_STATUS.MISSING))
      continue
    }
    const requiredRank = proficiencyRank(required.requiredLevel)
    const candidateRank = proficiencyRank(candidate.proficiencyLevel)
    if (candidateRank >= requiredRank) {
      matched.push(comparisonRow(required, candidate.proficiencyLevel, MATCH_STATUS.MATCHED))
    } else {
      proficiencyGaps.push(
        comparisonRow(required, candidate.proficiencyLevel, MATCH_STATUS.PROFICIENCY_GAP),
      )
    }
  }

  const totalRequired = uniqueRequired.length
  return {
    available: true,
    message: null,
    totalRequired,
    matchedCount: matched.length,
    proficiencyGapCount: proficiencyGaps.length,
    missingCount: missing.length,
    overlapPercent: Math.round((matched.length / totalRequired) * 100),
    matched,
    proficiencyGaps,
    missing,
  }
}
