import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
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

test('fetchCurrentUser does not treat a Forbidden 403 as logout', async () => {
  globalThis.fetch = async () => jsonResponse(403, { error: 'Forbidden' })
  await assert.rejects(() => fetchCurrentUser(), (err) => err.status === 403 && err.message === 'Forbidden')
})
