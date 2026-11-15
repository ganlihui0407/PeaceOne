import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiRequest } from './client.js'
import { isAbortError, parseSkillSummary } from './esco.js'
import { clearRecordedSkillsCache } from './recordedSkillsCache.js'

export const USER_SKILLS_UNAVAILABLE = 'Saved skills are unavailable right now.'
export const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced']

function requireObject(value, fallback) {
  if (!value || typeof value !== 'object') {
    throw new ApiError(fallback, 500)
  }
  return value
}

export function parseUserSkill(item, fallback = USER_SKILLS_UNAVAILABLE) {
  const record = requireObject(item, fallback)
  if (typeof record.id !== 'string' || record.id.length === 0) {
    throw new ApiError(fallback, 500)
  }
  if (!PROFICIENCY_LEVELS.includes(record.proficiencyLevel)) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: record.id,
    proficiencyLevel: record.proficiencyLevel,
    skill: parseSkillSummary(record.skill, fallback),
  }
}

export function parseUserSkillList(payload, fallback = USER_SKILLS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  if (!Array.isArray(body.items)) {
    throw new ApiError(fallback, 500)
  }
  return body.items.map((item) => parseUserSkill(item, fallback))
}

export function userFacingSkillError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage your recorded skills.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot manage recorded skills with this account.'
    }
    if (error.status === 409 || error.message === 'Already recorded') {
      return 'This skill is already recorded.'
    }
    if (error.message === 'Invalid request' || error.message === 'Not found') {
      return error.message
    }
  }
  return USER_SKILLS_UNAVAILABLE
}

async function requestUserSkills(path, options, fallback) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(fallback, 500)
  }
}

export async function fetchSavedSkills({ signal } = {}) {
  const payload = await requestUserSkills('/api/me/skills', { signal }, USER_SKILLS_UNAVAILABLE)
  return parseUserSkillList(payload)
}

export async function createSavedSkill({ skillId, proficiencyLevel, signal } = {}) {
  const payload = await requestUserSkills(
    '/api/me/skills',
    {
      method: 'POST',
      mutate: true,
      body: { skillId, proficiencyLevel },
      signal,
    },
    USER_SKILLS_UNAVAILABLE,
  )
  const saved = parseUserSkill(payload?.userSkill)
  clearRecordedSkillsCache()
  return saved
}

export async function updateSavedSkill(id, { proficiencyLevel, signal } = {}) {
  const payload = await requestUserSkills(
    `/api/me/skills/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      mutate: true,
      body: { proficiencyLevel },
      signal,
    },
    USER_SKILLS_UNAVAILABLE,
  )
  const saved = parseUserSkill(payload?.userSkill)
  clearRecordedSkillsCache()
  return saved
}

export async function deleteSavedSkill(id, { signal } = {}) {
  const payload = await requestUserSkills(
    `/api/me/skills/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      mutate: true,
      signal,
    },
    USER_SKILLS_UNAVAILABLE,
  )
  if (payload?.ok !== true) {
    throw new ApiError(USER_SKILLS_UNAVAILABLE, 500)
  }
  clearRecordedSkillsCache()
  return true
}
