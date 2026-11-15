import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken } from './client.js'
import {
  COMPANY_EMPTY,
  COMPANY_LOGO_UNAVAILABLE,
  COMPANY_UNAVAILABLE,
  buildCompanyUpdate,
  fetchAdminCompany,
  fetchCompanyProfile,
  isAbortError,
  parseCompany,
  saveCompanyProfile,
  userFacingCompanyError,
} from './company.js'
import { companyFormToUpdate, companyToFormValues, emptyCompanyForm, validateCompanyForm } from './companyForm.js'

const originalFetch = globalThis.fetch
const COMPANY_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

afterEach(() => {
  globalThis.fetch = originalFetch
  clearCsrfToken()
})

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function companyPayload(overrides = {}) {
  return {
    id: COMPANY_ID,
    companyName: 'Northwind Analytics',
    registrationNumber: '1234567-A',
    industry: 'Technology',
    companySize: '11-50',
    website: 'www.northwind.example',
    email: 'hello@northwind.example',
    phone: '03-555 0100',
    location: 'Petaling Jaya',
    address: '1 Jalan Utara',
    description: 'A reporting studio for Malaysian teams.',
    createdAt: '2026-11-13T02:40:00.000Z',
    updatedAt: '2026-11-13T02:40:00.000Z',
    ...overrides,
  }
}

test('fetchCompanyProfile loads the signed-in staff company or null', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    if (path === '/api/me/company') {
      return jsonResponse(200, { company: companyPayload() })
    }
    throw new Error(`unexpected ${path}`)
  }

  const company = await fetchCompanyProfile()
  assert.equal(company.companyName, 'Northwind Analytics')
  assert.equal(company.id, COMPANY_ID)
  assert.deepEqual(calls, [{ path: '/api/me/company', method: 'GET' }])

  globalThis.fetch = async () => jsonResponse(200, { company: null })
  assert.equal(await fetchCompanyProfile(), null)
})

test('saveCompanyProfile puts only company fields through CSRF and ignores client companyId', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-company' })
    }
    if (path === '/api/me/company') {
      return jsonResponse(201, { company: companyPayload({ companyName: 'Northwind Analytics Sdn Bhd' }) })
    }
    throw new Error(`unexpected ${path}`)
  }

  const saved = await saveCompanyProfile({
    companyName: 'Northwind Analytics Sdn Bhd',
    industry: 'Technology',
    location: 'Petaling Jaya',
    companyId: 'other-company',
    logoUrl: 'https://evil.example/logo.png',
  })
  assert.equal(saved.companyName, 'Northwind Analytics Sdn Bhd')
  const mutate = calls.find((call) => call.path === '/api/me/company' && call.method === 'PUT')
  assert.equal(mutate.headers['x-csrf-token'], 'csrf-company')
  const body = JSON.parse(mutate.body)
  assert.equal(body.companyName, 'Northwind Analytics Sdn Bhd')
  assert.equal(body.industry, 'Technology')
  assert.equal(body.companyId, undefined)
  assert.equal(body.logoUrl, undefined)
})

test('admin company reads use the admin path only', async () => {
  globalThis.fetch = async (path, init) => {
    assert.equal(path, `/api/admin/companies/${COMPANY_ID}`)
    assert.equal(init.method, 'GET')
    return jsonResponse(200, { company: companyPayload() })
  }
  const company = await fetchAdminCompany(COMPANY_ID)
  assert.equal(company.id, COMPANY_ID)
})

test('company forms validate required name and keep empty optional fields empty', () => {
  assert.deepEqual(companyToFormValues(null), emptyCompanyForm())
  const errors = validateCompanyForm(emptyCompanyForm())
  assert.equal(errors.companyName.includes('company name'), true)
  assert.equal(validateCompanyForm({ ...emptyCompanyForm(), companyName: 'Acme', email: 'nope' }).email.includes('valid'), true)
  const update = companyFormToUpdate({
    ...emptyCompanyForm(),
    companyName: 'Acme',
    location: 'KL',
  })
  assert.equal(update.companyName, 'Acme')
  assert.equal(update.jobTitle, undefined)
  assert.equal(buildCompanyUpdate({ companyName: 'Acme', website: '' }).website, null)
  assert.equal(COMPANY_EMPTY.title.includes('saved yet'), true)
  assert.equal(COMPANY_LOGO_UNAVAILABLE.includes('not stored'), true)
  assert.throws(() => parseCompany({ companyName: 'Acme' }), (error) => error instanceof ApiError)
})

test('API failures stay user-facing and aborted requests are ignored', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'secret-dsn' })
  await assert.rejects(() => fetchCompanyProfile(), (error) => error instanceof ApiError)
  assert.equal(userFacingCompanyError(new ApiError('secret-dsn', 500)), COMPANY_UNAVAILABLE)
  assert.equal(userFacingCompanyError(new ApiError('Unauthenticated', 401)).includes('Sign in'), true)
  assert.equal(userFacingCompanyError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  const controller = new AbortController()
  globalThis.fetch = async (_path, init) => {
    assert.equal(init.signal, controller.signal)
    const error = new Error('aborted')
    error.name = 'AbortError'
    throw error
  }
  controller.abort()
  await assert.rejects(() => fetchCompanyProfile({ signal: controller.signal }), (error) => isAbortError(error))
})

test('company profile page uses the live API and drops mock Nexa Digital data', () => {
  const page = readFileSync(fileURLToPath(new URL('../pages/employer/CompanyProfile.jsx', import.meta.url)), 'utf8')
  const hook = readFileSync(fileURLToPath(new URL('../hooks/useCompanyProfileForm.js', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const student = readFileSync(fileURLToPath(new URL('../pages/student/Dashboard.jsx', import.meta.url)), 'utf8')
  const positionChange = readFileSync(
    fileURLToPath(new URL('../pages/employer/StaffProfile.jsx', import.meta.url)),
    'utf8',
  )

  assert.equal(page.includes('useCompanyProfileForm'), true)
  assert.equal(page.includes('nexaDigital'), false)
  assert.equal(page.includes('Nexa Digital'), false)
  assert.equal(page.includes('COMPANY_LOGO_UNAVAILABLE'), true)
  assert.equal(page.includes('fetchMeProfile'), false)
  assert.equal(hook.includes('fetchCompanyProfile'), true)
  assert.equal(hook.includes('saveCompanyProfile'), true)
  assert.equal(hook.includes('setSaveError(userFacingCompanyError(error))'), true)
  assert.equal(app.includes('<CompanyProfile />'), true)
  assert.equal(app.includes("roles={['COMPANY_STAFF']}"), true)
  assert.equal(student.includes('useCompanyProfileForm'), false)
  assert.equal(positionChange.includes('useStaffPositionChangeRequests'), true)
  assert.equal(positionChange.includes('useCompanyProfileForm'), false)
})
