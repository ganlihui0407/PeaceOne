import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiRequest } from './client.js'
import { isAbortError } from './esco.js'

export const ADMIN_PLATFORM_UNAVAILABLE = 'Administrator statistics are unavailable right now.'

function requireObject(value, fallback = ADMIN_PLATFORM_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

export function userFacingAdminPlatformError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to view administrator data.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot view this administrator page with this account.'
    }
    if (error.message === 'Invalid request' || error.message === 'Not found') {
      return error.message
    }
  }
  return ADMIN_PLATFORM_UNAVAILABLE
}

async function requestAdminPlatform(path, options = {}) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(ADMIN_PLATFORM_UNAVAILABLE, 500)
  }
}

export async function fetchAdminPlatformStats({ signal } = {}) {
  return requireObject(await requestAdminPlatform('/api/admin/stats', { signal }))
}

export async function fetchAdminReports({ signal } = {}) {
  return requireObject(await requestAdminPlatform('/api/admin/reports', { signal }))
}

export async function fetchAdminContentMonitoring({ signal } = {}) {
  return requireObject(await requestAdminPlatform('/api/admin/content-monitoring', { signal }))
}
