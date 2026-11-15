import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';
import { closeSessionStore } from '../src/lib/session.js';
import {
  RESUME_STORAGE_ENV,
  cleanupResumeTempFiles,
  resumeFilePath,
  resumeTempDir,
  storedResumeFileExists,
  writeResumeTempFile,
} from '../src/lib/resumeStorage.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';
import { validDocx, validPdf } from './resumeFileFixtures.js';

const TEST_EMAIL_PREFIX = 'stage74c-download-';
const ICT_SAFETY_URI = 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2';
const createdEmails = [];
const previousStorage = process.env[RESUME_STORAGE_ENV];

let tempRoot;
let server;
let baseUrl;
let baseline;
let ictSafety;

async function snapshot() {
  const [occupations, skills, relations, mascoOccupations, resumes, resumeFiles, userSkills] = await Promise.all([
    prisma.occupation.count(),
    prisma.skill.count(),
    prisma.occupationSkillRelation.count(),
    prisma.mascoOccupationRecord.count(),
    prisma.resume.count(),
    prisma.resumeFile.count(),
    prisma.userSkill.count(),
  ]);
  return { occupations, skills, relations, mascoOccupations, resumes, resumeFiles, userSkills };
}

async function registerAs(label, extras = {}) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/register', primed, validRegisterBody(email, extras));
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

async function loginAs(email) {
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/login', primed, {
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(result.response.status, 200, result.text);
  return result;
}

async function createAdmin() {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'admin');
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage Seven Four C Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  return { email, ...(await loginAs(email)) };
}

function sessionOf(result) {
  return {
    csrfToken: result.json.csrfToken,
    cookies: result.cookies,
  };
}

async function createResume(session, title = 'Software internship CV') {
  const created = await postJson(baseUrl, '/api/me/resumes', session, { title });
  assert.equal(created.response.status, 201, created.text);
  return created.json.resume;
}

async function postFile(session, resumeId, buffer, filename) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), filename);
  const response = await fetch(`${baseUrl}/api/me/resumes/${resumeId}/file`, {
    method: 'POST',
    headers: {
      Cookie: session.cookies,
      'x-csrf-token': session.csrfToken,
    },
    body: form,
  });
  const json = await response.json();
  return { response, json };
}

async function getFile(session, resumeId) {
  const response = await fetch(`${baseUrl}/api/me/resumes/${resumeId}/file`, {
    method: 'GET',
    headers: { Cookie: session.cookies },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  let json = null;
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try {
      json = JSON.parse(buffer.toString('utf8'));
    } catch {
      json = null;
    }
  }
  return { response, buffer, json, text: buffer.toString('utf8') };
}

function deleteFile(session, resumeId, extra = {}) {
  return requestJson(baseUrl, `/api/me/resumes/${resumeId}/file`, {
    method: 'DELETE',
    csrfToken: extra.csrfToken ?? session.csrfToken,
    cookies: extra.cookies ?? session.cookies,
  });
}

function assertNoStorageLeak(payload) {
  assertNoSecrets(payload);
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  assert.equal(serialized.includes(tempRoot), false);
  assert.equal(serialized.includes('"storedFilename"'), false);
}

before(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-resume-download-'));
  process.env[RESUME_STORAGE_ENV] = tempRoot;
  baseline = await snapshot();
  ictSafety = await prisma.skill.findFirst({
    where: { sourceUri: ICT_SAFETY_URI, sourceSystem: 'ESCO' },
    select: { id: true },
  });
  assert.ok(ictSafety, 'expected imported ICT safety skill');

  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
  }
  assert.deepEqual(await snapshot(), baseline);
  if (previousStorage === undefined) {
    delete process.env[RESUME_STORAGE_ENV];
  } else {
    process.env[RESUME_STORAGE_ENV] = previousStorage;
  }
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('owners can download the stored file and other users cannot', async () => {
  const student = await registerAs('download');
  const other = await registerAs('other');
  const resume = await createResume(sessionOf(student));
  const uploaded = await postFile(sessionOf(student), resume.id, validPdf(), 'Software_CV.pdf');
  assert.equal(uploaded.response.status, 201, JSON.stringify(uploaded.json));

  const downloaded = await getFile(sessionOf(student), resume.id);
  assert.equal(downloaded.response.status, 200);
  assert.equal(downloaded.response.headers.get('content-type'), 'application/pdf');
  assert.equal(downloaded.response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(downloaded.response.headers.get('content-disposition') || '', /Software_CV\.pdf/);
  assert.equal(downloaded.buffer.equals(validPdf()), true);
  assert.equal((downloaded.response.headers.get('content-disposition') || '').includes(tempRoot), false);

  const blocked = await getFile(sessionOf(other), resume.id);
  assert.equal(blocked.response.status, 404);
  assert.equal(blocked.json.error, 'Not found');
  assertNoStorageLeak(blocked.json);
});

test('missing stored files are reported without filesystem paths', async () => {
  const student = await registerAs('missing');
  const resume = await createResume(sessionOf(student));
  const uploaded = await postFile(sessionOf(student), resume.id, validPdf(), 'gone.pdf');
  assert.equal(uploaded.response.status, 201);
  const record = await prisma.resumeFile.findUnique({ where: { resumeId: resume.id } });
  await fs.unlink(resumeFilePath(record.userId, resume.id, record.storedFilename));

  const missing = await getFile(sessionOf(student), resume.id);
  assert.equal(missing.response.status, 404);
  assert.equal(missing.json.error, 'File is unavailable');
  assertNoStorageLeak(missing.json);
  assert.equal(missing.text.includes(record.storedFilename), false);

  const none = await getFile(sessionOf(student), resume.id.replace(/[0-9a-f]/, '0'));
  assert.equal([400, 404].includes(none.response.status), true);
});

test('file deletion keeps the structured resume and recorded skills', async () => {
  const student = await registerAs('delete-file');
  const session = sessionOf(student);
  const recorded = await postJson(baseUrl, '/api/me/skills', session, {
    skillId: ictSafety.id,
    proficiencyLevel: 'Advanced',
  });
  assert.equal(recorded.response.status, 201, recorded.text);

  const resume = await createResume(session, 'Keep sections CV');
  const nested = await requestJson(baseUrl, `/api/me/resumes/${resume.id}`, {
    method: 'PUT',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body: {
      education: [{ institution: 'TAR UMT', qualification: 'BCS' }],
      skills: [{ skillId: ictSafety.id, proficiencyLevel: 'Advanced' }],
    },
  });
  assert.equal(nested.response.status, 200, nested.text);

  const uploaded = await postFile(session, resume.id, validDocx(), 'keep-sections.docx');
  assert.equal(uploaded.response.status, 201, JSON.stringify(uploaded.json));
  const record = await prisma.resumeFile.findUnique({ where: { resumeId: resume.id } });

  const removed = await deleteFile(session, resume.id);
  assert.equal(removed.response.status, 200, removed.text);
  assert.deepEqual(removed.json, { ok: true });
  assert.equal(await prisma.resumeFile.count({ where: { resumeId: resume.id } }), 0);
  assert.equal(await storedResumeFileExists(record.userId, resume.id, record.storedFilename), false);

  const remaining = await requestJson(baseUrl, `/api/me/resumes/${resume.id}`, { cookies: session.cookies });
  assert.equal(remaining.response.status, 200);
  assert.equal(remaining.json.resume.title, 'Keep sections CV');
  assert.equal(remaining.json.resume.file, null);
  assert.equal(remaining.json.resume.education[0].institution, 'TAR UMT');
  assert.equal(remaining.json.resume.skills[0].skillId, ictSafety.id);
  assertNoStorageLeak(remaining.json);

  const stillRecorded = await prisma.userSkill.findUnique({ where: { id: recorded.json.userSkill.id } });
  assert.ok(stillRecorded);
  assert.equal(stillRecorded.proficiencyLevel, 'Advanced');
});

test('deleting a resume removes the associated physical file', async () => {
  const student = await registerAs('delete-resume');
  const session = sessionOf(student);
  const resume = await createResume(session);
  const uploaded = await postFile(session, resume.id, validPdf(), 'remove-with-resume.pdf');
  assert.equal(uploaded.response.status, 201);
  const record = await prisma.resumeFile.findUnique({ where: { resumeId: resume.id } });

  const deleted = await requestJson(baseUrl, `/api/me/resumes/${resume.id}`, {
    method: 'DELETE',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
  });
  assert.equal(deleted.response.status, 200);
  assert.deepEqual(deleted.json, { ok: true });
  assert.equal(await prisma.resume.findUnique({ where: { id: resume.id } }), null);
  assert.equal(await storedResumeFileExists(record.userId, resume.id, record.storedFilename), false);
});

test('CSRF, missing files, roles and filesystem failures are handled', async () => {
  const student = await registerAs('guards');
  const session = sessionOf(student);
  const resume = await createResume(session);
  const uploaded = await postFile(session, resume.id, validPdf(), 'guard.pdf');
  assert.equal(uploaded.response.status, 201);

  const missingCsrf = await requestJson(baseUrl, `/api/me/resumes/${resume.id}/file`, {
    method: 'DELETE',
    cookies: session.cookies,
  });
  assert.equal(missingCsrf.response.status, 403);
  assert.equal(missingCsrf.json.error, 'Invalid CSRF token');

  const primed = await primeCsrf(baseUrl);
  const unauthenticated = await getFile(primed, resume.id);
  assert.equal(unauthenticated.response.status, 401);

  const staff = await registerAs('staff', { role: 'employer', currentPosition: undefined });
  const staffGet = await getFile(sessionOf(staff), resume.id);
  assert.equal(staffGet.response.status, 403);
  const staffDelete = await deleteFile(sessionOf(staff), resume.id);
  assert.equal(staffDelete.response.status, 403);

  const admin = await createAdmin();
  const adminGet = await getFile(sessionOf(admin), resume.id);
  assert.equal(adminGet.response.status, 403);

  const record = await prisma.resumeFile.findUnique({ where: { resumeId: resume.id } });
  const storedPath = resumeFilePath(record.userId, resume.id, record.storedFilename);
  await fs.unlink(storedPath);
  await fs.mkdir(storedPath);
  const failed = await deleteFile(session, resume.id);
  assert.equal(failed.response.status, 500);
  assert.equal(failed.json.error, 'File could not be removed');
  assertNoStorageLeak(failed.json);
  assert.ok(await prisma.resumeFile.findUnique({ where: { resumeId: resume.id } }));
  await fs.rm(storedPath, { recursive: true, force: true });
});

test('stale temp uploads can be cleaned without touching another resume directory', async () => {
  const stale = await writeResumeTempFile(Buffer.from('stale'));
  await fs.utimes(stale, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
  await cleanupResumeTempFiles(process.env, 1000);
  await assert.rejects(() => fs.stat(stale), (error) => error?.code === 'ENOENT');
  assert.equal((await fs.readdir(resumeTempDir())).includes(path.basename(stale)), false);
});
