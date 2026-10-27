export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let csrfToken = null

export function setCsrfToken(token) {
  csrfToken = typeof token === 'string' && token.length > 0 ? token : null
}

export function clearCsrfToken() {
  csrfToken = null
}

async function readJson(response) {
  const text = await response.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function refreshCsrfToken() {
  const response = await fetch('/api/csrf-token', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const body = await readJson(response)
  if (!response.ok || typeof body?.csrfToken !== 'string') {
    throw new ApiError('Unable to start a secure request.', response.status || 500)
  }
  setCsrfToken(body.csrfToken)
  return body.csrfToken
}

export async function apiRequest(path, { method = 'GET', body, mutate = false, signal } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  async function send(token) {
    const requestHeaders = { ...headers }
    if (mutate) {
      requestHeaders['x-csrf-token'] = token
    }
    return fetch(path, {
      method,
      credentials: 'include',
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  }

  let response
  if (mutate) {
    const token = csrfToken ?? (await refreshCsrfToken())
    response = await send(token)
    if (response.status === 403) {
      const retryToken = await refreshCsrfToken()
      response = await send(retryToken)
    }
  } else {
    response = await send()
  }

  const payload = await readJson(response)
  if (typeof payload?.csrfToken === 'string') {
    setCsrfToken(payload.csrfToken)
  }

  if (!response.ok) {
    const message =
      typeof payload?.error === 'string' && payload.error.length > 0
        ? payload.error
        : 'Request failed'
    throw new ApiError(message, response.status)
  }

  return payload
}
