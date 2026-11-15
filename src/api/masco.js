import { ApiError, apiRequest } from './client.js'
import { buildSearchParams, isAbortError, parsePagedList, userFacingLoadError } from './esco.js'

export const MASCO_LIST_LIMIT = 20
export const MASCO_SCOPES = ['V4_EXAMPLE', 'SUPPLEMENTAL_INDEX']

export const MASCO_UNAVAILABLE = {
  occupations: 'MASCO occupation data is unavailable right now.',
  occupation: 'MASCO occupation details are unavailable right now.',
  crosswalks: 'MASCO crosswalk data is unavailable right now.',
}

export const MASCO_MAPPING_STATUSES = [
  'VISUALLY_VERIFIED_FROM_SOURCE_ROW_CONTACT_SHEET',
  'VISUALLY_CONFIRMED_FROM_SOURCE_INDEX',
  'CONFIRMED_IN_PREVIOUS_SOURCE_REVIEW',
]

const MASCO_CODE_RE = /^\d{4}-\d{2}$/

function requireString(value, fallback) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function requireObject(value, fallback) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function parseSourceMetadata(value, fallback) {
  if (value == null) {
    return null
  }
  return requireObject(value, fallback)
}

export function isMascoOccupationCode(value) {
  return typeof value === 'string' && MASCO_CODE_RE.test(value)
}

export function isMascoUnitGroupCode(value) {
  return typeof value === 'string' && /^\d{4}$/.test(value)
}

export function mascoOccupationsPath() {
  return '/admin/masco'
}

export function mascoOccupationPath(code) {
  return `/admin/masco/${encodeURIComponent(code)}`
}

export function mascoCrosswalksPath() {
  return '/admin/masco/crosswalks'
}

export function formatMascoStatusLabel(value) {
  if (value == null || value === '') {
    return '—'
  }
  return value.replaceAll('_', ' ')
}

export function mappingStatusTone(mappingStatus) {
  if (mappingStatus === 'VISUALLY_VERIFIED_FROM_SOURCE_ROW_CONTACT_SHEET') {
    return 'success'
  }
  if (mappingStatus === 'VISUALLY_CONFIRMED_FROM_SOURCE_INDEX') {
    return 'info'
  }
  if (mappingStatus === 'CONFIRMED_IN_PREVIOUS_SOURCE_REVIEW') {
    return 'default'
  }
  return 'warning'
}

export function reviewDecisionTone(reviewDecision) {
  if (reviewDecision === 'PASS') {
    return 'success'
  }
  return 'default'
}

export function formatSourceMetadataValue(value) {
  if (value == null || value === '') {
    return null
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    try {
      return JSON.stringify(value)
    } catch {
      return null
    }
  }
  return null
}

export function sourceMetadataEntries(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return []
  }
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: formatSourceMetadataValue(value),
  }))
}

export function isMascoNotFoundError(error) {
  return error instanceof ApiError && (error.status === 404 || error.message === 'Not found')
}

export function isMascoInvalidRequestError(error) {
  return error instanceof ApiError && (error.status === 400 || error.message === 'Invalid request')
}

export function formatRecordScope(recordScope) {
  if (recordScope === 'V4_EXAMPLE') {
    return 'V4 example'
  }
  if (recordScope === 'SUPPLEMENTAL_INDEX') {
    return 'Supplemental index'
  }
  return 'Unknown'
}

export function recordScopeTone(recordScope) {
  if (recordScope === 'V4_EXAMPLE') {
    return 'info'
  }
  if (recordScope === 'SUPPLEMENTAL_INDEX') {
    return 'default'
  }
  return 'warning'
}

export function parseMascoUnitGroup(item, fallback = MASCO_UNAVAILABLE.occupations) {
  const group = requireObject(item, fallback)
  return {
    code: requireString(group.code, fallback),
    title: requireString(group.title, fallback),
    description: optionalString(group.description),
    tasks: optionalString(group.tasks),
  }
}

export function parseMascoOccupationSummary(item, fallback = MASCO_UNAVAILABLE.occupations) {
  const record = requireObject(item, fallback)
  const recordScope = requireString(record.recordScope, fallback)
  return {
    code: requireString(record.code, fallback),
    title: requireString(record.title, fallback),
    classification: requireString(record.classification, fallback),
    version: requireString(record.version, fallback),
    recordScope,
    unitGroup: parseMascoUnitGroup(record.unitGroup, fallback),
  }
}

export function parseMascoOccupationDetail(item, fallback = MASCO_UNAVAILABLE.occupation) {
  const summary = parseMascoOccupationSummary(item, fallback)
  return {
    ...summary,
    sourceMetadata: parseSourceMetadata(item.sourceMetadata, fallback),
  }
}

export function parseMascoCrosswalk(item, fallback = MASCO_UNAVAILABLE.crosswalks) {
  const record = requireObject(item, fallback)
  return {
    sourceVersion: requireString(record.sourceVersion, fallback),
    targetVersion: requireString(record.targetVersion, fallback),
    historicalCode: requireString(record.historicalCode, fallback),
    currentCode: requireString(record.currentCode, fallback),
    mappingStatus: requireString(record.mappingStatus, fallback),
    reviewDecision: optionalString(record.reviewDecision),
    sourceMetadata: parseSourceMetadata(record.sourceMetadata, fallback),
  }
}

export function parseMascoOccupationCrosswalks(payload, fallback = MASCO_UNAVAILABLE.crosswalks) {
  const body = requireObject(payload, fallback)
  if (!Array.isArray(body.items)) {
    throw new ApiError(fallback, 500)
  }
  const occupation = requireObject(body.occupation, fallback)
  return {
    occupation: {
      code: requireString(occupation.code, fallback),
      title: requireString(occupation.title, fallback),
    },
    items: body.items.map((item) => parseMascoCrosswalk(item, fallback)),
  }
}

export { isAbortError, userFacingLoadError }

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

export async function fetchMascoOccupations({ q, unitGroup, scope, page, limit, signal } = {}) {
  const payload = await getJson(
    `/api/masco/occupations${buildSearchParams({ q, unitGroup, scope, page, limit })}`,
    MASCO_UNAVAILABLE.occupations,
    signal,
  )
  return parsePagedList(payload, parseMascoOccupationSummary, MASCO_UNAVAILABLE.occupations)
}

export async function fetchMascoOccupation(code, { signal } = {}) {
  if (!isMascoOccupationCode(code)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await getJson(
    `/api/masco/occupations/${encodeURIComponent(code)}`,
    MASCO_UNAVAILABLE.occupation,
    signal,
  )
  if (!payload?.occupation) {
    throw new ApiError(MASCO_UNAVAILABLE.occupation, 500)
  }
  return parseMascoOccupationDetail(payload.occupation)
}

export async function fetchMascoCrosswalks({
  q,
  historicalCode,
  currentCode,
  mappingStatus,
  page,
  limit,
  signal,
} = {}) {
  const payload = await getJson(
    `/api/masco/crosswalks${buildSearchParams({ q, historicalCode, currentCode, mappingStatus, page, limit })}`,
    MASCO_UNAVAILABLE.crosswalks,
    signal,
  )
  return parsePagedList(payload, parseMascoCrosswalk, MASCO_UNAVAILABLE.crosswalks)
}

export async function fetchMascoOccupationCrosswalks(code, { signal } = {}) {
  if (!isMascoOccupationCode(code)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await getJson(
    `/api/masco/occupations/${encodeURIComponent(code)}/crosswalks`,
    MASCO_UNAVAILABLE.crosswalks,
    signal,
  )
  return parseMascoOccupationCrosswalks(payload)
}
