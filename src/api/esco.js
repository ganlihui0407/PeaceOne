import { ApiError, apiRequest } from './client.js'

export const ESCO_LIST_LIMIT = 20
export const ESCO_SEARCH_DEBOUNCE_MS = 400
export const ESCO_SEARCH_MIN_CHARS = 2

export const ESCO_UNAVAILABLE = {
  occupations: 'Occupation data is unavailable right now.',
  occupation: 'Occupation details are unavailable right now.',
  occupationSkills: 'Occupation skills are unavailable right now.',
  skills: 'Skill data is unavailable right now.',
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isAbortError(error) {
  return error?.name === 'AbortError'
}

export function userFacingLoadError(error, fallback) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError && (error.message === 'Invalid request' || error.message === 'Not found')) {
    return error.message
  }
  return fallback
}

export function buildSearchParams(params = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export function createRequestSequence() {
  let latest = 0
  return {
    next() {
      latest += 1
      return latest
    },
    isCurrent(id) {
      return id === latest
    },
  }
}

function requireString(value, fallback) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function requireInteger(value, fallback) {
  if (!Number.isInteger(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

export function formatSkillType(skillType) {
  if (skillType == null || skillType === '') {
    return 'Not classified'
  }
  return skillType
}

export function formatRelationType(relationType) {
  if (relationType === 'essential') {
    return 'Essential'
  }
  if (relationType === 'optional') {
    return 'Optional'
  }
  return 'Unknown'
}

export function relationTone(relationType) {
  if (relationType === 'essential') {
    return 'primary'
  }
  if (relationType === 'optional') {
    return 'info'
  }
  return 'warning'
}

export function skillTypeTone(skillType) {
  return skillType == null || skillType === '' ? 'warning' : 'default'
}

export function parseOccupationSummary(item, fallback = ESCO_UNAVAILABLE.occupations) {
  if (!item || typeof item !== 'object') {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(item.id, fallback),
    sourceUri: requireString(item.sourceUri, fallback),
    preferredLabel: requireString(item.preferredLabel, fallback),
    sourceSystem: optionalString(item.sourceSystem) || '',
    iscoGroup: optionalString(item.iscoGroup),
  }
}

export function parseOccupationDetail(item, fallback = ESCO_UNAVAILABLE.occupation) {
  const summary = parseOccupationSummary(item, fallback)
  return {
    ...summary,
    code: optionalString(item.code),
    status: optionalString(item.status),
    altLabels: optionalString(item.altLabels),
    description: optionalString(item.description),
    definition: optionalString(item.definition),
    modifiedDate: optionalString(item.modifiedDate),
  }
}

export function parseSkillSummary(item, fallback = ESCO_UNAVAILABLE.skills) {
  if (!item || typeof item !== 'object') {
    throw new ApiError(fallback, 500)
  }
  let skillType = null
  if (item.skillType != null) {
    if (typeof item.skillType !== 'string') {
      throw new ApiError(fallback, 500)
    }
    skillType = item.skillType.length > 0 ? item.skillType : null
  }
  return {
    id: requireString(item.id, fallback),
    sourceUri: requireString(item.sourceUri, fallback),
    preferredLabel: requireString(item.preferredLabel, fallback),
    skillType,
    sourceSystem: optionalString(item.sourceSystem) || '',
  }
}

export function parseOccupationSkillItem(item, fallback = ESCO_UNAVAILABLE.occupationSkills) {
  if (!item || typeof item !== 'object') {
    throw new ApiError(fallback, 500)
  }
  const relationType = item.relationType == null ? null : requireString(item.relationType, fallback)
  return {
    relationType,
    skill: parseSkillSummary(item.skill, fallback),
  }
}

export function parsePagedList(payload, parseItem, fallback) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    throw new ApiError(fallback, 500)
  }
  return {
    items: payload.items.map((item) => parseItem(item, fallback)),
    page: requireInteger(payload.page, fallback),
    limit: requireInteger(payload.limit, fallback),
    total: requireInteger(payload.total, fallback),
    totalPages: requireInteger(payload.totalPages, fallback),
  }
}

async function getJson(path, fallback, signal) {
  try {
    return await apiRequest(path, { signal })
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(fallback, 500)
  }
}

export async function fetchOccupations({ q, page, limit, iscoGroup, signal } = {}) {
  const payload = await getJson(
    `/api/occupations${buildSearchParams({ q, page, limit, iscoGroup })}`,
    ESCO_UNAVAILABLE.occupations,
    signal,
  )
  return parsePagedList(payload, parseOccupationSummary, ESCO_UNAVAILABLE.occupations)
}

export async function fetchOccupation(id, { signal } = {}) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await getJson(`/api/occupations/${encodeURIComponent(id)}`, ESCO_UNAVAILABLE.occupation, signal)
  if (!payload?.occupation) {
    throw new ApiError(ESCO_UNAVAILABLE.occupation, 500)
  }
  return parseOccupationDetail(payload.occupation)
}

export async function fetchOccupationByUri(uri, { signal } = {}) {
  const payload = await getJson(
    `/api/occupations/by-uri${buildSearchParams({ uri })}`,
    ESCO_UNAVAILABLE.occupation,
    signal,
  )
  if (!payload?.occupation) {
    throw new ApiError(ESCO_UNAVAILABLE.occupation, 500)
  }
  return parseOccupationDetail(payload.occupation)
}

export async function fetchOccupationSkills(id, { page, limit, relationType, signal } = {}) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await getJson(
    `/api/occupations/${encodeURIComponent(id)}/skills${buildSearchParams({ page, limit, relationType })}`,
    ESCO_UNAVAILABLE.occupationSkills,
    signal,
  )
  return parsePagedList(payload, parseOccupationSkillItem, ESCO_UNAVAILABLE.occupationSkills)
}

export async function fetchSkills({ q, page, limit, skillType, signal } = {}) {
  const payload = await getJson(
    `/api/skills${buildSearchParams({ q, page, limit, skillType })}`,
    ESCO_UNAVAILABLE.skills,
    signal,
  )
  return parsePagedList(payload, parseSkillSummary, ESCO_UNAVAILABLE.skills)
}
