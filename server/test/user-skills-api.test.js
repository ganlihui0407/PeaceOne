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

const TEST_EMAIL_PREFIX = 'stage56b-userskills-';
const ICT_SAFETY_URI = 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2';
const UNKNOWN_SKILL_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const UNKNOWN_RECORD_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const createdEmails = [];

let server;
let baseUrl;
let counts;
let ictSafety;
let otherSkill;

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

before(async () => {
  counts = {
    occupations: await prisma.occupation.count(),
    skills: await prisma.skill.count(),
    relations: await prisma.occupationSkillRelation.count(),
    userSkills: await prisma.userSkill.count(),
  };

  ictSafety = await prisma.skill.findFirst({
    where: { sourceUri: ICT_SAFETY_URI, sourceSystem: 'ESCO' },
    select: { id: true, sourceUri: true, preferredLabel: true, skillType: true },
  });
  otherSkill = await prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', NOT: { sourceUri: ICT_SAFETY_URI } },
    orderBy: { preferredLabel: 'asc' },
    select: { id: true, sourceUri: true, preferredLabel: true },
  });
  assert.ok(ictSafety, 'expected imported ICT safety skill');
  assert.ok(otherSkill, 'expected a second imported ESCO skill');

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

  assert.equal(await prisma.occupation.count(), counts.occupations);
  assert.equal(await prisma.skill.count(), counts.skills);
  assert.equal(await prisma.occupationSkillRelation.count(), counts.relations);
  assert.equal(await prisma.userSkill.count(), counts.userSkills);

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('unauthenticated user-skill requests are rejected', async () => {
  const list = await requestJson(baseUrl, '/api/me/skills');
  assert.equal(list.response.status, 401);
  assert.equal(list.json.error, 'Unauthenticated');
  assertNoSecrets(list.json);

  const primed = await primeCsrf(baseUrl);
  const created = await postJson(baseUrl, '/api/me/skills', primed, {
    skillId: ictSafety.id,
    proficiencyLevel: 'Beginner',
  });
  assert.equal(created.response.status, 401);
  assert.equal(created.json.error, 'Unauthenticated');
});

test('company staff and admin cannot manage recorded skills', async () => {
  const staff = await registerAs('staff', { role: 'employer', currentPosition: undefined });
  const staffDenied = await requestJson(baseUrl, '/api/me/skills', { cookies: staff.cookies });
  assert.equal(staffDenied.response.status, 403);
  assert.equal(staffDenied.json.error, 'Forbidden');

  const staffPost = await postJson(baseUrl, '/api/me/skills', sessionOf(staff), {
    skillId: ictSafety.id,
    proficiencyLevel: 'Beginner',
    userId: staff.json.user.id,
    role: 'STUDENT',
  });
  assert.equal(staffPost.response.status, 403);

  const adminEmail = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'admin');
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage 5.6B Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const admin = await loginAs(adminEmail);
  const adminDenied = await requestJson(baseUrl, '/api/me/skills', { cookies: admin.cookies });
  assert.equal(adminDenied.response.status, 403);
  assert.equal(adminDenied.json.error, 'Forbidden');
  assertNoSecrets(adminDenied.json);
});

test('suspended accounts cannot list or change recorded skills', async () => {
  const registered = await registerAs('suspended');
  await prisma.user.update({
    where: { email: registered.email },
    data: { accountStatus: 'SUSPENDED' },
  });

  const list = await requestJson(baseUrl, '/api/me/skills', { cookies: registered.cookies });
  assert.equal(list.response.status, 403);
  assert.equal(list.json.error, 'Account is unavailable');

  const created = await postJson(baseUrl, '/api/me/skills', sessionOf(registered), {
    skillId: ictSafety.id,
    proficiencyLevel: 'Beginner',
  });
  assert.equal(created.response.status, 403);
  assert.equal(created.json.error, 'Account is unavailable');
});

test('mutations without a valid CSRF token are rejected', async () => {
  const student = await registerAs('csrf');
  const missing = await requestJson(baseUrl, '/api/me/skills', {
    method: 'POST',
    cookies: student.cookies,
    body: { skillId: ictSafety.id, proficiencyLevel: 'Beginner' },
  });
  assert.equal(missing.response.status, 403);
  assert.equal(missing.json.error, 'Invalid CSRF token');

  const invalid = await postJson(
    baseUrl,
    '/api/me/skills',
    { csrfToken: 'not-a-csrf-token', cookies: student.cookies },
    { skillId: ictSafety.id, proficiencyLevel: 'Beginner' },
  );
  assert.equal(invalid.response.status, 403);
  assert.equal(invalid.json.error, 'Invalid CSRF token');
});

test('students and job seekers can create, list, update and delete only their own skills', async () => {
  const student = await registerAs('owner', { currentPosition: 'student' });
  const other = await registerAs('other', { currentPosition: 'student' });
  const jobSeeker = await registerAs('job', { currentPosition: 'jobseeker' });

  const empty = await requestJson(baseUrl, '/api/me/skills', { cookies: student.cookies });
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.json.items, []);

  const created = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: ictSafety.id,
    proficiencyLevel: 'Beginner',
  });
  assert.equal(created.response.status, 201, created.text);
  assert.equal(created.json.userSkill.proficiencyLevel, 'Beginner');
  assert.equal(created.json.userSkill.skill.id, ictSafety.id);
  assert.equal(created.json.userSkill.skill.sourceUri, ICT_SAFETY_URI);
  assert.equal(created.json.userSkill.skill.preferredLabel, ictSafety.preferredLabel);
  assert.equal(created.json.userSkill.skill.skillType, null);
  assert.equal(created.json.userSkill.skill.sourceSystem, 'ESCO');
  assert.equal(created.json.userId, undefined);
  assertNoSecrets(created.json);

  const otherCreated = await postJson(baseUrl, '/api/me/skills', sessionOf(other), {
    skillId: otherSkill.id,
    proficiencyLevel: 'Advanced',
  });
  assert.equal(otherCreated.response.status, 201, otherCreated.text);

  const jobCreated = await postJson(baseUrl, '/api/me/skills', sessionOf(jobSeeker), {
    skillId: otherSkill.id,
    proficiencyLevel: 'Intermediate',
  });
  assert.equal(jobCreated.response.status, 201, jobCreated.text);

  const listed = await requestJson(baseUrl, '/api/me/skills', { cookies: student.cookies });
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.items.length, 1);
  assert.equal(listed.json.items[0].id, created.json.userSkill.id);
  assert.equal(listed.json.items[0].skill.id, ictSafety.id);
  assert.equal(
    listed.json.items.some((item) => item.id === otherCreated.json.userSkill.id),
    false,
  );
  assertNoSecrets(listed.json);

  const updated = await requestJson(baseUrl, `/api/me/skills/${created.json.userSkill.id}`, {
    method: 'PATCH',
    ...sessionOf(student),
    body: { proficiencyLevel: 'Advanced' },
  });
  assert.equal(updated.response.status, 200, updated.text);
  assert.equal(updated.json.userSkill.proficiencyLevel, 'Advanced');
  assert.equal(updated.json.userSkill.id, created.json.userSkill.id);

  const foreignUpdate = await requestJson(baseUrl, `/api/me/skills/${otherCreated.json.userSkill.id}`, {
    method: 'PATCH',
    ...sessionOf(student),
    body: { proficiencyLevel: 'Beginner' },
  });
  assert.equal(foreignUpdate.response.status, 404);
  assert.equal(foreignUpdate.json.error, 'Not found');

  const stillOther = await prisma.userSkill.findUnique({
    where: { id: otherCreated.json.userSkill.id },
  });
  assert.equal(stillOther.proficiencyLevel, 'Advanced');

  const foreignDelete = await requestJson(baseUrl, `/api/me/skills/${otherCreated.json.userSkill.id}`, {
    method: 'DELETE',
    ...sessionOf(student),
  });
  assert.equal(foreignDelete.response.status, 404);
  assert.equal(foreignDelete.json.error, 'Not found');
  assert.ok(await prisma.userSkill.findUnique({ where: { id: otherCreated.json.userSkill.id } }));

  const removed = await requestJson(baseUrl, `/api/me/skills/${created.json.userSkill.id}`, {
    method: 'DELETE',
    ...sessionOf(student),
  });
  assert.equal(removed.response.status, 200);
  assert.deepEqual(removed.json, { ok: true });
  assert.equal(await prisma.userSkill.findUnique({ where: { id: created.json.userSkill.id } }), null);

  const afterDelete = await requestJson(baseUrl, '/api/me/skills', { cookies: student.cookies });
  assert.equal(afterDelete.json.items.length, 0);
});

test('invalid proficiency, malformed IDs, unknown skills and duplicates are rejected', async () => {
  const student = await registerAs('validation');

  const invalidProficiency = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: ictSafety.id,
    proficiencyLevel: 'intermediate',
  });
  assert.equal(invalidProficiency.response.status, 400);
  assert.equal(invalidProficiency.json.error, 'Invalid request');

  const extraUserId = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: ictSafety.id,
    proficiencyLevel: 'Beginner',
    userId: student.json.user.id,
  });
  assert.equal(extraUserId.response.status, 400);
  assert.equal(extraUserId.json.error, 'Invalid request');

  const malformedSkill = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: 'not-a-uuid',
    proficiencyLevel: 'Beginner',
  });
  assert.equal(malformedSkill.response.status, 400);

  const unknownSkill = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: UNKNOWN_SKILL_ID,
    proficiencyLevel: 'Beginner',
  });
  assert.equal(unknownSkill.response.status, 404);
  assert.equal(unknownSkill.json.error, 'Not found');

  const created = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: ictSafety.id,
    proficiencyLevel: 'Beginner',
  });
  assert.equal(created.response.status, 201, created.text);

  const duplicate = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: ictSafety.id,
    proficiencyLevel: 'Advanced',
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.json.error, 'Already recorded');
  assertNoSecrets(duplicate.json);

  const malformedRecord = await requestJson(baseUrl, '/api/me/skills/not-a-uuid', {
    method: 'PATCH',
    ...sessionOf(student),
    body: { proficiencyLevel: 'Advanced' },
  });
  assert.equal(malformedRecord.response.status, 400);
  assert.equal(malformedRecord.json.error, 'Invalid request');

  const missingRecord = await requestJson(baseUrl, `/api/me/skills/${UNKNOWN_RECORD_ID}`, {
    method: 'PATCH',
    ...sessionOf(student),
    body: { proficiencyLevel: 'Advanced' },
  });
  assert.equal(missingRecord.response.status, 404);
  assert.equal(missingRecord.json.error, 'Not found');

  const remaining = await prisma.userSkill.count({
    where: { userId: student.json.user.id },
  });
  assert.equal(remaining, 1);
});

test('a missing session user cannot access leftover skill routes', async () => {
  const student = await registerAs('missing-user');
  const created = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: ictSafety.id,
    proficiencyLevel: 'Intermediate',
  });
  assert.equal(created.response.status, 201, created.text);

  await prisma.user.delete({ where: { email: student.email } });
  createdEmails.splice(createdEmails.indexOf(student.email), 1);

  const list = await requestJson(baseUrl, '/api/me/skills', { cookies: student.cookies });
  assert.equal(list.response.status, 401);
  assert.equal(list.json.error, 'Unauthenticated');

  const update = await requestJson(baseUrl, `/api/me/skills/${created.json.userSkill.id}`, {
    method: 'PATCH',
    ...sessionOf(student),
    body: { proficiencyLevel: 'Advanced' },
  });
  assert.equal(update.response.status, 401);

  assert.equal(await prisma.userSkill.findUnique({ where: { id: created.json.userSkill.id } }), null);
});
