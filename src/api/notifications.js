import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { candidateApplicationPath, employerApplicantPath } from './applications.js'
import { ApiError, apiRequest } from './client.js'
import { buildSearchParams, isAbortError } from './esco.js'
import { candidateInterviewPath, employerInterviewPath } from './interviews.js'
import { formatJobDateTime } from './jobs.js'

export const NOTIFICATIONS_UNAVAILABLE = 'Notification data is unavailable right now.'
export const RELATED_RECORD_UNAVAILABLE = 'This related record is no longer available.'
export const ADMIN_RELATED_UNAVAILABLE =
  'This notification does not have a matching page in the administrator workspace.'
export const NOTIFICATION_LIST_LIMIT = 20
export const NOTIFICATION_DROPDOWN_LIMIT = 5
export const NOTIFICATIONS_CHANGED_EVENT = 'peaceone:notifications-changed'

export const NOTIFICATION_EMPTY = {
  title: 'No notifications yet.',
  description: 'Updates about applications and interviews appear here when they are stored for this account.',
}

export const NOTIFICATION_UNREAD_EMPTY = {
  title: 'No unread notifications.',
  description: 'You are up to date. Older notifications remain available in All.',
}

export const NOTIFICATION_TYPES = [
  'APPLICATION_SUBMITTED',
  'APPLICATION_SHORTLISTED',
  'APPLICATION_REJECTED',
  'INTERVIEW_INVITED',
  'INTERVIEW_ACCEPTED',
  'INTERVIEW_RESCHEDULE_REQUESTED',
  'INTERVIEW_RESCHEDULE_CONFIRMED',
  'INTERVIEW_CANCELLED',
  'INTERVIEW_COMPLETED',
]

export const NOTIFICATION_RELATED_ENTITY_TYPES = ['APPLICATION', 'INTERVIEW']

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireObject(value, fallback = NOTIFICATIONS_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireString(value, fallback = NOTIFICATIONS_UNAVAILABLE) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireInteger(value, fallback = NOTIFICATIONS_UNAVAILABLE) {
  if (!Number.isInteger(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalTimestamp(value, fallback = NOTIFICATIONS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  return requireString(value, fallback)
}

export function isNotificationId(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isNotificationUnread(notification) {
  return notification?.readAt == null
}

export function formatUnreadBadge(count) {
  if (!Number.isInteger(count) || count <= 0) {
    return ''
  }
  return count > 99 ? '99+' : String(count)
}

export function formatNotificationTime(value) {
  return formatJobDateTime(value)
}

export function notificationsCentrePath(role) {
  if (role === 'STUDENT') {
    return '/student/notifications'
  }
  if (role === 'JOB_SEEKER') {
    return '/jobseeker/notifications'
  }
  if (role === 'COMPANY_STAFF') {
    return '/employer/notifications'
  }
  if (role === 'ADMIN') {
    return '/admin/notifications'
  }
  return null
}

export function parseNotification(value, fallback = NOTIFICATIONS_UNAVAILABLE) {
  const record = requireObject(value, fallback)
  const type = requireString(record.type, fallback)
  if (!NOTIFICATION_TYPES.includes(type)) {
    throw new ApiError(fallback, 500)
  }
  const relatedEntityType = requireString(record.relatedEntityType, fallback)
  if (!NOTIFICATION_RELATED_ENTITY_TYPES.includes(relatedEntityType)) {
    throw new ApiError(fallback, 500)
  }
  const relatedEntityId = requireString(record.relatedEntityId, fallback)
  if (!UUID_RE.test(relatedEntityId)) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(record.id, fallback),
    type,
    title: requireString(record.title, fallback),
    message: requireString(record.message, fallback),
    relatedEntityType,
    relatedEntityId,
    readAt: optionalTimestamp(record.readAt, fallback),
    createdAt: requireString(record.createdAt, fallback),
  }
}

export function parseNotificationPage(payload, fallback = NOTIFICATIONS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  if (!Array.isArray(body.notifications)) {
    throw new ApiError(fallback, 500)
  }
  return {
    items: body.notifications.map((item) => parseNotification(item, fallback)),
    page: requireInteger(body.page, fallback),
    limit: requireInteger(body.limit, fallback),
    total: requireInteger(body.total, fallback),
    totalPages: requireInteger(body.totalPages, fallback),
  }
}

export function parseUnreadCount(payload, fallback = NOTIFICATIONS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  return { unreadCount: requireInteger(body.unreadCount, fallback) }
}

export function parseReadAllResult(payload, fallback = NOTIFICATIONS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  return { updatedCount: requireInteger(body.updatedCount, fallback) }
}

export function userFacingNotificationError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to view notifications.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot manage these notifications with this account.'
    }
    if (error.status === 404 || error.message === 'Not found') {
      return 'This notification is not available.'
    }
    if (error.message === 'Invalid request' || error.message === RELATED_RECORD_UNAVAILABLE) {
      return error.message
    }
  }
  return NOTIFICATIONS_UNAVAILABLE
}

export function notificationDestination(role, notification) {
  const relatedEntityType = notification?.relatedEntityType
  const relatedEntityId = notification?.relatedEntityId
  if (!isNotificationId(relatedEntityId)) {
    return null
  }
  if (role === 'STUDENT' || role === 'JOB_SEEKER') {
    const basePath = role === 'STUDENT' ? '/student' : '/jobseeker'
    if (relatedEntityType === 'APPLICATION') {
      return candidateApplicationPath(basePath, relatedEntityId)
    }
    if (relatedEntityType === 'INTERVIEW') {
      return candidateInterviewPath(basePath, relatedEntityId)
    }
    return null
  }
  if (role === 'COMPANY_STAFF') {
    if (relatedEntityType === 'APPLICATION') {
      return employerApplicantPath(relatedEntityId)
    }
    if (relatedEntityType === 'INTERVIEW') {
      return employerInterviewPath(relatedEntityId)
    }
    return null
  }
  return null
}

function relatedRecordApiPath(role, notification) {
  const relatedEntityType = notification?.relatedEntityType
  const relatedEntityId = notification?.relatedEntityId
  if (!isNotificationId(relatedEntityId)) {
    return null
  }
  if (role === 'STUDENT' || role === 'JOB_SEEKER') {
    if (relatedEntityType === 'APPLICATION') {
      return `/api/me/applications/${encodeURIComponent(relatedEntityId)}`
    }
    if (relatedEntityType === 'INTERVIEW') {
      return `/api/me/interviews/${encodeURIComponent(relatedEntityId)}`
    }
    return null
  }
  if (role === 'COMPANY_STAFF') {
    if (relatedEntityType === 'APPLICATION') {
      return `/api/employer/applications/${encodeURIComponent(relatedEntityId)}`
    }
    if (relatedEntityType === 'INTERVIEW') {
      return `/api/employer/interviews/${encodeURIComponent(relatedEntityId)}`
    }
  }
  return null
}

export async function resolveNotificationTarget(role, notification, { signal } = {}) {
  const path = notificationDestination(role, notification)
  if (!path) {
    return {
      available: false,
      path: null,
      message: role === 'ADMIN' ? ADMIN_RELATED_UNAVAILABLE : RELATED_RECORD_UNAVAILABLE,
    }
  }

  const apiPath = relatedRecordApiPath(role, notification)
  if (!apiPath) {
    return { available: false, path: null, message: RELATED_RECORD_UNAVAILABLE }
  }

  try {
    await apiRequest(apiPath, { signal })
    return { available: true, path, message: null }
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 403 || error.message === 'Not found')) {
      return { available: false, path: null, message: RELATED_RECORD_UNAVAILABLE }
    }
    throw error
  }
}

async function requestNotifications(path, options) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (error instanceof ApiError && error.message === 'Not found') {
      throw error
    }
    if (error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404)) {
      throw error
    }
    throw new ApiError(NOTIFICATIONS_UNAVAILABLE, error?.status || 500)
  }
}

export async function fetchNotifications({ unread, page, limit, signal } = {}) {
  const query = {
    page,
    limit,
  }
  if (unread === true) {
    query.unread = 'true'
  }
  if (unread === false) {
    query.unread = 'false'
  }
  const payload = await requestNotifications(`/api/me/notifications${buildSearchParams(query)}`, { signal })
  return parseNotificationPage(payload)
}

export async function fetchUnreadNotificationCount({ signal } = {}) {
  const payload = await requestNotifications('/api/me/notifications/unread-count', { signal })
  return parseUnreadCount(payload)
}

export async function markNotificationRead(id, { signal } = {}) {
  if (!isNotificationId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestNotifications(`/api/me/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    mutate: true,
    body: {},
    signal,
  })
  const body = requireObject(payload)
  return parseNotification(body.notification)
}

export async function markAllNotificationsRead({ signal } = {}) {
  const payload = await requestNotifications('/api/me/notifications/read-all', {
    method: 'POST',
    mutate: true,
    body: {},
    signal,
  })
  return parseReadAllResult(payload)
}

export function announceNotificationsChanged() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return
  }
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))
}
