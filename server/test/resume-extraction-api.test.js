import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/db.js';
import { createReviewToken } from '../src/lib/resumeExtractionReview.js';
import { hashPassword } from '../src/lib/password.js';
import { closeSessionStore } from '../src/lib/session.js';
import { RESUME_STORAGE_ENV } from '../src/lib/resumeStorage.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';
import { emptyTextPdf, textPdf, validDocx, validPdf } from './resumeFileFixtures.js';

const TEST_EMAIL_PREFIX = 'stage75-extract-';
const createdEmails = [];
const previousStorage = process.env[RESUME_STORAGE_ENV];

let tempRoot;
let server;
let baseUrl;
let baseline;
let ictSafety;
let javaSkill;
let javaScriptSkill;

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

function sessionOf(result) {
  return {
    csrfToken: result.json.csrfToken,
    cookies: result.cookies,
  };
}

async function createAdmin() {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'admin');
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage Seven Five Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  return { email, ...(await loginAs(email)) };
}

async function createStaff() {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'staff');
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage Seven Five Staff',
      role: 'COMPANY_STAFF',
      termsAcceptedAt: new Date(),
    },
  });
  return { email, ...(await loginAs(email)) };
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
  const text = await response.text();
  return { response, json: text ? JSON.parse(text) : null, text };
}

function assertSafePayload(payload) {
  assertNoSecrets(payload);
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('"storedFilename"'), false);
  assert.equal(serialized.includes(tempRoot), false);
  assert.equal(serialized.includes('resume-storage'), false);
}

before(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-resume-extract-'));
  process.env[RESUME_STORAGE_ENV] = tempRoot;
  baseline = await snapshot();
  [ictSafety, javaSkill, javaScriptSkill] = await Promise.all([
    prisma.skill.findFirst({
      where: { sourceSystem: 'ESCO', preferredLabel: 'ICT safety' },
      select: { id: true, preferredLabel: true },
    }),
    prisma.skill.findFirst({
      where: { sourceSystem: 'ESCO', preferredLabel: 'Java (computer programming)' },
      select: { id: true, preferredLabel: true },
    }),
    prisma.skill.findFirst({
      where: { sourceSystem: 'ESCO', preferredLabel: 'JavaScript' },
      select: { id: true, preferredLabel: true },
    }),
  ]);
  assert.equal(Boolean(ictSafety?.id), true);
  assert.equal(Boolean(javaSkill?.id), true);
  assert.equal(Boolean(javaScriptSkill?.id), true);

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

test('extracts skills from a valid text PDF and DOCX', async () => {
  const student = await registerAs('pdf', { currentPosition: 'student' });
  const session = sessionOf(student);
  const resume = await createResume(session);
  const uploaded = await postFile(
    session,
    resume.id,
    textPdf('Used ICT safety and JavaScript on placement.'),
    'Software_CV.pdf',
  );
  assert.equal(uploaded.response.status, 201, uploaded.text);

  const extracted = await postJson(baseUrl, `/api/me/resumes/${resume.id}/extract-skills`, session, {});
  assert.equal(extracted.response.status, 200, extracted.text);
  assert.equal(extracted.json.extraction.readable, true);
  assert.equal(extracted.json.extraction.unreadable, false);
  assert.equal(typeof extracted.json.extraction.reviewToken, 'string');
  const labels = extracted.json.extraction.suggestions.map((item) => item.preferredLabel);
  assert.equal(labels.includes('ICT safety'), true);
  assert.equal(labels.includes('JavaScript'), true);
  assert.equal(labels.includes('Java (computer programming)'), false);
  assert.equal(
    extracted.json.extraction.suggestions.every((item) => item.alreadySaved === false),
    true,
  );
  assertSafePayload(extracted.json);

  const seeker = await registerAs('docx', { currentPosition: 'jobseeker' });
  const seekerSession = sessionOf(seeker);
  const seekerResume = await createResume(seekerSession, 'Seeker CV');
  const docx = await postFile(
    seekerSession,
    seekerResume.id,
    validDocx({
      document: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>ICT safety training completed.</w:t></w:r></w:p></w:body>
</w:document>`),
    }),
    'Seeker_CV.docx',
  );
  assert.equal(docx.response.status, 201, docx.text);
  const seekerExtract = await postJson(
    baseUrl,
    `/api/me/resumes/${seekerResume.id}/extract-skills`,
    seekerSession,
    {},
  );
  assert.equal(seekerExtract.response.status, 200, seekerExtract.text);
  assert.equal(
    seekerExtract.json.extraction.suggestions.some((item) => item.preferredLabel === 'ICT safety'),
    true,
  );
  assertSafePayload(seekerExtract.json);
});

test('missing, empty and unreadable documents do not write skills', async () => {
  const student = await registerAs('missing');
  const session = sessionOf(student);
  const resume = await createResume(session);

  const missing = await postJson(baseUrl, `/api/me/resumes/${resume.id}/extract-skills`, session, {});
  assert.equal(missing.response.status, 400, missing.text);
  assert.equal(missing.json.error, 'No resume file uploaded');

  const emptyUpload = await postFile(session, resume.id, emptyTextPdf(), 'Empty.pdf');
  assert.equal(emptyUpload.response.status, 201, emptyUpload.text);
  const emptyExtract = await postJson(baseUrl, `/api/me/resumes/${resume.id}/extract-skills`, session, {});
  assert.equal(emptyExtract.response.status, 200, emptyExtract.text);
  assert.equal(emptyExtract.json.extraction.unreadable, true);
  assert.equal(emptyExtract.json.extraction.reviewToken, null);
  assert.deepEqual(emptyExtract.json.extraction.suggestions, []);

  const catalogOnly = await postFile(session, resume.id, validPdf(), 'Catalog.pdf');
  assert.equal([200, 201].includes(catalogOnly.response.status), true, catalogOnly.text);
  const unreadable = await postJson(baseUrl, `/api/me/resumes/${resume.id}/extract-skills`, session, {});
  assert.equal(unreadable.json.extraction.unreadable, true);

  const skills = await requestJson(baseUrl, '/api/me/skills', { cookies: session.cookies });
  assert.deepEqual(skills.json.items, []);
});

test('cross-user, roles and CSRF are enforced', async () => {
  const owner = await registerAs('owner');
  const ownerSession = sessionOf(owner);
  const resume = await createResume(ownerSession);
  await postFile(ownerSession, resume.id, textPdf('ICT safety'), 'Owner.pdf');

  const other = await registerAs('other');
  const cross = await postJson(
    baseUrl,
    `/api/me/resumes/${resume.id}/extract-skills`,
    sessionOf(other),
    {},
  );
  assert.equal(cross.response.status, 404, cross.text);

  const staff = await createStaff();
  const staffExtract = await postJson(
    baseUrl,
    `/api/me/resumes/${resume.id}/extract-skills`,
    sessionOf(staff),
    {},
  );
  assert.equal(staffExtract.response.status, 403, staffExtract.text);

  const admin = await createAdmin();
  const adminExtract = await postJson(
    baseUrl,
    `/api/me/resumes/${resume.id}/extract-skills`,
    sessionOf(admin),
    {},
  );
  assert.equal(adminExtract.response.status, 403, adminExtract.text);

  const anon = await postJson(baseUrl, `/api/me/resumes/${resume.id}/extract-skills`, await primeCsrf(baseUrl), {});
  assert.equal(anon.response.status, 401, anon.text);

  const noCsrf = await requestJson(baseUrl, `/api/me/resumes/${resume.id}/extract-skills`, {
    method: 'POST',
    cookies: ownerSession.cookies,
    body: {},
  });
  assert.equal(noCsrf.response.status, 403, noCsrf.text);

  const extraFields = await postJson(baseUrl, `/api/me/resumes/${resume.id}/extract-skills`, ownerSession, {
    userId: other.json.user.id,
  });
  assert.equal(extraFields.response.status, 400, extraFields.text);
});

test('confirmation saves selected skills only and preserves existing proficiency', async () => {
  const student = await registerAs('confirm');
  const session = sessionOf(student);
  const resume = await createResume(session);
  await postFile(session, resume.id, textPdf('ICT safety and JavaScript.'), 'Skills.pdf');

  await postJson(baseUrl, '/api/me/skills', session, {
    skillId: ictSafety.id,
    proficiencyLevel: 'Advanced',
  });

  const extracted = await postJson(baseUrl, `/api/me/resumes/${resume.id}/extract-skills`, session, {});
  assert.equal(extracted.response.status, 200, extracted.text);
  const labels = extracted.json.extraction.suggestions.map((item) => item.preferredLabel);
  const js = extracted.json.extraction.suggestions.find((item) => item.preferredLabel === 'JavaScript');
  const ict = extracted.json.extraction.suggestions.find((item) => item.preferredLabel === 'ICT safety');
  assert.equal(Boolean(js), true, `missing JavaScript in ${labels.join(', ')}`);
  assert.equal(Boolean(ict), true, `missing ICT safety in ${labels.join(', ')}`);
  assert.equal(ict.alreadySaved, true);
  assert.equal(ict.existingProficiency, 'Advanced');
  assert.equal(js.alreadySaved, false);

  const cancelledCount = await prisma.userSkill.count({
    where: { userId: student.json.user.id },
  });
  assert.equal(cancelledCount, 1);

  const confirmed = await postJson(baseUrl, `/api/me/resumes/${resume.id}/confirm-skills`, session, {
    reviewToken: extracted.json.extraction.reviewToken,
    skillIds: [js.skillId, ict.skillId],
  });
  assert.equal(confirmed.response.status, 200, confirmed.text);
  assert.equal(confirmed.json.saved.length, 1);
  assert.equal(confirmed.json.saved[0].skill.preferredLabel, 'JavaScript');
  assert.equal(confirmed.json.saved[0].proficiencyLevel, 'Beginner');
  assert.equal(confirmed.json.skipped.length, 1);
  assert.equal(confirmed.json.skipped[0].skill.preferredLabel, 'ICT safety');
  assert.equal(confirmed.json.skipped[0].proficiencyLevel, 'Advanced');

  const listed = await requestJson(baseUrl, '/api/me/skills', { cookies: session.cookies });
  const byLabel = Object.fromEntries(listed.json.items.map((item) => [item.skill.preferredLabel, item.proficiencyLevel]));
  assert.equal(byLabel['ICT safety'], 'Advanced');
  assert.equal(byLabel.JavaScript, 'Beginner');

  const duplicate = await postJson(baseUrl, `/api/me/resumes/${resume.id}/confirm-skills`, session, {
    reviewToken: extracted.json.extraction.reviewToken,
    skillIds: [js.skillId],
  });
  assert.equal(duplicate.response.status, 200, duplicate.text);
  assert.equal(duplicate.json.saved.length, 0);
  assert.equal(duplicate.json.skipped.length, 1);
  assert.equal(listed.json.items.length, 2);
  const afterDuplicate = await requestJson(baseUrl, '/api/me/skills', { cookies: session.cookies });
  assert.equal(afterDuplicate.json.items.length, 2);
});

test('tampered, expired, replaced and arbitrary skill ids cannot be confirmed', async () => {
  const student = await registerAs('token');
  const session = sessionOf(student);
  const resume = await createResume(session);
  const uploaded = await postFile(session, resume.id, textPdf('ICT safety'), 'Token.pdf');
  const extracted = await postJson(baseUrl, `/api/me/resumes/${resume.id}/extract-skills`, session, {});
  const token = extracted.json.extraction.reviewToken;
  const ict = extracted.json.extraction.suggestions.find((item) => item.preferredLabel === 'ICT safety');

  const tampered = await postJson(baseUrl, `/api/me/resumes/${resume.id}/confirm-skills`, session, {
    reviewToken: `${token.slice(0, -3)}zzz`,
    skillIds: [ict.skillId],
  });
  assert.equal(tampered.response.status, 400, tampered.text);

  const expired = createReviewToken(
    {
      userId: student.json.user.id,
      resumeId: resume.id,
      sha256: uploaded.json.file.sha256,
      skillIds: [ict.skillId],
    },
    { secret: config.sessionSecret, ttlMs: 1, now: Date.now() - 20_000 },
  );
  const expiredResult = await postJson(baseUrl, `/api/me/resumes/${resume.id}/confirm-skills`, session, {
    reviewToken: expired,
    skillIds: [ict.skillId],
  });
  assert.equal(expiredResult.response.status, 400, expiredResult.text);
  assert.equal(expiredResult.json.error, 'Review has expired');

  const arbitrary = await postJson(baseUrl, `/api/me/resumes/${resume.id}/confirm-skills`, session, {
    reviewToken: token,
    skillIds: [javaScriptSkill.id],
  });
  assert.equal(arbitrary.response.status, 400, arbitrary.text);

  const withProficiency = await postJson(baseUrl, `/api/me/resumes/${resume.id}/confirm-skills`, session, {
    reviewToken: token,
    skillIds: [ict.skillId],
    proficiencyLevel: 'Advanced',
  });
  assert.equal(withProficiency.response.status, 400, withProficiency.text);

  const replaced = await postFile(session, resume.id, textPdf('JavaScript only'), 'Replaced.pdf');
  assert.equal(replaced.response.status, 200, replaced.text);
  const stale = await postJson(baseUrl, `/api/me/resumes/${resume.id}/confirm-skills`, session, {
    reviewToken: token,
    skillIds: [ict.skillId],
  });
  assert.equal(stale.response.status, 400, stale.text);

  const rollbackToken = createReviewToken(
    {
      userId: student.json.user.id,
      resumeId: resume.id,
      sha256: replaced.json.file.sha256,
      skillIds: [javaScriptSkill.id, '99999999-9999-4999-8999-999999999999'],
    },
    { secret: config.sessionSecret },
  );
  const rollback = await postJson(baseUrl, `/api/me/resumes/${resume.id}/confirm-skills`, session, {
    reviewToken: rollbackToken,
    skillIds: [javaScriptSkill.id, '99999999-9999-4999-8999-999999999999'],
  });
  assert.equal(rollback.response.status, 400, rollback.text);
  const skills = await requestJson(baseUrl, '/api/me/skills', { cookies: session.cookies });
  assert.deepEqual(skills.json.items, []);
});
