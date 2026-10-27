import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage57b-career-';
const TEST_OCCUPATION_SYSTEM = 'TEST-STAGE57B';
const FOOD_SERVICE_URI = 'http://data.europa.eu/esco/occupation/b4bff870-5c8f-4c33-b07f-f04d79830633';
const CHIEF_ICT_URI = 'http://data.europa.eu/esco/occupation/276ba420-ef09-4a0e-b215-2c2e2f80ad28';
const UNKNOWN_OCCUPATION_ID = '00000000-0000-4000-8000-000000000000';
const createdEmails = [];

let server;
let baseUrl;
let counts;
let foodService;
let chiefIct;

async function registerAs(label, body = {}) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/register', primed, validRegisterBody(email, body));
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

function putTarget(session, occupationId, extra = {}) {
  return requestJson(baseUrl, '/api/me/career-target', {
    method: 'PUT',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body: { occupationId, ...extra },
  });
}

before(async () => {
  counts = {
    occupations: await prisma.occupation.count(),
    skills: await prisma.skill.count(),
    relations: await prisma.occupationSkillRelation.count(),
    userSkills: await prisma.userSkill.count(),
  };

  foodService = await prisma.occupation.findFirst({
    where: { sourceUri: FOOD_SERVICE_URI, sourceSystem: 'ESCO' },
    select: { id: true, sourceUri: true, preferredLabel: true },
  });
  chiefIct = await prisma.occupation.findFirst({
    where: { sourceUri: CHIEF_ICT_URI, sourceSystem: 'ESCO' },
    select: { id: true, sourceUri: true, preferredLabel: true },
  });
  assert.ok(foodService, 'expected imported food service worker occupation');
  assert.ok(chiefIct, 'expected imported chief ICT security officer occupation');

  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await prisma.occupation.deleteMany({
    where: { sourceSystem: TEST_OCCUPATION_SYSTEM },
  });
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
  }

  assert.equal(await prisma.occupation.count(), counts.occupations);
  assert.equal(await prisma.skill.count(), counts.skills);
  assert.equal(await prisma.occupationSkillRelation.count(), counts.relations);
  assert.equal(await prisma.userSkill.count(), counts.userSkills);

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('unauthenticated career-target requests are rejected', async () => {
  const listed = await requestJson(baseUrl, '/api/me/career-target');
  assert.equal(listed.response.status, 401);
  assert.equal(listed.json.error, 'Unauthenticated');

  const primed = await primeCsrf(baseUrl);
  const saved = await putTarget(primed, foodService.id);
  assert.equal(saved.response.status, 401);

  const cleared = await requestJson(baseUrl, '/api/me/career-target', {
    method: 'DELETE',
    csrfToken: primed.csrfToken,
    cookies: primed.cookies,
  });
  assert.equal(cleared.response.status, 401);
  assertNoSecrets(listed.json);
});

test('company staff and admin cannot manage a career target', async () => {
  const staff = await registerAs('staff', { role: 'employer', currentPosition: undefined });
  const staffDenied = await requestJson(baseUrl, '/api/me/career-target', { cookies: staff.cookies });
  assert.equal(staffDenied.response.status, 403);
  assert.equal(staffDenied.json.error, 'Forbidden');

  const staffPut = await putTarget(sessionOf(staff), foodService.id, {
    userId: staff.json.user.id,
    role: 'STUDENT',
  });
  assert.equal(staffPut.response.status, 403);

  const adminEmail = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'admin');
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage 5.7B Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const admin = await loginAs(adminEmail);
  const adminDenied = await requestJson(baseUrl, '/api/me/career-target', { cookies: admin.cookies });
  assert.equal(adminDenied.response.status, 403);
  assert.equal(adminDenied.json.error, 'Forbidden');
  assertNoSecrets(adminDenied.json);
});

test('suspended accounts cannot read or change a career target', async () => {
  const registered = await registerAs('suspended');
  await prisma.user.update({
    where: { email: registered.email },
    data: { accountStatus: 'SUSPENDED' },
  });

  const listed = await requestJson(baseUrl, '/api/me/career-target', { cookies: registered.cookies });
  assert.equal(listed.response.status, 403);
  assert.equal(listed.json.error, 'Account is unavailable');

  const saved = await putTarget(sessionOf(registered), foodService.id);
  assert.equal(saved.response.status, 403);
  assert.equal(saved.json.error, 'Account is unavailable');
});

test('mutations without a valid CSRF token are rejected', async () => {
  const student = await registerAs('csrf');
  const missing = await requestJson(baseUrl, '/api/me/career-target', {
    method: 'PUT',
    cookies: student.cookies,
    body: { occupationId: foodService.id },
  });
  assert.equal(missing.response.status, 403);
  assert.equal(missing.json.error, 'Invalid CSRF token');

  const invalid = await putTarget(
    { csrfToken: 'not-a-csrf-token', cookies: student.cookies },
    foodService.id,
  );
  assert.equal(invalid.response.status, 403);
  assert.equal(invalid.json.error, 'Invalid CSRF token');

  const invalidDelete = await requestJson(baseUrl, '/api/me/career-target', {
    method: 'DELETE',
    csrfToken: 'not-a-csrf-token',
    cookies: student.cookies,
  });
  assert.equal(invalidDelete.response.status, 403);
});

test('students and job seekers can set, read, change and clear only their own target', async () => {
  const student = await registerAs('owner', { currentPosition: 'student' });
  const other = await registerAs('other', { currentPosition: 'student' });
  const jobSeeker = await registerAs('job', { currentPosition: 'jobseeker' });

  const empty = await requestJson(baseUrl, '/api/me/career-target', { cookies: student.cookies });
  assert.equal(empty.response.status, 200);
  assert.equal(empty.json.occupation, null);

  const extraIdentity = await putTarget(sessionOf(student), foodService.id, {
    userId: other.json.user.id,
    role: 'ADMIN',
  });
  assert.equal(extraIdentity.response.status, 400);
  assert.equal(extraIdentity.json.error, 'Invalid request');

  const saved = await putTarget(sessionOf(student), foodService.id);
  assert.equal(saved.response.status, 200, saved.text);
  assert.equal(saved.json.occupation.id, foodService.id);
  assert.equal(saved.json.occupation.preferredLabel, 'food service worker');
  assert.equal(saved.json.occupation.sourceUri, FOOD_SERVICE_URI);
  assert.equal(saved.json.userId, undefined);

  const read = await requestJson(baseUrl, `/api/me/career-target?userId=${other.json.user.id}&role=ADMIN`, {
    cookies: student.cookies,
  });
  assert.equal(read.response.status, 200);
  assert.equal(read.json.occupation.id, foodService.id);

  const changed = await putTarget(sessionOf(student), chiefIct.id);
  assert.equal(changed.response.status, 200);
  assert.equal(changed.json.occupation.id, chiefIct.id);
  assert.equal(changed.json.occupation.preferredLabel, 'chief ICT security officer');

  const otherView = await requestJson(baseUrl, '/api/me/career-target', { cookies: other.cookies });
  assert.equal(otherView.json.occupation, null);

  const jobSaved = await putTarget(sessionOf(jobSeeker), foodService.id);
  assert.equal(jobSaved.response.status, 200);
  assert.equal(jobSaved.json.occupation.id, foodService.id);

  const cleared = await requestJson(baseUrl, '/api/me/career-target', {
    method: 'DELETE',
    ...sessionOf(student),
  });
  assert.equal(cleared.response.status, 200);
  assert.equal(cleared.json.occupation, null);
  const afterClear = await requestJson(baseUrl, '/api/me/career-target', { cookies: student.cookies });
  assert.equal(afterClear.json.occupation, null);
  assertNoSecrets(saved.json);
});

test('invalid UUID and unknown occupations are rejected', async () => {
  const student = await registerAs('invalid');
  const invalid = await putTarget(sessionOf(student), 'not-a-uuid');
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.json.error, 'Invalid request');

  const missing = await putTarget(sessionOf(student), UNKNOWN_OCCUPATION_ID);
  assert.equal(missing.response.status, 404);
  assert.equal(missing.json.error, 'Not found');

  const nonEsco = await prisma.occupation.create({
    data: {
      sourceSystem: TEST_OCCUPATION_SYSTEM,
      sourceUri: `http://peaceone.test/occupation/non-esco-${student.json.user.id}`,
      preferredLabel: 'stage 5.7b non-esco occupation',
    },
  });
  const rejected = await putTarget(sessionOf(student), nonEsco.id);
  assert.equal(rejected.response.status, 404);
  await prisma.occupation.delete({ where: { id: nonEsco.id } });
  assertNoSecrets(missing.json);
});

test('a missing session user cannot use leftover career-target routes', async () => {
  const student = await registerAs('missing-user');
  const saved = await putTarget(sessionOf(student), foodService.id);
  assert.equal(saved.response.status, 200, saved.text);

  await prisma.user.delete({ where: { email: student.email } });
  createdEmails.splice(createdEmails.indexOf(student.email), 1);

  const listed = await requestJson(baseUrl, '/api/me/career-target', { cookies: student.cookies });
  assert.equal(listed.response.status, 401);
  assert.equal(listed.json.error, 'Unauthenticated');
});

test('clearing a career target does not delete recorded skills', async () => {
  const student = await registerAs('keep-skills');
  const skill = await prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO' },
    select: { id: true },
  });
  assert.ok(skill);

  const recorded = await prisma.userSkill.create({
    data: {
      userId: student.json.user.id,
      skillId: skill.id,
      proficiencyLevel: 'Beginner',
    },
  });

  const saved = await putTarget(sessionOf(student), foodService.id);
  assert.equal(saved.response.status, 200, saved.text);

  const cleared = await requestJson(baseUrl, '/api/me/career-target', {
    method: 'DELETE',
    ...sessionOf(student),
  });
  assert.equal(cleared.response.status, 200);
  assert.equal(cleared.json.occupation, null);

  const remaining = await prisma.userSkill.findUnique({ where: { id: recorded.id } });
  assert.ok(remaining);
  assert.equal(remaining.userId, student.json.user.id);
  assert.equal(remaining.skillId, skill.id);
  assert.equal(remaining.proficiencyLevel, 'Beginner');

  await prisma.userSkill.delete({ where: { id: recorded.id } });
});

test('deleting an occupation nulls the target and does not delete the user', async () => {
  const student = await registerAs('set-null');
  const disposable = await prisma.occupation.create({
    data: {
      sourceSystem: TEST_OCCUPATION_SYSTEM,
      sourceUri: `http://peaceone.test/occupation/${student.json.user.id}`,
      preferredLabel: 'stage 5.7b disposable occupation',
    },
  });

  await prisma.user.update({
    where: { id: student.json.user.id },
    data: { targetOccupationId: disposable.id },
  });

  await prisma.occupation.delete({ where: { id: disposable.id } });

  const user = await prisma.user.findUnique({
    where: { id: student.json.user.id },
    select: { id: true, targetOccupationId: true },
  });
  assert.ok(user);
  assert.equal(user.targetOccupationId, null);

  const listed = await requestJson(baseUrl, '/api/me/career-target', { cookies: student.cookies });
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.occupation, null);
});
