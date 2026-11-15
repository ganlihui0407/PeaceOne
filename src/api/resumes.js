import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiDownload, apiRequest } from './client.js'
import { isAbortError } from './esco.js'
import { RESUME_TEMPLATE_KEYS } from './resumeTemplates.js'

export const RESUMES_UNAVAILABLE = 'Resume data is unavailable right now.'
export const RESUME_LIMIT_REACHED = 'Resume limit reached'
export const MAX_RESUMES_PER_USER = 5
export const RESUME_TITLE_MAX = 150
export { RESUME_TEMPLATE_KEYS }
export const RESUME_SKILL_PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced']
export const RESUME_YEAR_MIN = 1950
export const RESUME_YEAR_MAX = 2100
export const RESUME_FIELD_LIMITS = {
  title: RESUME_TITLE_MAX,
  summary: 4000,
  fullName: 100,
  email: 254,
  phone: 30,
  location: 100,
  institution: 150,
  qualification: 150,
  fieldOfStudy: 100,
  notes: 2000,
  jobTitle: 100,
  organization: 150,
  description: 4000,
  skillLabel: 150,
  certificationName: 150,
  issuer: 150,
  credentialId: 100,
}
export const RESUME_SECTION_LIMITS = {
  education: 20,
  experience: 30,
  skills: 50,
  certifications: 20,
}
export const RESUME_CERT_STORAGE_COPY =
  'PeaceOne stores the year issued. Expiry date and credential URL are not stored yet.'
export const RESUME_UNSAVED_COPY = 'You have unsaved resume changes. Leave this page?'
export const RESUME_PDF_UNSAVED_COPY =
  'Save your resume before downloading the PDF. The generated file uses the last saved version.'
export const RESUME_PDF_UNAVAILABLE = 'The resume PDF could not be generated.'
export const RESUME_EMPTY = {
  title: 'No resume is saved yet.',
  description: 'Create a resume to keep a copy of your contact details and career sections.',
}
export const RESUME_LIMIT_COPY = 'You can save up to 5 resumes.'
export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024
export const RESUME_FILE_ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const RESUME_FILE_TYPES_COPY = 'PDF or DOCX, up to 5 MB.'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireObject(value, fallback = RESUMES_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireString(value, fallback = RESUMES_UNAVAILABLE) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalString(value, fallback = RESUMES_UNAVAILABLE) {
  if (value == null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireBoolean(value, fallback = RESUMES_UNAVAILABLE) {
  if (typeof value !== 'boolean') {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireCount(value, fallback = RESUMES_UNAVAILABLE) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireTemplateKey(value, fallback = RESUMES_UNAVAILABLE) {
  const key = requireString(value, fallback)
  if (!RESUME_TEMPLATE_KEYS.includes(key)) {
    throw new ApiError(fallback, 500)
  }
  return key
}

function requireArray(value, fallback = RESUMES_UNAVAILABLE) {
  if (!Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalYear(value, fallback = RESUMES_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  if (!Number.isInteger(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalBoolean(value, fallback = RESUMES_UNAVAILABLE) {
  if (value == null) {
    return false
  }
  return requireBoolean(value, fallback)
}

export function isResumeId(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function resumeEditorPath(basePath, id) {
  return `${basePath}/resume/${encodeURIComponent(id)}`
}

function parseEducationItem(value, fallback = RESUMES_UNAVAILABLE) {
  const item = requireObject(value, fallback)
  return {
    institution: requireString(item.institution, fallback),
    qualification: optionalString(item.qualification, fallback),
    fieldOfStudy: optionalString(item.fieldOfStudy, fallback),
    startYear: optionalYear(item.startYear, fallback),
    endYear: optionalYear(item.endYear, fallback),
    notes: optionalString(item.notes, fallback),
  }
}

function parseExperienceItem(value, fallback = RESUMES_UNAVAILABLE) {
  const item = requireObject(value, fallback)
  return {
    jobTitle: requireString(item.jobTitle, fallback),
    organization: requireString(item.organization, fallback),
    location: optionalString(item.location, fallback),
    startDate: optionalString(item.startDate, fallback),
    endDate: optionalString(item.endDate, fallback),
    isCurrent: optionalBoolean(item.isCurrent, fallback),
    description: optionalString(item.description, fallback),
  }
}

function parseSkillItem(value, fallback = RESUMES_UNAVAILABLE) {
  const item = requireObject(value, fallback)
  return {
    skillId: optionalString(item.skillId, fallback),
    label: requireString(item.label, fallback),
    proficiencyLevel: optionalString(item.proficiencyLevel, fallback),
  }
}

function parseCertificationItem(value, fallback = RESUMES_UNAVAILABLE) {
  const item = requireObject(value, fallback)
  return {
    name: requireString(item.name, fallback),
    issuer: optionalString(item.issuer, fallback),
    year: optionalYear(item.year, fallback),
    credentialId: optionalString(item.credentialId, fallback),
  }
}

export function parseResumeSummary(value, fallback = RESUMES_UNAVAILABLE) {
  const record = requireObject(value, fallback)
  return {
    id: requireString(record.id, fallback),
    title: requireString(record.title, fallback),
    templateKey: requireTemplateKey(record.templateKey, fallback),
    isPrimary: requireBoolean(record.isPrimary, fallback),
    fullName: requireString(record.fullName, fallback),
    educationCount: requireCount(record.educationCount, fallback),
    experienceCount: requireCount(record.experienceCount, fallback),
    skillCount: requireCount(record.skillCount, fallback),
    certificationCount: requireCount(record.certificationCount, fallback),
    file: parseResumeFile(record.file, fallback),
    createdAt: requireString(record.createdAt, fallback),
    updatedAt: requireString(record.updatedAt, fallback),
  }
}

export function parseResume(value, fallback = RESUMES_UNAVAILABLE) {
  const record = requireObject(value, fallback)
  return {
    id: requireString(record.id, fallback),
    title: requireString(record.title, fallback),
    summary: optionalString(record.summary, fallback),
    templateKey: requireTemplateKey(record.templateKey, fallback),
    isPrimary: requireBoolean(record.isPrimary, fallback),
    fullName: requireString(record.fullName, fallback),
    email: requireString(record.email, fallback),
    phone: optionalString(record.phone, fallback),
    location: optionalString(record.location, fallback),
    education: requireArray(record.education, fallback).map((item) => parseEducationItem(item, fallback)),
    experience: requireArray(record.experience, fallback).map((item) => parseExperienceItem(item, fallback)),
    skills: requireArray(record.skills, fallback).map((item) => parseSkillItem(item, fallback)),
    certifications: requireArray(record.certifications, fallback).map((item) =>
      parseCertificationItem(item, fallback),
    ),
    file: parseResumeFile(record.file, fallback),
    createdAt: requireString(record.createdAt, fallback),
    updatedAt: requireString(record.updatedAt, fallback),
  }
}

export function parseResumeFile(value, fallback = RESUMES_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  const record = requireObject(value, fallback)
  if (record.storedFilename !== undefined || record.path !== undefined) {
    throw new ApiError(fallback, 500)
  }
  const byteSize = requireCount(record.byteSize, fallback)
  if (byteSize < 1) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(record.id, fallback),
    originalFilename: requireString(record.originalFilename, fallback),
    contentType: requireString(record.contentType, fallback),
    byteSize,
    sha256: requireString(record.sha256, fallback),
    createdAt: requireString(record.createdAt, fallback),
    updatedAt: requireString(record.updatedAt, fallback),
  }
}

export function parseResumeList(payload, fallback = RESUMES_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  if (!Array.isArray(body.items)) {
    throw new ApiError(fallback, 500)
  }
  return body.items.map((item) => parseResumeSummary(item, fallback))
}

export function buildCreateResume(input = {}) {
  if (typeof input.title !== 'string') {
    throw new ApiError('Invalid request', 400)
  }
  const title = input.title.trim()
  if (!title || title.length > RESUME_TITLE_MAX) {
    throw new ApiError('Invalid request', 400)
  }
  return { title }
}

export function formatResumeUpdatedAt(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export function atResumeLimit(items) {
  return Array.isArray(items) && items.length >= MAX_RESUMES_PER_USER
}

export function userFacingResumeError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage your resumes.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot manage resumes with this account.'
    }
    if (error.status === 409 && error.message === RESUME_LIMIT_REACHED) {
      return RESUME_LIMIT_COPY
    }
    if (error.message === 'Invalid request' || error.message === 'Not found') {
      return error.message
    }
  }
  return RESUMES_UNAVAILABLE
}

export function userFacingResumeEditorError(error) {
  const message = userFacingResumeError(error)
  if (message === 'Not found' || message === 'Invalid request') {
    return 'This resume is not available.'
  }
  return message
}

export function userFacingResumePdfError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to download this resume PDF.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot download resume PDFs with this account.'
    }
    if (error.status === 404) {
      return 'This resume is not available.'
    }
  }
  return RESUME_PDF_UNAVAILABLE
}

export function formatResumeFileSize(bytes) {
  if (!Number.isInteger(bytes) || bytes < 0) {
    return '—'
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function validateResumeFileSelection(file) {
  if (!file || typeof file !== 'object') {
    throw new ApiError('Invalid request', 400)
  }
  const size = typeof file.size === 'number' ? file.size : 0
  if (size === 0) {
    throw new ApiError('File is empty', 400)
  }
  if (size > MAX_RESUME_FILE_BYTES) {
    throw new ApiError('File too large', 413)
  }
  const name = typeof file.name === 'string' ? file.name : ''
  if (!/\.(pdf|docx)$/i.test(name)) {
    throw new ApiError('Unsupported file format', 400)
  }
  return file
}

export function userFacingResumeFileError(error, action = 'upload') {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage your resumes.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot manage resumes with this account.'
    }
    if (error.message === 'Unsupported file format') {
      return 'Unsupported format. Use a PDF or DOCX file.'
    }
    if (error.message === 'File too large') {
      return 'File too large. The maximum size is 5 MB.'
    }
    if (error.message === 'File is empty') {
      return 'The selected file is empty.'
    }
    if (error.message === 'Corrupted file') {
      return 'This file appears to be corrupted.'
    }
    if (error.message === 'File is unavailable') {
      return 'Download unavailable.'
    }
    if (error.message === 'Not found') {
      return action === 'download' ? 'Download unavailable.' : 'This resume file is not available.'
    }
    if (error.message === 'Invalid request') {
      return 'The selected file could not be uploaded.'
    }
  }
  if (action === 'download') {
    return 'Download unavailable.'
  }
  if (action === 'remove') {
    return 'The uploaded file could not be removed. Try again.'
  }
  return 'Upload failed. Try again.'
}

export function filenameFromDisposition(header) {
  if (typeof header !== 'string' || header.length === 0) {
    return null
  }
  const star = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (star) {
    try {
      return decodeURIComponent(star[1])
    } catch {
      return star[1]
    }
  }
  const quoted = header.match(/filename="([^"]+)"/i)
  return quoted ? quoted[1] : null
}

export function saveBlobAsFile(blob, filename) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename || 'resume'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

async function requestResume(path, options = {}) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(RESUMES_UNAVAILABLE, 500)
  }
}

function requireResumeId(id) {
  if (!isResumeId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  return id
}

export async function fetchResumes({ signal } = {}) {
  const payload = await requestResume('/api/me/resumes', { signal })
  return parseResumeList(payload)
}

export async function fetchResume(id, { signal } = {}) {
  const resumeId = requireResumeId(id)
  const payload = await requestResume(`/api/me/resumes/${encodeURIComponent(resumeId)}`, { signal })
  const resume = parseResume(payload?.resume)
  if (!resume) {
    throw new ApiError(RESUMES_UNAVAILABLE, 500)
  }
  return resume
}

export async function createResume({ title, signal } = {}) {
  const payload = await requestResume('/api/me/resumes', {
    method: 'POST',
    mutate: true,
    body: buildCreateResume({ title }),
    signal,
  })
  return parseResume(payload?.resume)
}

export async function setPrimaryResume(id, { signal } = {}) {
  const resumeId = requireResumeId(id)
  const payload = await requestResume(`/api/me/resumes/${encodeURIComponent(resumeId)}/primary`, {
    method: 'POST',
    mutate: true,
    body: {},
    signal,
  })
  return parseResume(payload?.resume)
}

export async function updateResume(id, body, { signal } = {}) {
  const resumeId = requireResumeId(id)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestResume(`/api/me/resumes/${encodeURIComponent(resumeId)}`, {
    method: 'PUT',
    mutate: true,
    body,
    signal,
  })
  return parseResume(payload?.resume)
}

export async function deleteResume(id, { signal } = {}) {
  const resumeId = requireResumeId(id)
  const payload = await requestResume(`/api/me/resumes/${encodeURIComponent(resumeId)}`, {
    method: 'DELETE',
    mutate: true,
    signal,
  })
  if (payload?.ok !== true) {
    throw new ApiError(RESUMES_UNAVAILABLE, 500)
  }
  return true
}

export async function uploadResumeFile(id, file, { signal } = {}) {
  const resumeId = requireResumeId(id)
  const selected = validateResumeFileSelection(file)
  const formData = new FormData()
  formData.append('file', selected)
  const payload = await requestResume(`/api/me/resumes/${encodeURIComponent(resumeId)}/file`, {
    method: 'POST',
    mutate: true,
    formData,
    signal,
  })
  const parsed = parseResumeFile(payload?.file)
  if (!parsed) {
    throw new ApiError(RESUMES_UNAVAILABLE, 500)
  }
  return {
    file: parsed,
    unchanged: payload?.unchanged === true,
  }
}

export async function downloadResumeFile(id, { signal } = {}) {
  const resumeId = requireResumeId(id)
  try {
    const response = await apiDownload(`/api/me/resumes/${encodeURIComponent(resumeId)}/file`, { signal })
    const blob = await response.blob()
    const filename =
      filenameFromDisposition(response.headers.get('Content-Disposition')) || 'resume'
    return {
      blob,
      filename,
      contentType: response.headers.get('Content-Type') || '',
    }
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError('File is unavailable', 500)
  }
}

export async function downloadResumePdf(id, { signal } = {}) {
  const resumeId = requireResumeId(id)
  try {
    const response = await apiDownload(`/api/me/resumes/${encodeURIComponent(resumeId)}/pdf`, { signal })
    const blob = await response.blob()
    const filename =
      filenameFromDisposition(response.headers.get('Content-Disposition')) || 'resume.pdf'
    return {
      blob,
      filename,
      contentType: response.headers.get('Content-Type') || '',
    }
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(RESUME_PDF_UNAVAILABLE, 500)
  }
}

export async function deleteResumeFile(id, { signal } = {}) {
  const resumeId = requireResumeId(id)
  const payload = await requestResume(`/api/me/resumes/${encodeURIComponent(resumeId)}/file`, {
    method: 'DELETE',
    mutate: true,
    signal,
  })
  if (payload?.ok !== true) {
    throw new ApiError(RESUMES_UNAVAILABLE, 500)
  }
  return true
}

export { isAbortError }
