import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiRequest } from './client.js'
import { isAbortError } from './esco.js'

export const ME_PROFILE_UNAVAILABLE = 'Profile data is unavailable right now.'
export const ME_ROLES = ['STUDENT', 'JOB_SEEKER', 'COMPANY_STAFF', 'ADMIN']
export const ME_ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED']
export const EDUCATION_LEVELS = ['Diploma', "Bachelor's Degree", "Master's Degree", 'Other']
export const GRADUATION_YEAR_MIN = 1950
export const GRADUATION_YEAR_MAX = 2100

export const ME_PROFILE_FIELD_LIMITS = {
  fullName: 100,
  phone: 30,
  fieldOfStudy: 100,
  institution: 150,
  location: 100,
  experienceSummary: 2000,
  jobTitle: 100,
  department: 100,
}

function requireObject(value, fallback = ME_PROFILE_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireString(value, fallback = ME_PROFILE_UNAVAILABLE) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalString(value, max, fallback = ME_PROFILE_UNAVAILABLE) {
  if (value == null || value === '') {
    return null
  }
  if (typeof value !== 'string' || value.length > max) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalEducationLevel(value, fallback = ME_PROFILE_UNAVAILABLE) {
  if (value == null || value === '') {
    return null
  }
  if (!EDUCATION_LEVELS.includes(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalGraduationYear(value, fallback = ME_PROFILE_UNAVAILABLE) {
  if (value == null || value === '') {
    return null
  }
  if (!Number.isInteger(value) || value < GRADUATION_YEAR_MIN || value > GRADUATION_YEAR_MAX) {
    throw new ApiError(fallback, 500)
  }
  return value
}

export function parseMeProfile(payload, fallback = ME_PROFILE_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  const user = requireObject(body.user, fallback)
  const role = requireString(user.role, fallback)
  const accountStatus = requireString(user.accountStatus, fallback)
  if (!ME_ROLES.includes(role) || !ME_ACCOUNT_STATUSES.includes(accountStatus)) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(user.id, fallback),
    email: requireString(user.email, fallback),
    fullName: requireString(user.fullName, fallback),
    phone: optionalString(user.phone, ME_PROFILE_FIELD_LIMITS.phone, fallback),
    role,
    accountStatus,
    educationLevel: optionalEducationLevel(user.educationLevel, fallback),
    fieldOfStudy: optionalString(user.fieldOfStudy, ME_PROFILE_FIELD_LIMITS.fieldOfStudy, fallback),
    institution: optionalString(user.institution, ME_PROFILE_FIELD_LIMITS.institution, fallback),
    graduationYear: optionalGraduationYear(user.graduationYear, fallback),
    location: optionalString(user.location, ME_PROFILE_FIELD_LIMITS.location, fallback),
    experienceSummary: optionalString(user.experienceSummary, ME_PROFILE_FIELD_LIMITS.experienceSummary, fallback),
    jobTitle: optionalString(user.jobTitle, ME_PROFILE_FIELD_LIMITS.jobTitle, fallback),
    department: optionalString(user.department, ME_PROFILE_FIELD_LIMITS.department, fallback),
  }
}

export function userFacingMeProfileError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage your profile.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot manage this profile with this account.'
    }
    if (error.message === 'Invalid request') {
      return error.message
    }
  }
  return ME_PROFILE_UNAVAILABLE
}

function normalizeFullName(fullName) {
  if (typeof fullName !== 'string') {
    throw new ApiError('Invalid request', 400)
  }
  const trimmed = fullName.trim()
  if (trimmed.length < 1 || trimmed.length > ME_PROFILE_FIELD_LIMITS.fullName) {
    throw new ApiError('Invalid request', 400)
  }
  return trimmed
}

function normalizeOptionalString(value, max) {
  if (value == null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new ApiError('Invalid request', 400)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (trimmed.length > max) {
    throw new ApiError('Invalid request', 400)
  }
  return trimmed
}

function normalizeEducationLevel(value) {
  if (value == null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new ApiError('Invalid request', 400)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (!EDUCATION_LEVELS.includes(trimmed)) {
    throw new ApiError('Invalid request', 400)
  }
  return trimmed
}

function normalizeGraduationYear(value) {
  if (value == null || value === '') {
    return null
  }
  if (!Number.isInteger(value) || value < GRADUATION_YEAR_MIN || value > GRADUATION_YEAR_MAX) {
    throw new ApiError('Invalid request', 400)
  }
  return value
}

export function buildMeProfileUpdate(input = {}) {
  const body = {}
  if (input.fullName !== undefined) {
    body.fullName = normalizeFullName(input.fullName)
  }
  if (input.phone !== undefined) {
    body.phone = normalizeOptionalString(input.phone, ME_PROFILE_FIELD_LIMITS.phone)
  }
  if (input.educationLevel !== undefined) {
    body.educationLevel = normalizeEducationLevel(input.educationLevel)
  }
  if (input.fieldOfStudy !== undefined) {
    body.fieldOfStudy = normalizeOptionalString(input.fieldOfStudy, ME_PROFILE_FIELD_LIMITS.fieldOfStudy)
  }
  if (input.institution !== undefined) {
    body.institution = normalizeOptionalString(input.institution, ME_PROFILE_FIELD_LIMITS.institution)
  }
  if (input.graduationYear !== undefined) {
    body.graduationYear = normalizeGraduationYear(input.graduationYear)
  }
  if (input.location !== undefined) {
    body.location = normalizeOptionalString(input.location, ME_PROFILE_FIELD_LIMITS.location)
  }
  if (input.experienceSummary !== undefined) {
    body.experienceSummary = normalizeOptionalString(
      input.experienceSummary,
      ME_PROFILE_FIELD_LIMITS.experienceSummary,
    )
  }
  if (input.jobTitle !== undefined) {
    body.jobTitle = normalizeOptionalString(input.jobTitle, ME_PROFILE_FIELD_LIMITS.jobTitle)
  }
  if (input.department !== undefined) {
    body.department = normalizeOptionalString(input.department, ME_PROFILE_FIELD_LIMITS.department)
  }
  if (Object.keys(body).length === 0) {
    throw new ApiError('Invalid request', 400)
  }
  return body
}

async function requestMeProfile(path, options) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(ME_PROFILE_UNAVAILABLE, 500)
  }
}

export async function fetchMeProfile({ signal } = {}) {
  const payload = await requestMeProfile('/api/me', { signal })
  return parseMeProfile(payload)
}

export async function updateMeProfile(input = {}) {
  const { signal, ...fields } = input
  const payload = await requestMeProfile('/api/me', {
    method: 'PATCH',
    mutate: true,
    body: buildMeProfileUpdate(fields),
    signal,
  })
  return parseMeProfile(payload)
}

export { isAbortError }
