import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiRequest } from './client.js'
import { buildSearchParams, isAbortError, parsePagedList } from './esco.js'

export const POSITION_CHANGE_UNAVAILABLE = 'Position change requests are unavailable right now.'
export const POSITION_CHANGE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED']
export const REQUESTED_POSITION_MAX = 100
export const REASON_MAX = 1000
export const REVIEW_NOTE_MAX = 1000
export const POSITION_CHANGE_LIST_LIMIT = 20
export const PENDING_EXISTS = 'Pending request already exists'
export const ALREADY_REVIEWED = 'Request already reviewed'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireObject(value, fallback = POSITION_CHANGE_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireString(value, fallback = POSITION_CHANGE_UNAVAILABLE) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function parsePerson(value, fallback = POSITION_CHANGE_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  const person = requireObject(value, fallback)
  return {
    id: requireString(person.id, fallback),
    fullName: requireString(person.fullName, fallback),
    email: requireString(person.email, fallback),
    jobTitle: person.jobTitle === undefined ? undefined : optionalString(person.jobTitle),
  }
}

export function parsePositionChangeRequest(value, fallback = POSITION_CHANGE_UNAVAILABLE) {
  const record = requireObject(value, fallback)
  const status = requireString(record.status, fallback)
  if (!POSITION_CHANGE_STATUSES.includes(status)) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(record.id, fallback),
    currentPosition: optionalString(record.currentPosition),
    requestedPosition: requireString(record.requestedPosition, fallback),
    reason: requireString(record.reason, fallback),
    status,
    reviewNote: optionalString(record.reviewNote),
    reviewedAt: optionalString(record.reviewedAt),
    createdAt: requireString(record.createdAt, fallback),
    updatedAt: requireString(record.updatedAt, fallback),
    user: parsePerson(record.user, fallback),
    reviewer: parsePerson(record.reviewer, fallback),
  }
}

export function parseStaffPositionChangeRequestList(payload) {
  const body = requireObject(payload)
  if (!Array.isArray(body.items)) {
    throw new ApiError(POSITION_CHANGE_UNAVAILABLE, 500)
  }
  return body.items.map((item) => parsePositionChangeRequest(item))
}

export function positionChangeRequestPath(id) {
  return `/admin/position-requests/${encodeURIComponent(id)}`
}

export function positionChangeRequestsPath() {
  return '/admin/position-requests'
}

export function formatPositionChangeStatus(status) {
  if (status === 'PENDING') {
    return 'Pending'
  }
  if (status === 'APPROVED') {
    return 'Approved'
  }
  if (status === 'REJECTED') {
    return 'Rejected'
  }
  return status
}

export function positionChangeStatusTone(status) {
  if (status === 'APPROVED') {
    return 'success'
  }
  if (status === 'REJECTED') {
    return 'danger'
  }
  return 'warning'
}

export function formatRequestDate(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export function hasPendingPositionChangeRequest(items) {
  return items.some((item) => item.status === 'PENDING')
}

export function userFacingPositionChangeError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage position change requests.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot manage position change requests with this account.'
    }
    if (error.status === 409 && error.message === PENDING_EXISTS) {
      return 'You already have a pending position change request.'
    }
    if (error.status === 409 && error.message === ALREADY_REVIEWED) {
      return 'This request has already been reviewed.'
    }
    if (error.message === 'Invalid request' || error.message === 'Not found') {
      return error.message
    }
  }
  return POSITION_CHANGE_UNAVAILABLE
}

async function requestPositionChange(path, options = {}) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(POSITION_CHANGE_UNAVAILABLE, 500)
  }
}

export function isPositionChangeRequestId(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export async function fetchStaffPositionChangeRequests({ signal } = {}) {
  const payload = await requestPositionChange('/api/me/position-change-requests', { signal })
  return parseStaffPositionChangeRequestList(payload)
}

export async function createStaffPositionChangeRequest({ requestedPosition, reason, signal } = {}) {
  const payload = await requestPositionChange('/api/me/position-change-requests', {
    method: 'POST',
    mutate: true,
    body: { requestedPosition, reason },
    signal,
  })
  return parsePositionChangeRequest(payload?.request)
}

export async function fetchAdminPositionChangeRequests({ q, status, page, limit, signal } = {}) {
  const payload = await requestPositionChange(
    `/api/admin/position-change-requests${buildSearchParams({ q, status, page, limit })}`,
    { signal },
  )
  return parsePagedList(payload, parsePositionChangeRequest, POSITION_CHANGE_UNAVAILABLE)
}

export async function fetchAdminPositionChangeRequest(id, { signal } = {}) {
  if (!isPositionChangeRequestId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestPositionChange(
    `/api/admin/position-change-requests/${encodeURIComponent(id)}`,
    { signal },
  )
  if (!payload?.request) {
    throw new ApiError(POSITION_CHANGE_UNAVAILABLE, 500)
  }
  return parsePositionChangeRequest(payload.request)
}

export async function approvePositionChangeRequest(id, { reviewNote, signal } = {}) {
  if (!isPositionChangeRequestId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestPositionChange(
    `/api/admin/position-change-requests/${encodeURIComponent(id)}/approve`,
    {
      method: 'POST',
      mutate: true,
      body: { reviewNote: reviewNote ?? null },
      signal,
    },
  )
  return parsePositionChangeRequest(payload?.request)
}

export async function rejectPositionChangeRequest(id, { reviewNote, signal } = {}) {
  if (!isPositionChangeRequestId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestPositionChange(
    `/api/admin/position-change-requests/${encodeURIComponent(id)}/reject`,
    {
      method: 'POST',
      mutate: true,
      body: { reviewNote: reviewNote ?? null },
      signal,
    },
  )
  return parsePositionChangeRequest(payload?.request)
}

export { isAbortError }
