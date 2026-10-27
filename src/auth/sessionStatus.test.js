import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../api/client.js'
import { ACCOUNT_UNAVAILABLE_ERROR, interpretCurrentUserError } from './sessionStatus.js'

test('401 is unauthenticated and does not mark the account unavailable', () => {
  assert.equal(interpretCurrentUserError(new ApiError('Unauthenticated', 401)), 'unauthenticated')
})

test('403 Account is unavailable is a suspended session', () => {
  assert.equal(
    interpretCurrentUserError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)),
    'unavailable',
  )
})

test('role-mismatch 403 does not log the user out', () => {
  assert.equal(interpretCurrentUserError(new ApiError('Forbidden', 403)), 'error')
  assert.equal(interpretCurrentUserError(new ApiError('Invalid CSRF token', 403)), 'error')
})
