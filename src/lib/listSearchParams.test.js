import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compactSearchParams, parsePositivePage } from './listSearchParams.js'

test('compactSearchParams omits empty values and page 1', () => {
  assert.deepEqual(
    compactSearchParams({ q: 'sql', company: '', location: 'KL', employmentType: '', page: 1 }),
    { q: 'sql', location: 'KL' },
  )
  assert.deepEqual(compactSearchParams({ q: 'sql', page: 2 }), { q: 'sql', page: '2' })
})

test('parsePositivePage falls back to 1', () => {
  assert.equal(parsePositivePage('3'), 3)
  assert.equal(parsePositivePage('0'), 1)
  assert.equal(parsePositivePage('nope'), 1)
  assert.equal(parsePositivePage(undefined), 1)
})
