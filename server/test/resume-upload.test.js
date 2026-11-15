import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';
import { closeSessionStore } from '../src/lib/session.js';
import { storeOwnedResumeFile } from '../src/lib/resumeFileQuery.js';
import { RESUME_STORAGE_ENV, resumeFilePath, storedResumeFileExists } from '../src/lib/resumeStorage.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';
import {
  htmlDocument,
  macroDocx,
  malformedDocx,
  malformedPdf,
  oversizedPdf,
  renamedExecutable,
  validDocx,
  validPdf,
  zipBombDocx,
} from './resumeFileFixtures.js';

const TEST_EMAIL_PREFIX = 'stage74b-upload-';
const createdEmails = [];
const previousStorage = process.env[RESUME_STORAGE_ENV];

let tempRoot;
let server;
let baseUrl;
let baseline;

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
      fullName: 'Stage Seven Four B Admin',
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

async function postFile(session, resumeId, buffer, filename, mime = 'application/octet-stream', extraHeaders = {}) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), filename);
  const headers = {
    Cookie: session.cookies,
    ...extraHeaders,
  };
  if (session.csrfToken && extraHeaders['x-csrf-token'] !== null) {
    headers['x-csrf-token'] = extraHeaders['x-csrf-token'] ?? session.csrfToken;
  }
  if (extraHeaders['x-csrf-token'] === null) {
    delete headers['x-csrf-token'];
  }
  const response = await fetch(`${baseUrl}/api/me/resumes/${resumeId}/file`, {
    method: 'POST',
    headers,
    body: form,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, json, text };
}

function assertSafeFilePayload(payload) {
  assertNoSecrets(payload);
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('"storedFilename"'), false);
  assert.equal(serialized.includes(tempRoot), false);
  assert.equal(serialized.includes('resume-storage'), false);
}

before(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-resume-upload-'));
  process.env[RESUME_STORAGE_ENV] = tempRoot;
  baseline = await snapshot();

  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
  }

  const finalSnapshot = await snapshot();
  assert.deepEqual(finalSnapshot, baseline);

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

test('students can upload a valid PDF and job seekers can upload a valid DOCX', async () => {
  const student = await registerAs('pdf', { currentPosition: 'student' });
  const resume = await createResume(sessionOf(student));
  assert.equal(resume.file, null);

  const uploaded = await postFile(
    sessionOf(student),
    resume.id,
    validPdf(),
    'Software_CV.pdf',
    'application/x-msdownload',
  );
  assert.equal(uploaded.response.status, 201, uploaded.text);
  assert.equal(uploaded.json.file.originalFilename, 'Software_CV.pdf');
  assert.equal(uploaded.json.file.contentType, 'application/pdf');
  assert.equal(uploaded.json.file.byteSize, validPdf().length);
  assert.equal(typeof uploaded.json.file.sha256, 'string');
  assert.equal(uploaded.json.file.storedFilename, undefined);
  assertSafeFilePayload(uploaded.json);

  const listed = await requestJson(baseUrl, '/api/me/resumes', { cookies: student.cookies });
  assert.equal(listed.json.items[0].file.originalFilename, 'Software_CV.pdf');
  assertSafeFilePayload(listed.json);

  const jobSeeker = await registerAs('docx', { currentPosition: 'jobseeker' });
  const seekerResume = await createResume(sessionOf(jobSeeker), 'Seeker CV');
  const docx = await postFile(sessionOf(jobSeeker), seekerResume.id, validDocx(), 'Seeker_CV.docx');
  assert.equal(docx.response.status, 201, docx.text);
  assert.equal(docx.json.file.contentType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assertSafeFilePayload(docx.json);
});

test('invalid files are rejected without storing metadata', async () => {
  const student = await registerAs('invalid');
  const resume = await createResume(sessionOf(student));

  const cases = [
    [validPdf(), 'resume.docx', 400, 'Unsupported file format'],
    [renamedExecutable(), 'resume.pdf', 400, 'Unsupported file format'],
    [htmlDocument(), 'resume.pdf', 400, 'Unsupported file format'],
    [Buffer.alloc(0), 'resume.pdf', 400, 'File is empty'],
    [oversizedPdf(), 'resume.pdf', 413, 'File too large'],
    [malformedPdf(), 'resume.pdf', 400, 'Corrupted file'],
    [malformedDocx(), 'resume.docx', 400, 'Corrupted file'],
    [zipBombDocx(), 'resume.docx', 400, 'Corrupted file'],
    [macroDocx(), 'resume.docx', 400, 'Unsupported file format'],
  ];

  for (const [buffer, filename, status, message] of cases) {
    const result = await postFile(sessionOf(student), resume.id, buffer, filename, 'application/pdf');
    assert.equal(result.response.status, status, `${filename} ${result.text}`);
    assert.equal(result.json.error, message);
    assertSafeFilePayload(result.json);
  }

  assert.equal(await prisma.resumeFile.count({ where: { resumeId: resume.id } }), 0);
});

test('unauthenticated, CSRF, staff and admin uploads are rejected', async () => {
  const student = await registerAs('authz');
  const resume = await createResume(sessionOf(student));

  const primed = await primeCsrf(baseUrl);
  const unauthenticated = await postFile(primed, resume.id, validPdf(), 'resume.pdf');
  assert.equal(unauthenticated.response.status, 401);

  const missingCsrf = await postFile(sessionOf(student), resume.id, validPdf(), 'resume.pdf', 'application/pdf', {
    'x-csrf-token': null,
  });
  assert.equal(missingCsrf.response.status, 403);
  assert.equal(missingCsrf.json.error, 'Invalid CSRF token');

  const staff = await registerAs('staff', { role: 'employer', currentPosition: undefined });
  const staffUpload = await postFile(sessionOf(staff), resume.id, validPdf(), 'resume.pdf');
  assert.equal(staffUpload.response.status, 403);

  const admin = await createAdmin();
  const adminUpload = await postFile(sessionOf(admin), resume.id, validPdf(), 'resume.pdf');
  assert.equal(adminUpload.response.status, 403);
});

test('cross-user uploads cannot attach a file to another candidate resume', async () => {
  const owner = await registerAs('owner');
  const other = await registerAs('other');
  const resume = await createResume(sessionOf(owner));

  const blocked = await postFile(sessionOf(other), resume.id, validPdf(), 'resume.pdf');
  assert.equal(blocked.response.status, 404);
  assert.equal(blocked.json.error, 'Not found');
  assert.equal(await prisma.resumeFile.count({ where: { resumeId: resume.id } }), 0);
});

test('replacement succeeds and duplicate SHA-256 does not create a second file', async () => {
  const student = await registerAs('replace');
  const resume = await createResume(sessionOf(student));
  const first = await postFile(sessionOf(student), resume.id, validPdf(), 'first.pdf');
  assert.equal(first.response.status, 201, first.text);

  const duplicate = await postFile(sessionOf(student), resume.id, validPdf(), 'first-again.pdf');
  assert.equal(duplicate.response.status, 200, duplicate.text);
  assert.equal(duplicate.json.unchanged, true);
  assert.equal(duplicate.json.file.id, first.json.file.id);
  assert.equal(duplicate.json.file.originalFilename, 'first.pdf');
  assert.equal(await prisma.resumeFile.count({ where: { resumeId: resume.id } }), 1);

  const replaced = await postFile(sessionOf(student), resume.id, validDocx(), 'second.docx');
  assert.equal(replaced.response.status, 200, replaced.text);
  assert.equal(replaced.json.unchanged, undefined);
  assert.equal(replaced.json.file.originalFilename, 'second.docx');
  assert.equal(replaced.json.file.contentType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(await prisma.resumeFile.count({ where: { resumeId: resume.id } }), 1);

  const record = await prisma.resumeFile.findUnique({ where: { resumeId: resume.id } });
  assert.equal(await storedResumeFileExists(record.userId, resume.id, record.storedFilename), true);
});

test('failed replacement preserves the original stored file and metadata', async () => {
  const student = await registerAs('preserve');
  const resume = await createResume(sessionOf(student));
  const first = await postFile(sessionOf(student), resume.id, validPdf(), 'keep.pdf');
  assert.equal(first.response.status, 201, first.text);
  const before = await prisma.resumeFile.findUnique({ where: { resumeId: resume.id } });
  const originalPath = resumeFilePath(before.userId, resume.id, before.storedFilename);

  const rejected = await postFile(sessionOf(student), resume.id, renamedExecutable(), 'keep.pdf');
  assert.equal(rejected.response.status, 400);
  const afterValidation = await prisma.resumeFile.findUnique({ where: { resumeId: resume.id } });
  assert.equal(afterValidation.sha256, before.sha256);
  assert.equal(afterValidation.storedFilename, before.storedFilename);
  assert.equal(await storedResumeFileExists(before.userId, resume.id, before.storedFilename), true);

  const originalTransaction = prisma.$transaction.bind(prisma);
  prisma.$transaction = async () => {
    throw new Error('forced metadata failure');
  };
  try {
    await assert.rejects(
      () =>
        storeOwnedResumeFile(
          prisma,
          before.userId,
          resume.id,
          { buffer: validDocx(), originalFilename: 'new.docx' },
        ),
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }

  const afterFailure = await prisma.resumeFile.findUnique({ where: { resumeId: resume.id } });
  assert.equal(afterFailure.storedFilename, before.storedFilename);
  assert.equal(afterFailure.sha256, before.sha256);
  assert.equal(await fs.readFile(originalPath).then((buffer) => buffer.equals(validPdf())), true);
});
