import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { COMPANY_PROFILE_REQUIRED } from './applications.js'
import { ApiError, apiRequest } from './client.js'
import { buildSearchParams, isAbortError } from './esco.js'
import { formatJobDateTime } from './jobs.js'

export const INTERVIEWS_UNAVAILABLE = 'Interview data is unavailable right now.'
export const INTERVIEW_CANNOT_BE_UPDATED = 'Interview cannot be updated'
export const INTERVIEW_CANNOT_BE_CREATED = 'Interview cannot be created'
export const INTERVIEW_LIST_LIMIT = 20
export const INTERVIEW_INSTRUCTIONS_MAX = 2000
export const INTERVIEW_NOTES_MAX = 2000
export const INTERVIEW_RESPONSE_NOTE_MAX = 500
export const DEFAULT_INTERVIEW_TIMEZONE = 'Asia/Kuala_Lumpur'

export const INTERVIEW_EMPTY = {
  title: 'No interviews yet.',
  description: 'Interview invitations appear here after a company schedules one for your application.',
}

export const EMPLOYER_INTERVIEWS_EMPTY = {
  title: 'No interviews yet.',
  description: 'Schedule an interview from a shortlisted application. Counts stay at zero until an invitation is stored.',
}

export const STAFF_INTERVIEWS_EMPTY = {
  title: 'No upcoming interviews.',
  description: 'Confirmed interviews for this company appear here after a candidate accepts an invitation.',
}

export const DASHBOARD_INTERVIEWS_EMPTY = {
  title: 'No upcoming interview.',
  description: 'Pending invitations and confirmed times appear here when a company schedules an interview.',
}

export const INTERVIEW_STATUSES = [
  'PROPOSED',
  'RESCHEDULE_REQUESTED',
  'CONFIRMED',
  'DECLINED',
  'COMPLETED',
  'CANCELLED',
]

export const ACTIVE_INTERVIEW_STATUSES = ['PROPOSED', 'RESCHEDULE_REQUESTED', 'CONFIRMED']

export const INTERVIEW_TYPES = ['ONLINE', 'ONSITE', 'PHONE']
export const INTERVIEW_ATTENDANCES = ['ATTENDED', 'NO_SHOW']
export const INTERVIEW_OUTCOMES = ['POSITIVE', 'NEUTRAL', 'NEGATIVE']

export const INTERVIEW_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PROPOSED', label: 'Pending response' },
  { value: 'RESCHEDULE_REQUESTED', label: 'Reschedule requested' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const INTERVIEW_TYPE_OPTIONS = [
  { value: 'ONLINE', label: 'Online' },
  { value: 'ONSITE', label: 'On-site' },
  { value: 'PHONE', label: 'Phone' },
]

export const INTERVIEW_DURATION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes' },
  { value: '90', label: '90 minutes' },
  { value: '120', label: '120 minutes' },
]

export const INTERVIEW_TIMEZONE_OPTIONS = [
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur (UTC+8)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
  { value: 'UTC', label: 'UTC' },
]

export const INTERVIEW_ATTENDANCE_OPTIONS = [
  { value: 'ATTENDED', label: 'Attended' },
  { value: 'NO_SHOW', label: 'No show' },
]

export const INTERVIEW_OUTCOME_OPTIONS = [
  { value: '', label: 'Not recorded' },
  { value: 'POSITIVE', label: 'Positive' },
  { value: 'NEUTRAL', label: 'Neutral' },
  { value: 'NEGATIVE', label: 'Negative' },
]

const TIMEZONE_OFFSETS = {
  'Asia/Kuala_Lumpur': '+08:00',
  'Asia/Singapore': '+08:00',
  UTC: 'Z',
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireObject(value, fallback = INTERVIEWS_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireString(value, fallback = INTERVIEWS_UNAVAILABLE) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function requireInteger(value, fallback = INTERVIEWS_UNAVAILABLE) {
  if (!Number.isInteger(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalInteger(value, fallback = INTERVIEWS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  return requireInteger(value, fallback)
}

export function isInterviewId(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function employerInterviewsPath({ status, jobId, applicationId } = {}) {
  return `/employer/interviews${buildSearchParams({ status, jobId, applicationId })}`
}

export function employerInterviewPath(id) {
  return `/employer/interviews/${encodeURIComponent(id)}`
}

export function employerInterviewCreatePath(applicationId) {
  return `/employer/interviews/create${buildSearchParams({ applicationId })}`
}

export function employerInterviewEditPath(id) {
  return `/employer/interviews/${encodeURIComponent(id)}/edit`
}

export function candidateInterviewsPath(basePath, { status } = {}) {
  return `${basePath}/interviews${buildSearchParams({ status })}`
}

export function candidateInterviewPath(basePath, id) {
  return `${basePath}/interviews/${encodeURIComponent(id)}`
}

export function formatInterviewStatus(status) {
  const match = INTERVIEW_STATUS_OPTIONS.find((option) => option.value === status)
  return match ? match.label : status
}

export function formatInterviewType(type) {
  const match = INTERVIEW_TYPE_OPTIONS.find((option) => option.value === type)
  return match ? match.label : type
}

export function interviewStatusTone(status) {
  if (status === 'CONFIRMED') return 'success'
  if (status === 'PROPOSED' || status === 'RESCHEDULE_REQUESTED') return 'warning'
  if (status === 'DECLINED' || status === 'CANCELLED') return 'danger'
  if (status === 'COMPLETED') return 'primary'
  return 'default'
}

export function canAcceptInterview(interview) {
  return interview?.status === 'PROPOSED'
}

export function canDeclineInterview(interview) {
  return interview?.status === 'PROPOSED' || interview?.status === 'RESCHEDULE_REQUESTED'
}

export function canRequestReschedule(interview) {
  return interview?.status === 'PROPOSED' || interview?.status === 'CONFIRMED'
}

export function canCancelInterview(interview) {
  return ACTIVE_INTERVIEW_STATUSES.includes(interview?.status)
}

export function canCompleteInterview(interview) {
  return interview?.status === 'CONFIRMED'
}

export function canUpdateInterviewSchedule(interview) {
  return interview?.status === 'PROPOSED' || interview?.status === 'RESCHEDULE_REQUESTED'
}

export function canConfirmInterviewReschedule(interview) {
  return interview?.status === 'RESCHEDULE_REQUESTED'
}

export function canScheduleInterviewForApplication(application, interviews = []) {
  if (application?.status !== 'SHORTLISTED' && application?.status !== 'INTERVIEW') {
    return false
  }
  return !interviews.some((interview) => ACTIVE_INTERVIEW_STATUSES.includes(interview.status))
}

export function combineDateTimeToIso(date, time, timezone = DEFAULT_INTERVIEW_TIMEZONE) {
  if (typeof date !== 'string' || typeof time !== 'string' || !date || !time) {
    return null
  }
  const offset = TIMEZONE_OFFSETS[timezone] || '+08:00'
  const stamp = offset === 'Z' ? `${date}T${time}:00Z` : `${date}T${time}:00${offset}`
  const parsed = new Date(stamp)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.toISOString()
}

export function splitIsoToDateTime(value, timezone = DEFAULT_INTERVIEW_TIMEZONE) {
  if (typeof value !== 'string' || !value) {
    return { date: '', time: '' }
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '' }
  }
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return { date: datePart, time: timePart }
}

export function formatInterviewWhen(interview) {
  if (!interview?.scheduledStartAt) {
    return '—'
  }
  return `${formatJobDateTime(interview.scheduledStartAt)} (${interview.timezone || DEFAULT_INTERVIEW_TIMEZONE})`
}

function parseActor(value, fallback = INTERVIEWS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  const actor = requireObject(value, fallback)
  return {
    id: requireString(actor.id, fallback),
    fullName: requireString(actor.fullName, fallback),
  }
}

function parseJobSummary(value, fallback = INTERVIEWS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  const job = requireObject(value, fallback)
  const company = job.company == null ? null : requireObject(job.company, fallback)
  return {
    id: requireString(job.id, fallback),
    title: requireString(job.title, fallback),
    status: requireString(job.status, fallback),
    company: company
      ? {
        id: requireString(company.id, fallback),
        companyName: requireString(company.companyName, fallback),
        location: optionalString(company.location),
      }
      : null,
  }
}

function parseCandidate(value, fallback = INTERVIEWS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  const candidate = requireObject(value, fallback)
  return {
    id: requireString(candidate.id, fallback),
    fullName: requireString(candidate.fullName, fallback),
    email: optionalString(candidate.email),
  }
}

export function parseInterviewEvent(value, fallback = INTERVIEWS_UNAVAILABLE) {
  const event = requireObject(value, fallback)
  const newStatus = requireString(event.newStatus, fallback)
  if (!INTERVIEW_STATUSES.includes(newStatus)) {
    throw new ApiError(fallback, 500)
  }
  const previousStatus = event.previousStatus == null ? null : requireString(event.previousStatus, fallback)
  if (previousStatus && !INTERVIEW_STATUSES.includes(previousStatus)) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(event.id, fallback),
    eventType: requireString(event.eventType, fallback),
    previousStatus,
    newStatus,
    eventDetails: event.eventDetails && typeof event.eventDetails === 'object' ? event.eventDetails : null,
    createdAt: requireString(event.createdAt, fallback),
    actor: parseActor(event.actor, fallback),
  }
}

export function parseInterview(value, fallback = INTERVIEWS_UNAVAILABLE) {
  const record = requireObject(value, fallback)
  const status = requireString(record.status, fallback)
  if (!INTERVIEW_STATUSES.includes(status)) {
    throw new ApiError(fallback, 500)
  }
  const interviewType = requireString(record.interviewType, fallback)
  if (!INTERVIEW_TYPES.includes(interviewType)) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(record.id, fallback),
    applicationId: requireString(record.applicationId, fallback),
    jobId: requireString(record.jobId, fallback),
    candidateUserId: requireString(record.candidateUserId, fallback),
    companyId: optionalString(record.companyId),
    createdByUserId: optionalString(record.createdByUserId),
    roundNumber: requireInteger(record.roundNumber, fallback),
    title: requireString(record.title, fallback),
    interviewType,
    status,
    scheduledStartAt: requireString(record.scheduledStartAt, fallback),
    durationMinutes: requireInteger(record.durationMinutes, fallback),
    timezone: requireString(record.timezone, fallback),
    meetingLink: optionalString(record.meetingLink),
    venue: optionalString(record.venue),
    instructions: optionalString(record.instructions),
    employerNotes: optionalString(record.employerNotes),
    candidateResponseNote: optionalString(record.candidateResponseNote),
    requestedStartAt: optionalString(record.requestedStartAt),
    requestedDurationMinutes: optionalInteger(record.requestedDurationMinutes, fallback),
    attendance: optionalString(record.attendance),
    outcome: optionalString(record.outcome),
    createdAt: requireString(record.createdAt, fallback),
    updatedAt: requireString(record.updatedAt, fallback),
    application: record.application
      ? {
        id: requireString(record.application.id, fallback),
        status: requireString(record.application.status, fallback),
      }
      : null,
    job: parseJobSummary(record.job, fallback),
    candidate: parseCandidate(record.candidate, fallback),
    createdBy: parseActor(record.createdBy, fallback),
    events: Array.isArray(record.events)
      ? record.events.map((event) => parseInterviewEvent(event, fallback))
      : [],
  }
}

function emptyStatusCounts() {
  return Object.fromEntries(INTERVIEW_STATUSES.map((status) => [status, 0]))
}

export function emptyEmployerInterviewStats() {
  return {
    total: 0,
    byStatus: emptyStatusCounts(),
    upcomingConfirmed: 0,
  }
}

export function emptyAdminInterviewStats() {
  return {
    total: 0,
    byStatus: emptyStatusCounts(),
    companiesWithInterviews: 0,
  }
}

function parseStatusCounts(value, fallback = INTERVIEWS_UNAVAILABLE) {
  const counts = requireObject(value, fallback)
  const byStatus = emptyStatusCounts()
  for (const status of INTERVIEW_STATUSES) {
    byStatus[status] = requireInteger(counts[status], fallback)
  }
  return byStatus
}

export function parseEmployerInterviewStats(payload, fallback = INTERVIEWS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  return {
    total: requireInteger(body.total, fallback),
    byStatus: parseStatusCounts(body.byStatus, fallback),
    upcomingConfirmed: requireInteger(body.upcomingConfirmed, fallback),
  }
}

export function parseAdminInterviewStats(payload, fallback = INTERVIEWS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  return {
    total: requireInteger(body.total, fallback),
    byStatus: parseStatusCounts(body.byStatus, fallback),
    companiesWithInterviews: requireInteger(body.companiesWithInterviews, fallback),
  }
}

export function parseInterviewPage(payload, fallback = INTERVIEWS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  if (!Array.isArray(body.interviews)) {
    throw new ApiError(fallback, 500)
  }
  return {
    items: body.interviews.map((item) => parseInterview(item, fallback)),
    page: requireInteger(body.page, fallback),
    limit: requireInteger(body.limit, fallback),
    total: requireInteger(body.total, fallback),
    totalPages: requireInteger(body.totalPages, fallback),
  }
}

export function userFacingInterviewError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage interviews.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403 && error.message === COMPANY_PROFILE_REQUIRED) {
      return COMPANY_PROFILE_REQUIRED
    }
    if (error.status === 403) {
      return 'You cannot manage these interviews with this account.'
    }
    if (error.status === 404 || error.message === 'Not found') {
      return 'This interview is not available.'
    }
    if (
      error.message === INTERVIEW_CANNOT_BE_UPDATED
      || error.message === INTERVIEW_CANNOT_BE_CREATED
      || error.message === COMPANY_PROFILE_REQUIRED
      || error.message === 'Invalid request'
    ) {
      return error.message
    }
  }
  return INTERVIEWS_UNAVAILABLE
}

async function requestInterviews(path, options = {}) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(INTERVIEWS_UNAVAILABLE, 500)
  }
}

function requireInterviewPayload(payload) {
  return parseInterview(payload?.interview)
}

export async function fetchMyInterviews({ status, jobId, applicationId, page, limit, signal } = {}) {
  const payload = await requestInterviews(
    `/api/me/interviews${buildSearchParams({ status, jobId, applicationId, page, limit })}`,
    { signal },
  )
  return parseInterviewPage(payload)
}

export async function fetchMyInterview(id, { signal } = {}) {
  if (!isInterviewId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestInterviews(`/api/me/interviews/${encodeURIComponent(id)}`, { signal })
  return requireInterviewPayload(payload)
}

export async function acceptMyInterview(id) {
  const payload = await requestInterviews(`/api/me/interviews/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
    body: {},
    mutate: true,
  })
  return requireInterviewPayload(payload)
}

export async function declineMyInterview(id, { candidateResponseNote } = {}) {
  const body = {}
  if (typeof candidateResponseNote === 'string' && candidateResponseNote.trim()) {
    body.candidateResponseNote = candidateResponseNote.trim().slice(0, INTERVIEW_RESPONSE_NOTE_MAX)
  }
  const payload = await requestInterviews(`/api/me/interviews/${encodeURIComponent(id)}/decline`, {
    method: 'POST',
    body,
    mutate: true,
  })
  return requireInterviewPayload(payload)
}

export async function rescheduleMyInterview(id, { requestedStartAt, requestedDurationMinutes, candidateResponseNote }) {
  const body = { requestedStartAt }
  if (Number.isInteger(requestedDurationMinutes)) {
    body.requestedDurationMinutes = requestedDurationMinutes
  }
  if (typeof candidateResponseNote === 'string' && candidateResponseNote.trim()) {
    body.candidateResponseNote = candidateResponseNote.trim().slice(0, INTERVIEW_RESPONSE_NOTE_MAX)
  }
  const payload = await requestInterviews(`/api/me/interviews/${encodeURIComponent(id)}/reschedule`, {
    method: 'POST',
    body,
    mutate: true,
  })
  return requireInterviewPayload(payload)
}

export async function fetchEmployerInterviews({ status, jobId, applicationId, page, limit, signal } = {}) {
  const payload = await requestInterviews(
    `/api/employer/interviews${buildSearchParams({ status, jobId, applicationId, page, limit })}`,
    { signal },
  )
  return parseInterviewPage(payload)
}

export async function fetchEmployerInterview(id, { signal } = {}) {
  if (!isInterviewId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestInterviews(`/api/employer/interviews/${encodeURIComponent(id)}`, { signal })
  return requireInterviewPayload(payload)
}

export async function fetchEmployerInterviewStats({ signal } = {}) {
  const payload = await requestInterviews('/api/employer/interviews/stats', { signal })
  return parseEmployerInterviewStats(payload)
}

export async function createEmployerInterview(body) {
  const payload = await requestInterviews('/api/employer/interviews', {
    method: 'POST',
    body,
    mutate: true,
  })
  return requireInterviewPayload(payload)
}

export async function updateEmployerInterviewSchedule(id, body) {
  const payload = await requestInterviews(`/api/employer/interviews/${encodeURIComponent(id)}/update-schedule`, {
    method: 'POST',
    body,
    mutate: true,
  })
  return requireInterviewPayload(payload)
}

export async function confirmEmployerInterviewReschedule(id) {
  const payload = await requestInterviews(`/api/employer/interviews/${encodeURIComponent(id)}/confirm-reschedule`, {
    method: 'POST',
    body: {},
    mutate: true,
  })
  return requireInterviewPayload(payload)
}

export async function cancelEmployerInterview(id) {
  const payload = await requestInterviews(`/api/employer/interviews/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: {},
    mutate: true,
  })
  return requireInterviewPayload(payload)
}

export async function completeEmployerInterview(id, body) {
  const payload = await requestInterviews(`/api/employer/interviews/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body,
    mutate: true,
  })
  return requireInterviewPayload(payload)
}

export async function fetchAdminInterviewStats({ signal } = {}) {
  const payload = await requestInterviews('/api/admin/interviews/stats', { signal })
  return parseAdminInterviewStats(payload)
}

export { formatJobDateTime, isAbortError }
