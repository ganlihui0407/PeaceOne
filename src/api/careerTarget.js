import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiRequest } from './client.js'
import { isAbortError, parseOccupationSummary } from './esco.js'

export const CAREER_TARGET_UNAVAILABLE = 'Career target data is unavailable right now.'
export const CAREER_TARGET_EMPTY = {
  title: 'No career target saved yet.',
  description:
    'Choose an official ESCO occupation on the Career Target page and save it. MASCO occupation codes are a separate Malaysian catalogue and are not used for Career Target, Skill Gap or course recommendations. Skill Gap can still compare a temporary ESCO selection without changing that saved target.',
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireObject(value, fallback) {
  if (!value || typeof value !== 'object') {
    throw new ApiError(fallback, 500)
  }
  return value
}

export function parseCareerTarget(payload, fallback = CAREER_TARGET_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  if (body.occupation == null) {
    return null
  }
  return parseOccupationSummary(body.occupation, fallback)
}

export function careerTargetPath(basePath) {
  return `${basePath}/career-target`
}

export function userFacingCareerTargetError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage your career target.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot manage a career target with this account.'
    }
    if (error.message === 'Invalid request' || error.message === 'Not found') {
      return error.message
    }
  }
  return CAREER_TARGET_UNAVAILABLE
}

async function requestCareerTarget(path, options, fallback) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(fallback, 500)
  }
}

export async function fetchCareerTarget({ signal } = {}) {
  const payload = await requestCareerTarget('/api/me/career-target', { signal }, CAREER_TARGET_UNAVAILABLE)
  return parseCareerTarget(payload)
}

export async function saveCareerTarget(occupationId, { signal } = {}) {
  if (typeof occupationId !== 'string' || !UUID_RE.test(occupationId)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestCareerTarget(
    '/api/me/career-target',
    {
      method: 'PUT',
      mutate: true,
      body: { occupationId },
      signal,
    },
    CAREER_TARGET_UNAVAILABLE,
  )
  const occupation = parseCareerTarget(payload)
  if (!occupation) {
    throw new ApiError(CAREER_TARGET_UNAVAILABLE, 500)
  }
  return occupation
}

export async function clearCareerTarget({ signal } = {}) {
  const payload = await requestCareerTarget(
    '/api/me/career-target',
    {
      method: 'DELETE',
      mutate: true,
      signal,
    },
    CAREER_TARGET_UNAVAILABLE,
  )
  return parseCareerTarget(payload)
}
