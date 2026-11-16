import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

test('paged search resets to page 1 when extra filter params change', () => {
  const source = readFileSync(fileURLToPath(new URL('./useEscoPagedSearch.js', import.meta.url)), 'utf8')
  assert.equal(source.includes('extraKeyRef'), true)
  assert.equal(source.includes('setPage(1)'), true)
  assert.equal(source.includes('if (extraKeyRef.current !== extraKey)'), true)
  assert.equal(source.includes('if (!pageIsControlled && page !== 1)'), true)
  assert.equal(source.includes('seqRef'), true)
  assert.equal(source.includes('appliedQuery'), true)
  assert.equal(source.includes('appliedPage'), true)
  assert.equal(source.includes('pageIsControlled'), true)
})

test('workspace header no longer renders an inert global search field', () => {
  const header = readFileSync(fileURLToPath(new URL('../components/layout/TopHeader.jsx', import.meta.url)), 'utf8')
  const layout = readFileSync(fileURLToPath(new URL('../components/layout/AppLayout.jsx', import.meta.url)), 'utf8')
  assert.equal(header.includes('placeholder="Search"'), false)
  assert.equal(header.includes('type="search"'), false)
  assert.equal(header.includes('showSearch'), false)
  assert.equal(layout.includes('showSearch'), false)
})
