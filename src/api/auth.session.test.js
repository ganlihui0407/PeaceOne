import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { fetchCurrentUser } from './auth.js'
import { ACCOUNT_UNAVAILABLE_ERROR } from '../auth/sessionStatus.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('fetchCurrentUser treats 401 as an anonymous session', async () => {
  globalThis.fetch = async () => jsonResponse(401, { error: 'Unauthenticated' })
  const result = await fetchCurrentUser()
  assert.equal(result.status, 'unauthenticated')
  assert.equal(result.user, null)
})

test('fetchCurrentUser treats suspended 403 as unavailable and clears authenticated state', async () => {
  globalThis.fetch = async () => jsonResponse(403, { error: ACCOUNT_UNAVAILABLE_ERROR })
  const result = await fetchCurrentUser()
  assert.equal(result.status, 'unavailable')
  assert.equal(result.user, null)
})

test('login page does not claim password recovery is available', () => {
  const login = readFileSync(fileURLToPath(new URL('../pages/public/Login.jsx', import.meta.url)), 'utf8')
  assert.equal(login.includes('Password recovery is not available in this prototype.'), true)
  assert.equal(login.includes('/api/auth/reset'), false)
  assert.equal(login.includes('resetToken'), false)
})

test('fetchCurrentUser does not treat a Forbidden 403 as logout', async () => {
  globalThis.fetch = async () => jsonResponse(403, { error: 'Forbidden' })
  await assert.rejects(() => fetchCurrentUser(), (err) => err.status === 403 && err.message === 'Forbidden')
})
