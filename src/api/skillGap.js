import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiRequest } from './client.js'
import {
  buildSearchParams,
  isAbortError,
  parseOccupationSummary,
  parseSkillSummary,
} from './esco.js'
import { PROFICIENCY_LEVELS } from './userSkills.js'

export const SKILL_GAP_UNAVAILABLE = 'Skill gap comparison is unavailable right now.'
export const SKILL_GAP_DISCLAIMER =
  'Occupation-linked coverage counts only recorded UserSkill rows whose ESCO skill identifier appears on this occupation. Not recorded means the occupation skill is not in your saved PeaceOne list. It does not mean you lack that skill. Recorded skills that are not on the occupation list are listed separately and do not inflate the occupation-linked count.'
export const SKILL_GAP_EMPTY_SKILLS = {
  title: 'No skills recorded yet.',
  description:
    'Record ESCO skills on the Skills page to compare them with an occupation. Not recorded means a skill is not in your PeaceOne list; it does not mean you lack that skill.',
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireObject(value, fallback) {
  if (!value || typeof value !== 'object') {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireInteger(value, fallback) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function parseRelationTotals(value, fallback) {
  const totals = requireObject(value, fallback)
  const total = requireInteger(totals.total, fallback)
  const recorded = requireInteger(totals.recorded, fallback)
  const notRecorded = requireInteger(totals.notRecorded, fallback)
  if (total !== recorded + notRecorded) {
    throw new ApiError(fallback, 500)
  }
  return { total, recorded, notRecorded }
}

export function parseSkillGapItem(item, fallback = SKILL_GAP_UNAVAILABLE) {
  const row = requireObject(item, fallback)
  if (row.relationType !== 'essential' && row.relationType !== 'optional') {
    throw new ApiError(fallback, 500)
  }
  if (typeof row.recorded !== 'boolean') {
    throw new ApiError(fallback, 500)
  }
  let proficiencyLevel = null
  if (row.recorded) {
    if (!PROFICIENCY_LEVELS.includes(row.proficiencyLevel)) {
      throw new ApiError(fallback, 500)
    }
    proficiencyLevel = row.proficiencyLevel
  } else if (row.proficiencyLevel != null) {
    throw new ApiError(fallback, 500)
  }
  return {
    relationType: row.relationType,
    recorded: row.recorded,
    proficiencyLevel,
    skill: parseSkillSummary(row.skill, fallback),
  }
}

function parseUnmatchedRecordedSkill(item, fallback) {
  const row = requireObject(item, fallback)
  if (!PROFICIENCY_LEVELS.includes(row.proficiencyLevel)) {
    throw new ApiError(fallback, 500)
  }
  return {
    proficiencyLevel: row.proficiencyLevel,
    skill: parseSkillSummary(row.skill, fallback),
  }
}

export function parseSkillGapResult(payload, fallback = SKILL_GAP_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  const totalsBody = requireObject(body.totals, fallback)
  const items = Array.isArray(body.items) ? body.items.map((item) => parseSkillGapItem(item, fallback)) : null
  if (!items) {
    throw new ApiError(fallback, 500)
  }
  const unmatchedRecordedSkills = Array.isArray(body.unmatchedRecordedSkills)
    ? body.unmatchedRecordedSkills.map((item) => parseUnmatchedRecordedSkill(item, fallback))
    : []
  const totals = {
    relations: requireInteger(totalsBody.relations, fallback),
    essential: parseRelationTotals(totalsBody.essential, fallback),
    optional: parseRelationTotals(totalsBody.optional, fallback),
  }
  if (totals.relations !== totals.essential.total + totals.optional.total) {
    throw new ApiError(fallback, 500)
  }
  if (totals.relations !== items.length) {
    throw new ApiError(fallback, 500)
  }
  const matchedOccupationSkillCount = Number.isInteger(body.matchedOccupationSkillCount)
    ? requireInteger(body.matchedOccupationSkillCount, fallback)
    : items.filter((item) => item.recorded).length
  const recordedSkillCount = requireInteger(body.recordedSkillCount, fallback)
  const coverageExplanation = typeof body.coverageExplanation === 'string' && body.coverageExplanation.length > 0
    ? body.coverageExplanation
    : ''
  return {
    occupation: parseOccupationSummary(body.occupation, fallback),
    recordedSkillCount,
    matchedOccupationSkillCount,
    unmatchedRecordedSkills,
    coverageExplanation,
    totals,
    items,
  }
}

export function groupSkillGapItems(items) {
  return {
    essential: items.filter((item) => item.relationType === 'essential'),
    optional: items.filter((item) => item.relationType === 'optional'),
  }
}

export function recordedStatusLabel(recorded) {
  return recorded ? 'Recorded' : 'Not recorded'
}

export function recordedStatusTone(recorded) {
  return recorded ? 'success' : 'warning'
}

export function skillGapSkillsPath(basePath) {
  return `${basePath}/skills`
}

export function userFacingSkillGapError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to compare your recorded skills.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot compare recorded skills with this account.'
    }
    if (error.message === 'Invalid request' || error.message === 'Not found') {
      return error.message
    }
  }
  return SKILL_GAP_UNAVAILABLE
}

export async function fetchSkillGap(occupationId, { signal } = {}) {
  if (typeof occupationId !== 'string' || !UUID_RE.test(occupationId)) {
    throw new ApiError('Invalid request', 400)
  }
  try {
    const payload = await apiRequest(`/api/me/skill-gap${buildSearchParams({ occupationId })}`, { signal })
    return parseSkillGapResult(payload)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(SKILL_GAP_UNAVAILABLE, 500)
  }
}
