import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken } from './client.js'
import {
  MAX_RESUMES_PER_USER,
  MAX_RESUME_FILE_BYTES,
  RESUME_EMPTY,
  RESUME_LIMIT_COPY,
  RESUME_PDF_UNAVAILABLE,
  RESUME_PDF_UNSAVED_COPY,
  RESUME_TEMPLATE_KEYS,
  RESUME_LIMIT_REACHED,
  RESUMES_UNAVAILABLE,
  atResumeLimit,
  buildCreateResume,
  createResume,
  deleteResume,
  deleteResumeFile,
  downloadResumeFile,
  downloadResumePdf,
  fetchResume,
  fetchResumes,
  formatResumeFileSize,
  formatResumeUpdatedAt,
  isAbortError,
  parseResume,
  parseResumeFile,
  parseResumeSummary,
  resumeEditorPath,
  setPrimaryResume,
  updateResume,
  uploadResumeFile,
  userFacingResumeEditorError,
  userFacingResumeError,
  userFacingResumeFileError,
  userFacingResumePdfError,
  validateResumeFileSelection,
} from './resumes.js'

const originalFetch = globalThis.fetch
const RESUME_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

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

function summaryPayload(overrides = {}) {
  return {
    id: RESUME_ID,
    title: 'Software internship CV',
    templateKey: 'classic',
    isPrimary: true,
    fullName: 'Stage Seven Two Student',
    educationCount: 0,
    experienceCount: 0,
    skillCount: 0,
    certificationCount: 0,
    createdAt: '2026-11-13T02:40:00.000Z',
    updatedAt: '2026-11-13T03:10:00.000Z',
    ...overrides,
  }
}

function resumePayload(overrides = {}) {
  return {
    id: RESUME_ID,
    title: 'Software internship CV',
    summary: null,
    templateKey: 'classic',
    isPrimary: true,
    fullName: 'Stage Seven Two Student',
    email: 'stage72.student@peaceone.test',
    phone: '012-680 0001',
    location: 'Kuala Lumpur',
    education: [],
    experience: [],
    skills: [],
    certifications: [],
    createdAt: '2026-11-13T02:40:00.000Z',
    updatedAt: '2026-11-13T03:10:00.000Z',
    ...overrides,
  }
}

function filePayload(overrides = {}) {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    originalFilename: 'Software_CV.pdf',
    contentType: 'application/pdf',
    byteSize: 2048,
    sha256: 'a'.repeat(64),
    createdAt: '2026-11-13T03:20:00.000Z',
    updatedAt: '2026-11-13T03:20:00.000Z',
    ...overrides,
  }
}

function pdfFile() {
  return new File([Buffer.from('%PDF-1.4\n%%EOF\n')], 'Software_CV.pdf', { type: 'application/pdf' })
}

test('fetchResumes loads the signed-in candidate list from the live API', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    if (path === '/api/me/resumes') {
      return jsonResponse(200, { items: [summaryPayload()] })
    }
    throw new Error(`unexpected ${path}`)
  }

  const items = await fetchResumes()
  assert.equal(items.length, 1)
  assert.equal(items[0].title, 'Software internship CV')
  assert.equal(items[0].isPrimary, true)
  assert.equal(items[0].educationCount, 0)
  assert.equal(items[0].file, null)
  assert.deepEqual(calls, [{ path: '/api/me/resumes', method: 'GET' }])
})

test('createResume posts a title through CSRF and ignores client userId', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-resume' })
    }
    if (path === '/api/me/resumes') {
      return jsonResponse(201, { resume: resumePayload({ title: 'Data role CV', isPrimary: false }) })
    }
    throw new Error(`unexpected ${path}`)
  }

  const created = await createResume({
    title: '  Data role CV  ',
    userId: 'other-user',
    role: 'ADMIN',
  })
  assert.equal(created.title, 'Data role CV')
  const mutate = calls.find((call) => call.path === '/api/me/resumes' && call.method === 'POST')
  assert.equal(mutate.headers['x-csrf-token'], 'csrf-resume')
  assert.deepEqual(JSON.parse(mutate.body), { title: 'Data role CV' })
})

test('updateResume puts the full nested document through CSRF', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-resume-put' })
    }
    if (path === `/api/me/resumes/${RESUME_ID}`) {
      return jsonResponse(200, {
        resume: resumePayload({
          fullName: 'Updated Name',
          education: [
            {
              institution: 'TAR UMT',
              qualification: 'BCS',
              fieldOfStudy: 'SE',
              startYear: 2022,
              endYear: 2026,
              notes: 'Notes',
            },
          ],
        }),
      })
    }
    throw new Error(`unexpected ${path}`)
  }

  const body = {
    title: 'Software internship CV',
    summary: null,
    templateKey: 'classic',
    fullName: 'Updated Name',
    email: 'stage72.student@peaceone.test',
    phone: '012-680 0001',
    location: 'Kuala Lumpur',
    education: [
      {
        institution: 'TAR UMT',
        qualification: 'BCS',
        fieldOfStudy: 'SE',
        startYear: 2022,
        endYear: 2026,
        notes: 'Notes',
      },
    ],
    experience: [],
    skills: [],
    certifications: [],
  }
  const updated = await updateResume(RESUME_ID, body)
  assert.equal(updated.fullName, 'Updated Name')
  assert.equal(updated.education[0].institution, 'TAR UMT')
  const put = calls.find((call) => call.method === 'PUT')
  assert.equal(put.path, `/api/me/resumes/${RESUME_ID}`)
  assert.equal(put.headers['x-csrf-token'], 'csrf-resume-put')
  assert.deepEqual(JSON.parse(put.body), body)
})

test('fetchResume opens a saved resume by id', async () => {
  globalThis.fetch = async (path, init) => {
    assert.equal(path, `/api/me/resumes/${RESUME_ID}`)
    assert.equal(init.method, 'GET')
    return jsonResponse(200, { resume: resumePayload() })
  }
  const opened = await fetchResume(RESUME_ID)
  assert.equal(opened.id, RESUME_ID)
  assert.equal(opened.email, 'stage72.student@peaceone.test')
  assert.equal(opened.education.length, 0)
  assert.equal(opened.file, null)
})

test('setPrimaryResume and deleteResume send CSRF and do not fall back to mocks', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-resume-mutate' })
    }
    if (path === `/api/me/resumes/${RESUME_ID}/primary`) {
      return jsonResponse(200, { resume: resumePayload({ isPrimary: true }) })
    }
    if (path === `/api/me/resumes/${RESUME_ID}`) {
      return jsonResponse(200, { ok: true })
    }
    throw new Error(`unexpected ${path}`)
  }

  const primary = await setPrimaryResume(RESUME_ID)
  assert.equal(primary.isPrimary, true)
  assert.equal(await deleteResume(RESUME_ID), true)

  const primaryCall = calls.find((call) => call.path.endsWith('/primary'))
  assert.equal(primaryCall.method, 'POST')
  assert.equal(primaryCall.headers['x-csrf-token'], 'csrf-resume-mutate')
  const deleted = calls.find((call) => call.method === 'DELETE')
  assert.equal(deleted.headers['x-csrf-token'], 'csrf-resume-mutate')
})

test('five-resume limit, empty copy, and parsers reject incomplete payloads', () => {
  assert.equal(MAX_RESUMES_PER_USER, 5)
  assert.equal(atResumeLimit(Array.from({ length: 5 }, (_, index) => ({ id: String(index) }))), true)
  assert.equal(atResumeLimit(Array.from({ length: 4 }, (_, index) => ({ id: String(index) }))), false)
  assert.equal(RESUME_EMPTY.title, 'No resume is saved yet.')
  assert.equal(RESUME_LIMIT_COPY.includes('5 resumes'), true)
  assert.notEqual(formatResumeUpdatedAt('2026-11-13T03:10:00.000Z'), '—')
  assert.equal(formatResumeUpdatedAt(''), '—')
  assert.deepEqual(buildCreateResume({ title: ' CV ', userId: 'x' }), { title: 'CV' })
  assert.throws(() => parseResumeSummary({ title: 'CV' }), (error) => error instanceof ApiError)
  assert.throws(() => parseResume({ title: 'CV' }), (error) => error instanceof ApiError)
})

test('API failures stay user-facing and aborted requests are ignored', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'secret-dsn' })
  await assert.rejects(() => fetchResumes(), (error) => error instanceof ApiError)
  assert.equal(userFacingResumeError(new ApiError('secret-dsn', 500)), RESUMES_UNAVAILABLE)
  assert.equal(userFacingResumeError(new ApiError('Unauthenticated', 401)).includes('Sign in'), true)
  assert.equal(userFacingResumeError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(userFacingResumeError(new ApiError(RESUME_LIMIT_REACHED, 409)), RESUME_LIMIT_COPY)
  assert.equal(userFacingResumeEditorError(new ApiError('Not found', 404)), 'This resume is not available.')
  assert.equal(userFacingResumeEditorError(new ApiError('Invalid request', 400)), 'This resume is not available.')

  const controller = new AbortController()
  globalThis.fetch = async (_path, init) => {
    assert.equal(init.signal, controller.signal)
    const error = new Error('aborted')
    error.name = 'AbortError'
    throw error
  }
  controller.abort()
  await assert.rejects(() => fetchResumes({ signal: controller.signal }), (error) => isAbortError(error))
})

test('resume file upload, replace, download and remove use CSRF and hide storage paths', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-resume-file' })
    }
    if (path === `/api/me/resumes/${RESUME_ID}/file` && init.method === 'POST') {
      return jsonResponse(201, { file: filePayload() })
    }
    if (path === `/api/me/resumes/${RESUME_ID}/file` && init.method === 'GET') {
      return new Response(Buffer.from('%PDF-1.4\n%%EOF\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="Software_CV.pdf"',
        },
      })
    }
    if (path === `/api/me/resumes/${RESUME_ID}/file` && init.method === 'DELETE') {
      return jsonResponse(200, { ok: true })
    }
    throw new Error(`unexpected ${path} ${init.method}`)
  }

  const uploaded = await uploadResumeFile(RESUME_ID, pdfFile())
  assert.equal(uploaded.file.originalFilename, 'Software_CV.pdf')
  assert.equal(uploaded.unchanged, false)
  const post = calls.find((call) => call.method === 'POST' && String(call.path).endsWith('/file'))
  assert.equal(post.headers['x-csrf-token'], 'csrf-resume-file')
  assert.equal(post.headers['Content-Type'], undefined)
  assert.equal(post.body instanceof FormData, true)

  const replaced = await uploadResumeFile(RESUME_ID, pdfFile())
  assert.equal(replaced.file.originalFilename, 'Software_CV.pdf')

  const downloaded = await downloadResumeFile(RESUME_ID)
  assert.equal(downloaded.filename, 'Software_CV.pdf')
  assert.equal(downloaded.contentType, 'application/pdf')

  assert.equal(await deleteResumeFile(RESUME_ID), true)
  const deleted = calls.find((call) => call.method === 'DELETE')
  assert.equal(deleted.headers['x-csrf-token'], 'csrf-resume-file')
})

test('generated resume PDF download uses the authenticated binary endpoint', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, headers: init.headers })
    if (path === `/api/me/resumes/${RESUME_ID}/pdf`) {
      return new Response(Buffer.from('%PDF-1.4\n%%EOF\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="Software internship CV.pdf"',
        },
      })
    }
    throw new Error(`unexpected ${path}`)
  }

  const downloaded = await downloadResumePdf(RESUME_ID)
  assert.equal(downloaded.filename, 'Software internship CV.pdf')
  assert.equal(downloaded.contentType, 'application/pdf')
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].headers['x-csrf-token'], undefined)
  assert.deepEqual(RESUME_TEMPLATE_KEYS, ['classic', 'modern', 'compact'])
  assert.match(RESUME_PDF_UNSAVED_COPY, /last saved version/)
  assert.equal(userFacingResumePdfError(new ApiError('Unauthenticated', 401)).includes('Sign in'), true)
  assert.equal(userFacingResumePdfError(new ApiError('Not found', 404)), 'This resume is not available.')
  assert.equal(userFacingResumePdfError(new ApiError('Forbidden', 403)), 'You cannot download resume PDFs with this account.')
  assert.equal(userFacingResumePdfError(new Error('network')), RESUME_PDF_UNAVAILABLE)
})

test('resume file validation errors stay user-facing and reject storage paths', () => {
  assert.throws(() => validateResumeFileSelection({ name: 'resume.exe', size: 12 }), (error) => {
    return error instanceof ApiError && error.message === 'Unsupported file format'
  })
  assert.throws(() => validateResumeFileSelection({ name: 'resume.pdf', size: 0 }), (error) => {
    return error instanceof ApiError && error.message === 'File is empty'
  })
  assert.throws(
    () => validateResumeFileSelection({ name: 'resume.pdf', size: MAX_RESUME_FILE_BYTES + 1 }),
    (error) => error instanceof ApiError && error.message === 'File too large',
  )
  assert.equal(userFacingResumeFileError(new ApiError('Unsupported file format', 400)), 'Unsupported format. Use a PDF or DOCX file.')
  assert.equal(userFacingResumeFileError(new ApiError('File too large', 413)).includes('5 MB'), true)
  assert.equal(userFacingResumeFileError(new ApiError('Corrupted file', 400)).includes('corrupted'), true)
  assert.equal(userFacingResumeFileError(new ApiError('File is unavailable', 404), 'download'), 'Download unavailable.')
  assert.equal(formatResumeFileSize(2048).includes('KB'), true)
  assert.throws(
    () => parseResumeFile({ ...filePayload(), storedFilename: 'secret.pdf' }),
    (error) => error instanceof ApiError,
  )
  assert.equal(parseResume(resumePayload({ file: filePayload() })).file.originalFilename, 'Software_CV.pdf')
})

test('resume management page uses the live API and drops mock upload behaviour', () => {
  const page = readFileSync(fileURLToPath(new URL('../pages/shared/ResumePage.jsx', import.meta.url)), 'utf8')
  const editor = readFileSync(fileURLToPath(new URL('../pages/shared/ResumeEditorPage.jsx', import.meta.url)), 'utf8')
  const listHook = readFileSync(fileURLToPath(new URL('../hooks/useResumeList.js', import.meta.url)), 'utf8')
  const editorHook = readFileSync(fileURLToPath(new URL('../hooks/useResumeEditor.js', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const navigation = readFileSync(fileURLToPath(new URL('../data/navigation.js', import.meta.url)), 'utf8')
  const skills = readFileSync(fileURLToPath(new URL('../pages/shared/SkillsPage.jsx', import.meta.url)), 'utf8')
  const apply = readFileSync(fileURLToPath(new URL('../pages/shared/ApplyPage.jsx', import.meta.url)), 'utf8')
  const layout = readFileSync(fileURLToPath(new URL('../components/layout/CandidateLayout.jsx', import.meta.url)), 'utf8')
  const careerTarget = readFileSync(fileURLToPath(new URL('../pages/shared/CareerTargetPage.jsx', import.meta.url)), 'utf8')
  const skillGap = readFileSync(fileURLToPath(new URL('../pages/shared/SkillGapPage.jsx', import.meta.url)), 'utf8')
  const savedSkills = readFileSync(fileURLToPath(new URL('./userSkills.js', import.meta.url)), 'utf8')

  assert.equal(page.includes('useResumeList'), true)
  assert.equal(page.includes('Create Resume'), true)
  assert.equal(page.includes('RESUME_EMPTY.title'), true)
  assert.equal(page.includes('Set as Primary'), true)
  assert.equal(page.includes('Delete'), true)
  assert.equal(page.includes('Open'), true)
  assert.equal(page.includes('Upload resume'), true)
  assert.equal(page.includes('Replace resume file'), true)
  assert.equal(page.includes('Download uploaded file'), true)
  assert.equal(page.includes('Download resume'), false)
  assert.equal(page.includes('generated PDF'), true)
  assert.equal(page.includes('Remove resume file'), true)
  assert.equal(page.includes('Identify skills'), true)
  assert.equal(page.includes('Loading your resumes'), true)
  assert.equal(page.includes('onRetry={retry}'), true)
  assert.equal(page.includes('mockResumes'), false)
  assert.equal(page.includes('Emily_Tan_Resume.pdf'), false)
  assert.equal(page.includes('Daniel_Lee_Resume.pdf'), false)
  assert.equal(page.includes('Resume uploaded successfully'), false)
  assert.equal(page.includes('Resume preview is not available yet'), false)
  assert.equal(page.includes('Skills Identified from Resume'), false)
  assert.equal(page.includes('Processed'), false)
  assert.equal(listHook.includes('fetchResumes'), true)
  assert.equal(listHook.includes('createResume'), true)
  assert.equal(listHook.includes('setPrimaryResume'), true)
  assert.equal(listHook.includes('deleteResume'), true)
  assert.equal(listHook.includes('uploadResumeFile'), true)
  assert.equal(listHook.includes('downloadResumeFile'), true)
  assert.equal(listHook.includes('deleteResumeFile'), true)
  assert.equal(listHook.includes('mockResumes'), false)
  assert.equal(/\bfetchResume\b/.test(listHook), false)
  assert.equal(app.includes('<ResumePage basePath="/student" />'), true)
  assert.equal(app.includes('<ResumePage basePath="/jobseeker" />'), true)
  assert.equal(app.includes("path=\"resume\""), true)
  assert.equal(app.includes('path="resume/:resumeId"'), true)
  assert.equal(app.includes('basePath="/student"'), true)
  assert.equal(app.includes('basePath="/jobseeker"'), true)
  assert.equal(resumeEditorPath('/student', RESUME_ID), `/student/resume/${RESUME_ID}`)
  assert.equal(page.includes('resumeEditorPath(basePath, item.id)'), true)
  assert.equal(page.includes('handleOpen'), false)
  assert.equal(editor.includes('useResumeEditor'), true)
  assert.equal(editor.includes('fetchSkills'), true)
  assert.equal(editor.includes('Import saved ESCO skills'), true)
  assert.equal(editor.includes('Currently working'), true)
  assert.equal(editor.includes('Year issued'), true)
  assert.equal(editor.includes('createSavedSkill'), false)
  assert.equal(editor.includes('saveCareerTarget'), false)
  assert.equal(editor.includes('masco'), false)
  assert.equal(editor.includes('Resume Document'), true)
  assert.equal(editor.includes('PDF'), true)
  assert.equal(editor.includes('Try again'), true)
  assert.equal(editor.includes('Uploading'), true)
  assert.equal(editor.includes('ResumeSkillReview'), true)
  assert.equal(editor.includes('Skills Identified from Resume</'), false)
  assert.equal(editor.includes('Processed'), false)
  assert.equal(editorHook.includes('fetchResume'), true)
  assert.equal(editorHook.includes('updateResume'), true)
  assert.equal(editorHook.includes('formToUpdate(form)'), true)
  assert.equal(editorHook.includes('setForm(previousForm)'), true)
  assert.equal(editorHook.includes('uploadResumeFile'), true)
  assert.equal(editorHook.includes('uploadDocument'), true)
  assert.equal(editorHook.includes('downloadResumePdf'), true)
  assert.equal(editorHook.includes('persistTemplate'), true)
  assert.equal(editor.includes('ResumeTemplatePicker'), true)
  assert.equal(editor.includes('ResumePreview'), true)
  assert.equal(editor.includes('Download PDF'), true)
  assert.equal(editor.includes('Download uploaded file'), true)
  assert.equal(editor.includes('separate from Download PDF'), true)
  assert.equal(editorHook.includes('fetchSavedSkills'), true)
  assert.equal(editorHook.includes('createSavedSkill'), false)
  assert.equal(editorHook.includes('saveCareerTarget'), false)
  assert.equal(editorHook.includes('beforeunload'), true)
  assert.equal(layout.includes("resume: 'My Resume'"), true)
  assert.equal(layout.includes("'Edit Resume'"), true)
  assert.equal(careerTarget.includes('updateResume'), false)
  assert.equal(skillGap.includes('updateResume'), false)
  assert.equal(savedSkills.includes('updateResume'), false)
  assert.equal(navigation.includes("label: 'My Resume', to: '/student/resume'"), true)
  assert.equal(navigation.includes("label: 'My Resume', to: '/jobseeker/resume'"), true)
  assert.equal(skills.includes('My Resume'), true)
  assert.equal(skills.includes('Upload Resume'), false)
  assert.equal(apply.includes('mockResumes'), false)
  assert.equal(apply.includes('fetchResumes'), true)
  assert.equal(apply.includes('Emily_Tan_Resume.pdf'), false)
  assert.equal(apply.includes('primary.fileName'), false)
})
