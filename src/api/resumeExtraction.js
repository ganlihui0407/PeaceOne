import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiRequest } from './client.js'
import { isAbortError } from './esco.js'
import { parseUserSkill } from './userSkills.js'

export const EXTRACTION_UNAVAILABLE = 'Resume skill identification is unavailable right now.'
export const EXTRACTION_UNREADABLE =
  'We could not extract readable text from this document. Please upload a text-based PDF or DOCX, or add your skills manually.'
export const EXTRACTION_SCANNED = 'Scanned documents are not supported for text extraction yet.'
export const EXTRACTION_EMPTY =
  'No matching skills were identified in this resume. You can still add skills manually.'
export const EXTRACTION_STAGES = [
  'Preparing resume',
  'Extracting text',
  'Identifying skills',
  'Matching ESCO catalogue',
]
export const MATCH_TYPES = ['preferred', 'altLabel']
export const MATCH_METHODS = ['preferred-label', 'alternative-label']

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireObject(value, fallback = EXTRACTION_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireString(value, fallback = EXTRACTION_UNAVAILABLE) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalString(value) {
  if (value == null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    throw new ApiError(EXTRACTION_UNAVAILABLE, 500)
  }
  return value
}

function requireBoolean(value) {
  if (typeof value !== 'boolean') {
    throw new ApiError(EXTRACTION_UNAVAILABLE, 500)
  }
  return value
}

export function parseSuggestion(value) {
  const record = requireObject(value)
  if (record.storedFilename !== undefined || record.path !== undefined) {
    throw new ApiError(EXTRACTION_UNAVAILABLE, 500)
  }
  if (!UUID_RE.test(record.skillId)) {
    throw new ApiError(EXTRACTION_UNAVAILABLE, 500)
  }
  if (!MATCH_TYPES.includes(record.matchType) || !MATCH_METHODS.includes(record.matchingMethod)) {
    throw new ApiError(EXTRACTION_UNAVAILABLE, 500)
  }
  const alreadySaved = requireBoolean(record.alreadySaved)
  let existingProficiency = null
  if (record.existingProficiency != null) {
    if (!['Beginner', 'Intermediate', 'Advanced'].includes(record.existingProficiency)) {
      throw new ApiError(EXTRACTION_UNAVAILABLE, 500)
    }
    existingProficiency = record.existingProficiency
  }
  return {
    skillId: record.skillId,
    preferredLabel: requireString(record.preferredLabel),
    skillType: record.skillType == null ? null : requireString(record.skillType),
    sourceUri: requireString(record.sourceUri),
    matchedLabel: requireString(record.matchedLabel),
    matchType: record.matchType,
    matchingMethod: record.matchingMethod,
    evidence: requireString(record.evidence),
    alreadySaved,
    existingProficiency,
    reviewStatus: record.reviewStatus === 'suggested' ? 'suggested' : requireString(record.reviewStatus),
  }
}

export function parseExtraction(payload) {
  const body = requireObject(payload)
  const extraction = requireObject(body.extraction)
  if (extraction.storedFilename !== undefined || extraction.path !== undefined || extraction.text !== undefined) {
    throw new ApiError(EXTRACTION_UNAVAILABLE, 500)
  }
  const unreadable = requireBoolean(extraction.unreadable)
  const suggestions = Array.isArray(extraction.suggestions)
    ? extraction.suggestions.map(parseSuggestion)
    : (() => {
        throw new ApiError(EXTRACTION_UNAVAILABLE, 500)
      })()
  return {
    resumeId: requireString(extraction.resumeId),
    readable: requireBoolean(extraction.readable),
    unreadable,
    truncated: requireBoolean(extraction.truncated),
    textLength: Number.isInteger(extraction.textLength) ? extraction.textLength : 0,
    reason: optionalString(extraction.reason),
    reviewToken: unreadable ? null : requireString(extraction.reviewToken),
    suggestions,
  }
}

export function parseConfirmation(payload) {
  const body = requireObject(payload)
  if (!Array.isArray(body.saved) || !Array.isArray(body.skipped)) {
    throw new ApiError(EXTRACTION_UNAVAILABLE, 500)
  }
  return {
    saved: body.saved.map((item) => parseUserSkill(item, EXTRACTION_UNAVAILABLE)),
    skipped: body.skipped.map((item) => parseUserSkill(item, EXTRACTION_UNAVAILABLE)),
  }
}

export function userFacingExtractionError(error, action = 'extract') {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to identify skills from your resume.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot identify resume skills with this account.'
    }
    if (error.message === 'No resume file uploaded') {
      return 'Upload a PDF or DOCX resume before identifying skills.'
    }
    if (error.message === 'File is unavailable') {
      return EXTRACTION_UNREADABLE
    }
    if (error.message === 'Review has expired') {
      return 'This review has expired. Identify skills again.'
    }
    if (error.message === 'Not found' || error.message === 'Invalid request') {
      return action === 'confirm'
        ? 'These suggestions are no longer valid. Identify skills again.'
        : 'This resume is not available.'
    }
  }
  return action === 'confirm'
    ? 'The selected skills could not be saved. Try again.'
    : EXTRACTION_UNAVAILABLE
}

export function matchingExplanation(suggestion) {
  if (suggestion.matchType === 'altLabel') {
    return `Matched ESCO alternative label “${suggestion.matchedLabel}”.`
  }
  return `Matched ESCO preferred label “${suggestion.preferredLabel}”.`
}

export async function extractResumeSkills(resumeId, { signal } = {}) {
  const payload = await apiRequest(`/api/me/resumes/${encodeURIComponent(resumeId)}/extract-skills`, {
    method: 'POST',
    body: {},
    mutate: true,
    signal,
  })
  return parseExtraction(payload)
}

export async function confirmResumeSkills(resumeId, { reviewToken, skillIds, signal } = {}) {
  const payload = await apiRequest(`/api/me/resumes/${encodeURIComponent(resumeId)}/confirm-skills`, {
    method: 'POST',
    body: { reviewToken, skillIds },
    mutate: true,
    signal,
  })
  return parseConfirmation(payload)
}
