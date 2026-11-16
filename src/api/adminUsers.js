import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiRequest } from './client.js'
import { buildSearchParams, isAbortError } from './esco.js'
import { formatProfileAccountStatus, formatProfileRole } from './meForm.js'

export const ADMIN_USERS_UNAVAILABLE = 'User records are unavailable right now.'
export const CANNOT_SUSPEND_SELF = 'You cannot suspend your own account'
export const ADMIN_USER_LIST_LIMIT = 20

export const ADMIN_USER_ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'JOB_SEEKER', label: 'Job Seeker' },
  { value: 'COMPANY_STAFF', label: 'Company Staff' },
  { value: 'ADMIN', label: 'Administrator' },
]

export const ADMIN_USER_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
]

function requireObject(value, fallback = ADMIN_USERS_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireString(value, fallback = ADMIN_USERS_UNAVAILABLE) {
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
    throw new ApiError(ADMIN_USERS_UNAVAILABLE, 500)
  }
  return value
}

function requireNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError(ADMIN_USERS_UNAVAILABLE, 500)
  }
  return value
}

export function formatAdminDate(value) {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleDateString()
}

export function parseAdminUser(value) {
  const user = requireObject(value)
  const company = user.company == null
    ? null
    : {
      id: requireString(user.company.id),
      companyName: requireString(user.company.companyName),
    }
  return {
    id: requireString(user.id),
    email: requireString(user.email),
    fullName: requireString(user.fullName),
    phone: optionalString(user.phone),
    role: requireString(user.role),
    accountStatus: requireString(user.accountStatus),
    jobTitle: optionalString(user.jobTitle),
    createdAt: requireString(user.createdAt),
    company,
    educationLevel: optionalString(user.educationLevel),
    fieldOfStudy: optionalString(user.fieldOfStudy),
    institution: optionalString(user.institution),
    graduationYear: user.graduationYear == null ? null : requireNumber(user.graduationYear),
    location: optionalString(user.location),
    experienceSummary: optionalString(user.experienceSummary),
    department: optionalString(user.department),
    applicationCount: typeof user.applicationCount === 'number' ? user.applicationCount : undefined,
    interviewCount: typeof user.interviewCount === 'number' ? user.interviewCount : undefined,
    skillCount: typeof user.skillCount === 'number' ? user.skillCount : undefined,
    enrollmentCount: typeof user.enrollmentCount === 'number' ? user.enrollmentCount : undefined,
    completedCourseCount: typeof user.completedCourseCount === 'number' ? user.completedCourseCount : undefined,
    createdJobCount: typeof user.createdJobCount === 'number' ? user.createdJobCount : undefined,
    pendingPositionChangeRequest: user.pendingPositionChangeRequest
      ? {
        id: requireString(user.pendingPositionChangeRequest.id),
        currentPosition: optionalString(user.pendingPositionChangeRequest.currentPosition),
        requestedPosition: optionalString(user.pendingPositionChangeRequest.requestedPosition),
        status: requireString(user.pendingPositionChangeRequest.status),
        createdAt: requireString(user.pendingPositionChangeRequest.createdAt),
      }
      : null,
  }
}

export function userFacingAdminUserError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage users.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot manage users with this account.'
    }
    if (error.message === CANNOT_SUSPEND_SELF) {
      return CANNOT_SUSPEND_SELF
    }
    if (error.message === 'Invalid request' || error.message === 'Not found') {
      return error.message
    }
  }
  return ADMIN_USERS_UNAVAILABLE
}

async function requestAdminUsers(path, options = {}) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(ADMIN_USERS_UNAVAILABLE, 500)
  }
}

export async function fetchAdminUsers({ q, role, accountStatus, page = 1, limit = ADMIN_USER_LIST_LIMIT, signal } = {}) {
  const payload = await requestAdminUsers(
    `/api/admin/users${buildSearchParams({ q, role, accountStatus, page, limit })}`,
    { signal },
  )
  const body = requireObject(payload)
  return {
    items: Array.isArray(body.users) ? body.users.map(parseAdminUser) : [],
    page: requireNumber(body.page),
    limit: requireNumber(body.limit),
    total: requireNumber(body.total),
    totalPages: requireNumber(body.totalPages),
  }
}

export async function fetchAdminUserStats({ signal } = {}) {
  const payload = await requestAdminUsers('/api/admin/users/stats', { signal })
  const body = requireObject(payload)
  return {
    total: requireNumber(body.total),
    byRole: requireObject(body.byRole),
    byStatus: requireObject(body.byStatus),
  }
}

export async function fetchAdminUser(id, { signal } = {}) {
  const payload = await requestAdminUsers(`/api/admin/users/${encodeURIComponent(id)}`, { signal })
  return parseAdminUser(requireObject(payload).user)
}

export async function updateAdminUserStatus(id, accountStatus) {
  const payload = await requestAdminUsers(`/api/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    mutate: true,
    body: { accountStatus },
  })
  return parseAdminUser(requireObject(payload).user)
}

export { formatProfileAccountStatus, formatProfileRole }
