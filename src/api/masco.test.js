import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ApiError } from './client.js'
import {
  MASCO_LIST_LIMIT,
  MASCO_MAPPING_STATUSES,
  MASCO_UNAVAILABLE,
  fetchMascoCrosswalks,
  fetchMascoOccupation,
  fetchMascoOccupationCrosswalks,
  fetchMascoOccupations,
  formatMascoStatusLabel,
  formatRecordScope,
  isAbortError,
  isMascoInvalidRequestError,
  isMascoNotFoundError,
  isMascoOccupationCode,
  isMascoUnitGroupCode,
  mappingStatusTone,
  mascoCrosswalksPath,
  mascoOccupationPath,
  mascoOccupationsPath,
  parseMascoCrosswalk,
  parseMascoOccupationCrosswalks,
  parseMascoOccupationDetail,
  parseMascoOccupationSummary,
  recordScopeTone,
  sourceMetadataEntries,
  userFacingLoadError,
} from './masco.js'
import { parsePagedList } from './esco.js'

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

function unitGroup(overrides = {}) {
  return {
    code: '2411',
    title: 'Accountants',
    ...overrides,
  }
}

function occupationSummary(overrides = {}) {
  return {
    code: '2411-01',
    title: 'Accountant',
    classification: 'MASCO',
    version: '2020',
    recordScope: 'V4_EXAMPLE',
    unitGroup: unitGroup(),
    ...overrides,
  }
}

test('isMascoOccupationCode accepts official MASCO occupation codes only', () => {
  assert.equal(isMascoOccupationCode('2411-01'), true)
  assert.equal(isMascoOccupationCode('9999-99'), true)
  assert.equal(isMascoOccupationCode('2411'), false)
  assert.equal(isMascoOccupationCode('2411-1'), false)
  assert.equal(isMascoOccupationCode('not-a-code'), false)
  assert.equal(isMascoOccupationCode('11111111-1111-4111-8111-111111111111'), false)
})

test('isMascoUnitGroupCode accepts 4-digit unit group codes only', () => {
  assert.equal(isMascoUnitGroupCode('2411'), true)
  assert.equal(isMascoUnitGroupCode('0000'), true)
  assert.equal(isMascoUnitGroupCode('241'), false)
  assert.equal(isMascoUnitGroupCode('24111'), false)
  assert.equal(isMascoUnitGroupCode('2411-01'), false)
  assert.equal(isMascoUnitGroupCode(''), false)
})

test('admin catalogue paths stay under /admin/masco', () => {
  assert.equal(mascoOccupationsPath(), '/admin/masco')
  assert.equal(mascoOccupationPath('2411-01'), '/admin/masco/2411-01')
  assert.equal(mascoCrosswalksPath(), '/admin/masco/crosswalks')
  assert.equal(MASCO_LIST_LIMIT <= 50, true)
})

test('fetchMascoOccupations uses the relative /api proxy path with search and pagination', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    return jsonResponse(200, {
      items: [occupationSummary()],
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    })
  }

  const result = await fetchMascoOccupations({ q: 'accountant', page: 2, limit: 20 })
  assert.equal(calls[0].path, '/api/masco/occupations?q=accountant&page=2&limit=20')
  assert.equal(calls[0].method, 'GET')
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].title, 'Accountant')
  assert.equal(result.items[0].code, '2411-01')
  assert.equal(result.items[0].unitGroup.code, '2411')
  assert.equal(result.page, 2)
  assert.equal(result.totalPages, 3)
})

test('fetchMascoOccupations sends unit group and scope filters and omits empty values', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    return jsonResponse(200, {
      items: [occupationSummary({ recordScope: 'SUPPLEMENTAL_INDEX' })],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    })
  }

  const result = await fetchMascoOccupations({
    q: '',
    unitGroup: '2411',
    scope: 'SUPPLEMENTAL_INDEX',
    page: 1,
    limit: 20,
  })
  assert.equal(calls[0], '/api/masco/occupations?unitGroup=2411&scope=SUPPLEMENTAL_INDEX&page=1&limit=20')
  assert.equal(result.items[0].recordScope, 'SUPPLEMENTAL_INDEX')
  assert.equal(formatRecordScope(result.items[0].recordScope), 'Supplemental index')
})

test('fetchMascoOccupations rejects invalid list payloads instead of using mock data', async () => {
  globalThis.fetch = async () => jsonResponse(200, { items: 'nope', page: 1, limit: 20, total: 1, totalPages: 1 })
  await assert.rejects(() => fetchMascoOccupations(), (error) => {
    return error instanceof ApiError && error.message === MASCO_UNAVAILABLE.occupations
  })
})

test('fetchMascoOccupation loads details by occupation code', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    return jsonResponse(200, {
      occupation: occupationSummary({
        unitGroup: unitGroup({
          description: 'Prepare and examine financial records.',
          tasks: 'Examine accounts and prepare reports.',
        }),
        sourceMetadata: { sheet: 'V4', testFixture: true },
      }),
    })
  }

  const occupation = await fetchMascoOccupation('2411-01')
  assert.equal(calls[0], '/api/masco/occupations/2411-01')
  assert.equal(occupation.title, 'Accountant')
  assert.equal(occupation.unitGroup.description, 'Prepare and examine financial records.')
  assert.equal(occupation.unitGroup.tasks, 'Examine accounts and prepare reports.')
  assert.equal(occupation.sourceMetadata.sheet, 'V4')
  assert.equal(formatRecordScope(occupation.recordScope), 'V4 example')
  assert.equal(recordScopeTone(occupation.recordScope), 'info')
})

test('fetchMascoOccupation surfaces unknown occupations as not found', async () => {
  globalThis.fetch = async () => jsonResponse(404, { error: 'Not found' })
  await assert.rejects(
    () => fetchMascoOccupation('9999-99'),
    (error) =>
      error instanceof ApiError &&
      error.status === 404 &&
      error.message === 'Not found' &&
      isMascoNotFoundError(error),
  )
  assert.equal(userFacingLoadError(new ApiError('Not found', 404), MASCO_UNAVAILABLE.occupation), 'Not found')
})

test('fetchMascoOccupation rejects invalid codes without calling the API', async () => {
  let called = false
  globalThis.fetch = async () => {
    called = true
    return jsonResponse(200, { occupation: occupationSummary() })
  }

  await assert.rejects(
    () => fetchMascoOccupation('not-a-code'),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.message === 'Invalid request' &&
      isMascoInvalidRequestError(error),
  )
  assert.equal(called, false)
})

test('empty MASCO occupation lists are valid responses', () => {
  const occupations = parsePagedList(
    { items: [], page: 1, limit: 20, total: 0, totalPages: 0 },
    parseMascoOccupationSummary,
    MASCO_UNAVAILABLE.occupations,
  )
  assert.equal(occupations.items.length, 0)
  assert.equal(occupations.total, 0)
})

test('occupation parsers reject missing required fields instead of inventing data', () => {
  assert.throws(
    () => parseMascoOccupationSummary({ title: 'Accountant' }),
    (error) => error instanceof ApiError && error.message === MASCO_UNAVAILABLE.occupations,
  )
  assert.throws(
    () => parseMascoOccupationDetail({ ...occupationSummary(), sourceMetadata: ['not-an-object'] }),
    (error) => error instanceof ApiError && error.message === MASCO_UNAVAILABLE.occupation,
  )
  const detail = parseMascoOccupationDetail(occupationSummary())
  assert.equal(detail.sourceMetadata, null)
  assert.equal(detail.unitGroup.description, null)
  assert.equal(formatRecordScope('UNEXPECTED'), 'Unknown')
})

test('API errors do not leak internal details and do not fall back to mock records', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'ECONNRESET secret-dsn' })
  await assert.rejects(
    () => fetchMascoOccupations(),
    (error) => error instanceof ApiError && error.message === 'ECONNRESET secret-dsn',
  )
  assert.equal(
    userFacingLoadError(new ApiError('ECONNRESET secret-dsn', 500), MASCO_UNAVAILABLE.occupations),
    MASCO_UNAVAILABLE.occupations,
  )
  assert.equal(userFacingLoadError(new ApiError('Not found', 404), MASCO_UNAVAILABLE.occupation), 'Not found')
  assert.equal(userFacingLoadError(new ApiError('Invalid request', 400), MASCO_UNAVAILABLE.occupations), 'Invalid request')
})

test('aborted MASCO occupation searches are ignored as stale', async () => {
  const controller = new AbortController()
  globalThis.fetch = async (_path, init) => {
    if (init.signal?.aborted) {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      throw error
    }
    return jsonResponse(200, { items: [], page: 1, limit: 20, total: 0, totalPages: 0 })
  }
  controller.abort()
  await assert.rejects(
    () => fetchMascoOccupations({ q: 'accountant', signal: controller.signal }),
    (error) => isAbortError(error),
  )
  assert.equal(userFacingLoadError({ name: 'AbortError' }, MASCO_UNAVAILABLE.occupations), '')
})

test('source metadata entries keep recorded keys and do not invent values', () => {
  assert.deepEqual(sourceMetadataEntries(null), [])
  assert.deepEqual(sourceMetadataEntries({ sheet: 'V4', testFixture: true }), [
    { key: 'sheet', value: 'V4' },
    { key: 'testFixture', value: 'true' },
  ])
})

test('the MASCO admin catalogue uses the live API and does not keep mock records', () => {
  const pagePath = fileURLToPath(new URL('../pages/admin/MascoOccupations.jsx', import.meta.url))
  const appPath = fileURLToPath(new URL('../App.jsx', import.meta.url))
  const navPath = fileURLToPath(new URL('../data/navigation.js', import.meta.url))
  const studentPath = fileURLToPath(new URL('../pages/shared/CareerTargetPage.jsx', import.meta.url))
  const page = readFileSync(pagePath, 'utf8')
  const app = readFileSync(appPath, 'utf8')
  const nav = readFileSync(navPath, 'utf8')
  const careerTarget = readFileSync(studentPath, 'utf8')

  assert.equal(page.includes('fetchMascoOccupations'), true)
  assert.equal(page.includes('Search MASCO occupations'), true)
  assert.equal(page.includes('Clear filters'), true)
  assert.equal(page.includes('View Details'), true)
  assert.equal(page.includes('isMascoUnitGroupCode'), true)
  assert.equal(page.includes('V4_EXAMPLE'), true)
  assert.equal(page.includes('SUPPLEMENTAL_INDEX'), true)
  assert.equal(page.includes('from \'../../data/'), false)
  assert.equal(page.includes('mock'), false)
  assert.equal(page.includes('career-target'), false)
  assert.equal(page.includes('skill-gap'), false)
  assert.equal(page.includes('fetchSavedSkills'), false)
  assert.equal(page.includes('fetchOccupations'), false)

  assert.equal(app.includes('path="masco"'), true)
  assert.equal(app.includes('path="masco/crosswalks"'), true)
  assert.equal(app.includes('path="masco/:code"'), true)
  assert.equal(app.includes('AdminMascoOccupations'), true)
  assert.equal(app.includes('AdminMascoOccupationDetails'), true)
  assert.equal(app.includes('AdminMascoCrosswalks'), true)
  assert.equal(nav.includes("to: '/admin/masco'"), true)
  assert.equal(nav.includes("to: '/admin/masco/crosswalks'"), true)
  assert.equal(nav.includes('MASCO Occupations'), true)
  assert.equal(nav.includes('MASCO Crosswalks'), true)
  assert.equal(nav.includes("to: '/student/masco'"), false)
  assert.equal(careerTarget.includes('fetchMascoOccupations'), false)
  assert.equal(careerTarget.includes('Search ESCO occupations'), true)
  assert.equal(careerTarget.includes('MASCO is a separate Malaysian classification catalogue'), true)
  assert.equal(careerTarget.includes('not used for Career Target, Skill Gap or course recommendations'), true)
})

test('the MASCO occupation detail page loads by URL code and handles missing records', () => {
  const pagePath = fileURLToPath(new URL('../pages/admin/MascoOccupationDetails.jsx', import.meta.url))
  const appPath = fileURLToPath(new URL('../App.jsx', import.meta.url))
  const page = readFileSync(pagePath, 'utf8')
  const app = readFileSync(appPath, 'utf8')

  assert.equal(page.includes('fetchMascoOccupation'), true)
  assert.equal(page.includes('useParams'), true)
  assert.equal(page.includes('isMascoOccupationCode'), true)
  assert.equal(page.includes('isMascoNotFoundError'), true)
  assert.equal(page.includes('Back to MASCO Catalogue'), true)
  assert.equal(page.includes('MASCO occupation not found'), true)
  assert.equal(page.includes('does not set Career Target, Skill Gap or course recommendations'), true)
  assert.equal(page.includes('Invalid MASCO occupation code'), true)
  assert.equal(page.includes('Loading MASCO occupation'), true)
  assert.equal(page.includes('onRetry'), true)
  assert.equal(page.includes('Occupational tasks'), true)
  assert.equal(page.includes('Source metadata'), true)
  assert.equal(page.includes('Unit group description'), true)
  assert.equal(page.includes('from \'../../data/'), false)
  assert.equal(page.includes('mock'), false)
  assert.equal(page.includes('career-target'), false)
  assert.equal(page.includes('skill-gap'), false)
  assert.equal(page.includes('fetchMascoOccupationCrosswalks'), true)
  assert.equal(page.includes('Historical crosswalks'), true)
  assert.equal(page.includes('No historical mappings recorded'), true)
  assert.equal(page.includes('fetchOccupations'), false)
  assert.equal(app.includes('path="masco/:code"'), true)
})

function crosswalkRecord(overrides = {}) {
  return {
    sourceVersion: '2013',
    targetVersion: '2020',
    historicalCode: '1219-01',
    currentCode: '1324-06',
    mappingStatus: 'VISUALLY_VERIFIED_FROM_SOURCE_ROW_CONTACT_SHEET',
    reviewDecision: 'PASS',
    sourceMetadata: { masco_2013_code: '1219-01' },
    ...overrides,
  }
}

test('fetchMascoCrosswalks uses the admin crosswalk path with search, filters and pagination', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    return jsonResponse(200, {
      items: [crosswalkRecord()],
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    })
  }

  const result = await fetchMascoCrosswalks({
    historicalCode: '1219-01',
    currentCode: '1324-06',
    mappingStatus: 'VISUALLY_VERIFIED_FROM_SOURCE_ROW_CONTACT_SHEET',
    page: 2,
    limit: 20,
  })
  assert.equal(
    calls[0].path,
    '/api/masco/crosswalks?historicalCode=1219-01&currentCode=1324-06&mappingStatus=VISUALLY_VERIFIED_FROM_SOURCE_ROW_CONTACT_SHEET&page=2&limit=20',
  )
  assert.equal(calls[0].method, 'GET')
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].historicalCode, '1219-01')
  assert.equal(result.items[0].currentCode, '1324-06')
  assert.equal(result.total, 41)
  assert.equal(result.page, 2)
  assert.equal(formatMascoStatusLabel(result.items[0].mappingStatus), 'VISUALLY VERIFIED FROM SOURCE ROW CONTACT SHEET')
  assert.equal(mappingStatusTone(result.items[0].mappingStatus), 'success')
})

test('fetchMascoCrosswalks omits empty filters and rejects invalid payloads', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    return jsonResponse(200, { items: [], page: 1, limit: 20, total: 0, totalPages: 0 })
  }

  const empty = await fetchMascoCrosswalks({ q: '', historicalCode: '', mappingStatus: '', page: 1, limit: 20 })
  assert.equal(calls[0], '/api/masco/crosswalks?page=1&limit=20')
  assert.equal(empty.items.length, 0)
  assert.equal(empty.total, 0)

  globalThis.fetch = async () => jsonResponse(200, { items: 'nope', page: 1, limit: 20, total: 1, totalPages: 1 })
  await assert.rejects(() => fetchMascoCrosswalks(), (error) => {
    return error instanceof ApiError && error.message === MASCO_UNAVAILABLE.crosswalks
  })
})

test('fetchMascoOccupationCrosswalks loads mappings for a MASCO 2020 occupation code', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    return jsonResponse(200, {
      occupation: { code: '1324-06', title: 'Purchasing Manager' },
      items: [crosswalkRecord()],
    })
  }

  const result = await fetchMascoOccupationCrosswalks('1324-06')
  assert.equal(calls[0], '/api/masco/occupations/1324-06/crosswalks')
  assert.equal(result.occupation.code, '1324-06')
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].sourceVersion, '2013')
  assert.equal(result.items[0].targetVersion, '2020')
})

test('fetchMascoOccupationCrosswalks rejects invalid codes without calling the API', async () => {
  let called = false
  globalThis.fetch = async () => {
    called = true
    return jsonResponse(200, { occupation: { code: '1324-06', title: 'Purchasing Manager' }, items: [] })
  }

  await assert.rejects(
    () => fetchMascoOccupationCrosswalks('not-a-code'),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.message === 'Invalid request' &&
      isMascoInvalidRequestError(error),
  )
  assert.equal(called, false)
})

test('empty occupation crosswalk lists are valid and parsers reject invented records', () => {
  const parsed = parseMascoOccupationCrosswalks({
    occupation: { code: '0111-01', title: 'Medical Officer' },
    items: [],
  })
  assert.equal(parsed.items.length, 0)
  assert.throws(
    () => parseMascoCrosswalk({ historicalCode: '1219-01' }),
    (error) => error instanceof ApiError && error.message === MASCO_UNAVAILABLE.crosswalks,
  )
  assert.equal(MASCO_MAPPING_STATUSES.includes('VISUALLY_VERIFIED_FROM_SOURCE_ROW_CONTACT_SHEET'), true)
})

test('crosswalk API errors stay user-facing and aborted requests are ignored', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'ECONNRESET secret-dsn' })
  await assert.rejects(
    () => fetchMascoCrosswalks(),
    (error) => error instanceof ApiError && error.message === 'ECONNRESET secret-dsn',
  )
  assert.equal(
    userFacingLoadError(new ApiError('ECONNRESET secret-dsn', 500), MASCO_UNAVAILABLE.crosswalks),
    MASCO_UNAVAILABLE.crosswalks,
  )
  assert.equal(userFacingLoadError(new ApiError('Unauthenticated', 401), MASCO_UNAVAILABLE.crosswalks), MASCO_UNAVAILABLE.crosswalks)
  assert.equal(userFacingLoadError(new ApiError('Forbidden', 403), MASCO_UNAVAILABLE.crosswalks), MASCO_UNAVAILABLE.crosswalks)

  const controller = new AbortController()
  globalThis.fetch = async (_path, init) => {
    if (init.signal?.aborted) {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      throw error
    }
    return jsonResponse(200, { items: [], page: 1, limit: 20, total: 0, totalPages: 0 })
  }
  controller.abort()
  await assert.rejects(
    () => fetchMascoCrosswalks({ historicalCode: '1219-01', signal: controller.signal }),
    (error) => isAbortError(error),
  )
})

test('the MASCO crosswalk catalogue uses the live API and stays admin-only', () => {
  const pagePath = fileURLToPath(new URL('../pages/admin/MascoCrosswalks.jsx', import.meta.url))
  const detailsPath = fileURLToPath(new URL('../pages/admin/MascoOccupationDetails.jsx', import.meta.url))
  const appPath = fileURLToPath(new URL('../App.jsx', import.meta.url))
  const navPath = fileURLToPath(new URL('../data/navigation.js', import.meta.url))
  const studentNav = readFileSync(navPath, 'utf8')
  const page = readFileSync(pagePath, 'utf8')
  const details = readFileSync(detailsPath, 'utf8')
  const app = readFileSync(appPath, 'utf8')

  assert.equal(page.includes('fetchMascoCrosswalks'), true)
  assert.equal(page.includes('Clear filters'), true)
  assert.equal(page.includes('View Current Occupation'), true)
  assert.equal(page.includes('historicalCode'), true)
  assert.equal(page.includes('currentCode'), true)
  assert.equal(page.includes('mappingStatus'), true)
  assert.equal(page.includes('PaginationBar'), true)
  assert.equal(page.includes('Loading MASCO crosswalks'), true)
  assert.equal(page.includes('No historical mappings match these filters'), true)
  assert.equal(page.includes('from \'../../data/'), false)
  assert.equal(page.includes('mock'), false)
  assert.equal(page.includes('career-target'), false)
  assert.equal(page.includes('skill-gap'), false)
  assert.equal(page.includes('fetchOccupations'), false)

  assert.equal(details.includes('fetchMascoOccupationCrosswalks'), true)
  assert.equal(details.includes('No historical mappings recorded'), true)

  const mascoCrosswalksIndex = app.indexOf('path="masco/crosswalks"')
  const mascoCodeIndex = app.indexOf('path="masco/:code"')
  assert.ok(mascoCrosswalksIndex > 0)
  assert.ok(mascoCodeIndex > mascoCrosswalksIndex)

  assert.equal(studentNav.includes("to: '/student/masco/crosswalks'"), false)
  assert.equal(studentNav.includes("to: '/jobseeker/masco/crosswalks'"), false)
  assert.equal(studentNav.includes("to: '/employer/masco/crosswalks'"), false)
})
