import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import { SKILL_GAP_RELATION_LIMIT } from '../src/lib/skillGapQuery.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage56d-skillgap-';
const ICT_SAFETY_URI = 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2';
const SQL_URI = 'http://data.europa.eu/esco/skill/598de5b0-5b58-4ea7-8058-a4bc4d18c742';
const CHIEF_ICT_URI = 'http://data.europa.eu/esco/occupation/276ba420-ef09-4a0e-b215-2c2e2f80ad28';
const UNKNOWN_OCCUPATION_ID = '00000000-0000-4000-8000-000000000000';
const createdEmails = [];

let server;
let baseUrl;
let counts;
let occupation;
let ictSafety;
let ictRelationType;

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

function gapPath(occupationId, extra = '') {
  return `/api/me/skill-gap?occupationId=${occupationId}${extra}`;
}

function assertReadOnlyShape(json) {
  assert.equal(Object.hasOwn(json, 'overallMatch'), false);
  assert.equal(Object.hasOwn(json, 'matchPercentage'), false);
  assert.equal(JSON.stringify(json).includes('72%'), false);
  assert.equal(json.userId, undefined);
  assert.equal(json.role, undefined);
}

before(async () => {
  counts = {
    occupations: await prisma.occupation.count(),
    skills: await prisma.skill.count(),
    relations: await prisma.occupationSkillRelation.count(),
    userSkills: await prisma.userSkill.count(),
  };

  occupation = await prisma.occupation.findFirst({
    where: { sourceUri: CHIEF_ICT_URI, sourceSystem: 'ESCO' },
    select: { id: true, sourceUri: true, preferredLabel: true },
  });
  ictSafety = await prisma.skill.findFirst({
    where: { sourceUri: ICT_SAFETY_URI, sourceSystem: 'ESCO' },
    select: { id: true, sourceUri: true, preferredLabel: true, skillType: true },
  });
  assert.ok(occupation, 'expected imported chief ICT security officer occupation');
  assert.ok(ictSafety, 'expected imported ICT safety skill');

  const relation = await prisma.occupationSkillRelation.findFirst({
    where: { occupationId: occupation.id, skillId: ictSafety.id, sourceSystem: 'ESCO' },
    select: { relationType: true },
  });
  assert.ok(relation, 'expected ICT safety to be linked to the occupation');
  ictRelationType = relation.relationType;

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

test('unauthenticated skill-gap requests are rejected', async () => {
  const result = await requestJson(baseUrl, gapPath(occupation.id));
  assert.equal(result.response.status, 401);
  assert.equal(result.json.error, 'Unauthenticated');
  assertNoSecrets(result.json);
});

test('company staff and admin cannot compare recorded skills', async () => {
  const staff = await registerAs('staff', { role: 'employer', currentPosition: undefined });
  const staffDenied = await requestJson(baseUrl, gapPath(occupation.id), { cookies: staff.cookies });
  assert.equal(staffDenied.response.status, 403);
  assert.equal(staffDenied.json.error, 'Forbidden');

  const withClientRole = await requestJson(baseUrl, `${gapPath(occupation.id)}&role=STUDENT&userId=${staff.json.user.id}`, {
    cookies: staff.cookies,
  });
  assert.equal(withClientRole.response.status, 403);

  const adminEmail = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'admin');
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage 5.6D Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const admin = await loginAs(adminEmail);
  const adminDenied = await requestJson(baseUrl, gapPath(occupation.id), { cookies: admin.cookies });
  assert.equal(adminDenied.response.status, 403);
  assert.equal(adminDenied.json.error, 'Forbidden');
  assertNoSecrets(adminDenied.json);
});

test('suspended accounts cannot run skill-gap comparison', async () => {
  const registered = await registerAs('suspended');
  await prisma.user.update({
    where: { email: registered.email },
    data: { accountStatus: 'SUSPENDED' },
  });

  const result = await requestJson(baseUrl, gapPath(occupation.id), { cookies: registered.cookies });
  assert.equal(result.response.status, 403);
  assert.equal(result.json.error, 'Account is unavailable');
});

test('invalid and missing occupation IDs are rejected', async () => {
  const student = await registerAs('invalid');
  const missingParam = await requestJson(baseUrl, '/api/me/skill-gap', { cookies: student.cookies });
  assert.equal(missingParam.response.status, 400);
  assert.equal(missingParam.json.error, 'Invalid request');

  const invalid = await requestJson(baseUrl, '/api/me/skill-gap?occupationId=not-a-uuid', {
    cookies: student.cookies,
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.json.error, 'Invalid request');

  const missing = await requestJson(baseUrl, gapPath(UNKNOWN_OCCUPATION_ID), { cookies: student.cookies });
  assert.equal(missing.response.status, 404);
  assert.equal(missing.json.error, 'Not found');
  assertNoSecrets(missing.json);
});

test('empty user-skill records keep occupation skills as not recorded', async () => {
  const student = await registerAs('empty');
  const beforeUserSkills = await prisma.userSkill.count();
  const result = await requestJson(baseUrl, gapPath(occupation.id), { cookies: student.cookies });
  assert.equal(result.response.status, 200, result.text);
  assert.equal(result.json.occupation.id, occupation.id);
  assert.equal(result.json.occupation.preferredLabel, 'chief ICT security officer');
  assert.equal(result.json.occupation.sourceUri, CHIEF_ICT_URI);
  assert.equal(result.json.recordedSkillCount, 0);
  assert.ok(result.json.totals.relations >= 2);
  assert.ok(result.json.totals.essential.total >= 1);
  assert.ok(result.json.totals.optional.total >= 1);
  assert.equal(result.json.totals.essential.recorded, 0);
  assert.equal(result.json.totals.optional.recorded, 0);
  assert.equal(result.json.items.length, result.json.totals.relations);
  assert.equal(result.json.items.length <= SKILL_GAP_RELATION_LIMIT, true);
  assert.equal(result.json.items.every((item) => item.recorded === false), true);
  assert.equal(result.json.items.every((item) => item.proficiencyLevel === null), true);
  assert.equal(result.json.matchedOccupationSkillCount, 0);
  assert.deepEqual(result.json.unmatchedRecordedSkills, []);
  assert.equal(
    result.json.items.every((item) => item.relationType === 'essential' || item.relationType === 'optional'),
    true,
  );
  assertReadOnlyShape(result.json);
  assertNoSecrets(result.json);
  assert.equal(await prisma.userSkill.count(), beforeUserSkills);
});

test('students and job seekers compare recorded and unrecorded occupation skills', async () => {
  const student = await registerAs('owner', { currentPosition: 'student' });
  const other = await registerAs('other', { currentPosition: 'student' });
  const jobSeeker = await registerAs('job', { currentPosition: 'jobseeker' });

  const created = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: ictSafety.id,
    proficiencyLevel: 'Beginner',
  });
  assert.equal(created.response.status, 201, created.text);
  const afterCreate = await prisma.userSkill.count();

  const compared = await requestJson(
    baseUrl,
    `${gapPath(occupation.id)}&userId=${other.json.user.id}&role=ADMIN`,
    { cookies: student.cookies },
  );
  assert.equal(compared.response.status, 200, compared.text);
  assert.equal(compared.json.recordedSkillCount, 1);
  assert.equal(await prisma.userSkill.count(), afterCreate);

  const ictItem = compared.json.items.find((item) => item.skill.id === ictSafety.id);
  assert.ok(ictItem);
  assert.equal(ictItem.recorded, true);
  assert.equal(ictItem.proficiencyLevel, 'Beginner');
  assert.equal(ictItem.relationType, ictRelationType);
  assert.equal(ictItem.skill.skillType, null);
  assert.equal(ictItem.skill.preferredLabel, 'ICT safety');

  const unrecorded = compared.json.items.find((item) => item.skill.id !== ictSafety.id);
  assert.ok(unrecorded);
  assert.equal(unrecorded.recorded, false);
  assert.equal(unrecorded.proficiencyLevel, null);

  const essentialRecorded = compared.json.items.filter((item) => item.relationType === 'essential' && item.recorded);
  const optionalRecorded = compared.json.items.filter((item) => item.relationType === 'optional' && item.recorded);
  assert.equal(compared.json.totals.essential.recorded, essentialRecorded.length);
  assert.equal(compared.json.totals.optional.recorded, optionalRecorded.length);
  assert.equal(
    compared.json.totals.essential.total,
    compared.json.items.filter((item) => item.relationType === 'essential').length,
  );
  assert.equal(
    compared.json.totals.optional.total,
    compared.json.items.filter((item) => item.relationType === 'optional').length,
  );
  if (ictRelationType === 'essential') {
    assert.equal(compared.json.totals.essential.recorded, 1);
    assert.equal(compared.json.totals.optional.recorded, 0);
  } else {
    assert.equal(compared.json.totals.optional.recorded, 1);
    assert.equal(compared.json.totals.essential.recorded, 0);
  }
  assertReadOnlyShape(compared.json);

  const otherView = await requestJson(baseUrl, gapPath(occupation.id), { cookies: other.cookies });
  assert.equal(otherView.response.status, 200);
  assert.equal(otherView.json.recordedSkillCount, 0);
  assert.equal(otherView.json.items.find((item) => item.skill.id === ictSafety.id).recorded, false);

  const jobView = await requestJson(baseUrl, gapPath(occupation.id), { cookies: jobSeeker.cookies });
  assert.equal(jobView.response.status, 200);
  assert.equal(jobView.json.recordedSkillCount, 0);
  assert.equal(jobView.json.items.some((item) => item.relationType === 'essential'), true);
  assert.equal(jobView.json.items.some((item) => item.relationType === 'optional'), true);
});

test('occupation-unlinked SQL records do not inflate occupation-linked coverage', async () => {
  const sqlSkill = await prisma.skill.findFirst({
    where: { sourceUri: SQL_URI, sourceSystem: 'ESCO' },
    select: { id: true, preferredLabel: true, sourceUri: true },
  });
  assert.ok(sqlSkill, 'expected imported SQL skill');

  const student = await registerAs('sql-unlinked');
  const created = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: sqlSkill.id,
    proficiencyLevel: 'Beginner',
  });
  assert.equal(created.response.status, 201, created.text);

  const compared = await requestJson(baseUrl, gapPath(occupation.id), { cookies: student.cookies });
  assert.equal(compared.response.status, 200, compared.text);
  assert.equal(compared.json.occupation.id, occupation.id);
  assert.equal(compared.json.recordedSkillCount, 1);
  const sqlOnOccupation = compared.json.items.some((item) => item.skill.id === sqlSkill.id);
  if (sqlOnOccupation) {
    assert.equal(compared.json.items.find((item) => item.skill.id === sqlSkill.id).recorded, true);
  } else {
    assert.equal(compared.json.matchedOccupationSkillCount, 0);
    assert.equal(compared.json.unmatchedRecordedSkills.length, 1);
    assert.equal(compared.json.unmatchedRecordedSkills[0].skill.id, sqlSkill.id);
    assert.equal(compared.json.unmatchedRecordedSkills[0].skill.preferredLabel, 'SQL');
    assert.match(compared.json.coverageExplanation, /SQL/);
  }

  const linked = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: ictSafety.id,
    proficiencyLevel: 'Intermediate',
  });
  assert.equal(linked.response.status, 201, linked.text);
  const updated = await requestJson(baseUrl, gapPath(occupation.id), { cookies: student.cookies });
  assert.equal(updated.response.status, 200, updated.text);
  assert.equal(updated.json.recordedSkillCount, 2);
  assert.equal(updated.json.items.find((item) => item.skill.id === ictSafety.id).recorded, true);
  assert.equal(updated.json.matchedOccupationSkillCount >= 1, true);
});

test('unknown skill identifiers cannot be recorded for skill-gap matching', async () => {
  const student = await registerAs('invalid-skill');
  const created = await postJson(baseUrl, '/api/me/skills', sessionOf(student), {
    skillId: UNKNOWN_OCCUPATION_ID,
    proficiencyLevel: 'Beginner',
  });
  assert.equal(created.response.status, 404);
  const gap = await requestJson(baseUrl, gapPath(occupation.id), { cookies: student.cookies });
  assert.equal(gap.response.status, 200);
  assert.equal(gap.json.recordedSkillCount, 0);
});
