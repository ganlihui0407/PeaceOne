import { interpretCurrentUserError } from '../auth/sessionStatus.js'
import { apiRequest, clearCsrfToken } from './client.js'

export async function fetchCurrentUser() {
  try {
    const payload = await apiRequest('/api/auth/me')
    return { user: payload?.user ?? null, status: 'ok' }
  } catch (err) {
    const status = interpretCurrentUserError(err)
    if (status === 'unauthenticated' || status === 'unavailable') {
      return { user: null, status }
    }
    throw err
  }
}

export async function registerAccount(input) {
  const payload = await apiRequest('/api/auth/register', {
    method: 'POST',
    mutate: true,
    body: input,
  })
  return payload.user
}

export async function loginAccount(input) {
  const payload = await apiRequest('/api/auth/login', {
    method: 'POST',
    mutate: true,
    body: input,
  })
  return payload.user
}

export async function logoutAccount() {
  await apiRequest('/api/auth/logout', {
    method: 'POST',
    mutate: true,
    body: {},
  })
  clearCsrfToken()
}
