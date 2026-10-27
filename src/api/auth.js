import { apiRequest, clearCsrfToken } from './client.js'

export async function fetchCurrentUser() {
  try {
    const payload = await apiRequest('/api/auth/me')
    return payload?.user ?? null
  } catch (err) {
    if (err.status === 401) {
      return null
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
