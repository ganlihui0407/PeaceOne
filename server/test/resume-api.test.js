import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import { MAX_RESUMES_PER_USER, RESUME_LIMIT_REACHED } from '../src/lib/resumeQuery.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage71-resume-';
const ICT_SAFETY_URI = 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2';
const UNKNOWN_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const createdEmails = [];

let server;
let baseUrl;
let baseline;
let ictSafety;
let otherSkill;

async function snapshot() {
  const [
    occupations,
    skills,
    relations,
    mascoUnitGroups,
    mascoOccupations,
    mascoCrosswalks,
    userSkills,
    resumes,
    education,
    experience,
    resumeSkills,
    certifications,
    resumeFiles,
  ] = await Promise.all([
    prisma.occupation.count(),
    prisma.skill.count(),
    prisma.occupationSkillRelation.count(),
    prisma.mascoUnitGroup.count(),
    prisma.mascoOccupationRecord.count(),
    prisma.mascoHistoricalCrosswalk.count(),
    prisma.userSkill.count(),
    prisma.resume.count(),
    prisma.resumeEducation.count(),
    prisma.resumeExperience.count(),
    prisma.resumeSkill.count(),
    prisma.resumeCertification.count(),
    prisma.resumeFile.count(),
  ]);
  return {
    occupations,
    skills,
    relations,
    mascoUnitGroups,
    mascoOccupations,
    mascoCrosswalks,
    userSkills,
    resumes,
    education,
    experience,
    resumeSkills,
    certifications,
    resumeFiles,
  };
}

async function registerAs(label, extras = {}) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(
    baseUrl,
    '/api/auth/register',
    primed,
    validRegisterBody(email, extras),
  );
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

async function createAdmin(label = 'admin') {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage Seven One Admin',
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

function listResumes(session) {
  return requestJson(baseUrl, '/api/me/resumes', { cookies: session.cookies });
}

function createResume(session, body) {
  return postJson(baseUrl, '/api/me/resumes', session, body);
}

function getResume(session, id) {
  return requestJson(baseUrl, `/api/me/resumes/${id}`, { cookies: session.cookies });
}

function putResume(session, id, body) {
  return requestJson(baseUrl, `/api/me/resumes/${id}`, {
    method: 'PUT',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body,
  });
}

function deleteResume(session, id) {
  return requestJson(baseUrl, `/api/me/resumes/${id}`, {
    method: 'DELETE',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
  });
}

function setPrimary(session, id, body = {}) {
  return postJson(baseUrl, `/api/me/resumes/${id}/primary`, session, body);
}

before(async () => {
  baseline = await snapshot();
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

  const finalSnapshot = await snapshot();
  assert.deepEqual(finalSnapshot, baseline);

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('resume foreign keys cascade to the owner and set-null ESCO skill references', async () => {
  const fks = await prisma.$queryRaw`
    SELECT CAST(c.conname AS TEXT) AS conname, CAST(c.confdeltype AS TEXT) AS confdeltype
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'f'
      AND CAST(t.relname AS TEXT) IN (
        'resumes',
        'resume_education',
        'resume_experience',
        'resume_skills',
        'resume_certifications'
      )
    ORDER BY 1
  `;
  const byName = Object.fromEntries(fks.map((row) => [row.conname, row.confdeltype]));
  assert.equal(byName.resumes_user_id_fkey, 'c');
  assert.equal(byName.resume_education_resume_id_fkey, 'c');
  assert.equal(byName.resume_experience_resume_id_fkey, 'c');
  assert.equal(byName.resume_skills_resume_id_fkey, 'c');
  assert.equal(byName.resume_certifications_resume_id_fkey, 'c');
  assert.equal(byName.resume_skills_skill_id_fkey, 'n');

  const primaryIndex = await prisma.$queryRaw`
    SELECT CAST(indexdef AS TEXT) AS indexdef
    FROM pg_indexes
    WHERE CAST(indexname AS TEXT) = 'resumes_one_primary_per_user'
  `;
  assert.equal(primaryIndex.length, 1);
  assert.match(primaryIndex[0].indexdef, /UNIQUE/i);
  assert.match(primaryIndex[0].indexdef, /is_primary/i);
});

test('unauthenticated resume requests are rejected', async () => {
  const listed = await listResumes({ cookies: '' });
  assert.equal(listed.response.status, 401);
  assert.equal(listed.json.error, 'Unauthenticated');
  assertNoSecrets(listed.json);

  const primed = await primeCsrf(baseUrl);
  const created = await createResume(primed, { title: 'Unauthenticated resume' });
  assert.equal(created.response.status, 401);
  assert.equal(created.json.error, 'Unauthenticated');
});

test('company staff and admin cannot access resume APIs', async () => {
  const staff = await registerAs('staff', { role: 'employer', currentPosition: undefined });
  const staffList = await listResumes(sessionOf(staff));
  assert.equal(staffList.response.status, 403);
  assert.equal(staffList.json.error, 'Forbidden');

  const staffCreate = await createResume(sessionOf(staff), {
    title: 'Staff resume',
    userId: staff.json.user.id,
    role: 'STUDENT',
  });
  assert.equal(staffCreate.response.status, 403);

  const admin = await createAdmin();
  const adminList = await listResumes(sessionOf(admin));
  assert.equal(adminList.response.status, 403);
  assert.equal(adminList.json.error, 'Forbidden');
  assertNoSecrets(adminList.json);
});

test('suspended accounts cannot list or change resumes', async () => {
  const registered = await registerAs('suspended');
  await prisma.user.update({
    where: { email: registered.email },
    data: { accountStatus: 'SUSPENDED' },
  });

  const listed = await listResumes(sessionOf(registered));
  assert.equal(listed.response.status, 403);
  assert.equal(listed.json.error, 'Account is unavailable');

  const created = await createResume(sessionOf(registered), { title: 'Suspended resume' });
  assert.equal(created.response.status, 403);
  assert.equal(created.json.error, 'Account is unavailable');
});

test('mutations without a valid CSRF token are rejected', async () => {
  const student = await registerAs('csrf');
  const missing = await requestJson(baseUrl, '/api/me/resumes', {
    method: 'POST',
    cookies: student.cookies,
    body: { title: 'No CSRF' },
  });
  assert.equal(missing.response.status, 403);
  assert.equal(missing.json.error, 'Invalid CSRF token');

  const invalid = await createResume(
    { csrfToken: 'not-a-csrf-token', cookies: student.cookies },
    { title: 'Bad CSRF' },
  );
  assert.equal(invalid.response.status, 403);
  assert.equal(invalid.json.error, 'Invalid CSRF token');
});

test('students and job seekers can create, list, update and delete only their own resumes', async () => {
  const student = await registerAs('owner', {
    currentPosition: 'student',
    fullName: 'Stage Seven One Student',
    phone: '012-680 0001',
  });
  const other = await registerAs('other', { currentPosition: 'student' });
  const jobSeeker = await registerAs('job', {
    currentPosition: 'jobseeker',
    fullName: 'Stage Seven One Seeker',
  });

  const empty = await listResumes(sessionOf(student));
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.json.items, []);
  assertNoSecrets(empty.json);

  const created = await createResume(sessionOf(student), { title: 'Software internship CV' });
  assert.equal(created.response.status, 201, created.text);
  assert.equal(created.json.resume.title, 'Software internship CV');
  assert.equal(created.json.resume.isPrimary, true);
  assert.equal(created.json.resume.templateKey, 'classic');
  assert.equal(created.json.resume.fullName, 'Stage Seven One Student');
  assert.equal(created.json.resume.email, student.email);
  assert.equal(created.json.resume.phone, '012-680 0001');
  assert.equal(created.json.resume.education.length, 0);
  assert.equal(created.json.userId, undefined);
  assert.equal(created.json.resume.userId, undefined);
  assert.equal(created.json.resume.role, undefined);
  assertNoSecrets(created.json);

  const second = await createResume(sessionOf(student), { title: 'Data role CV' });
  assert.equal(second.response.status, 201, second.text);
  assert.equal(second.json.resume.isPrimary, false);

  const otherCreated = await createResume(sessionOf(other), { title: 'Other CV' });
  assert.equal(otherCreated.response.status, 201, otherCreated.text);

  const jobCreated = await createResume(sessionOf(jobSeeker), { title: 'Seeker CV' });
  assert.equal(jobCreated.response.status, 201, jobCreated.text);
  assert.equal(jobCreated.json.resume.fullName, 'Stage Seven One Seeker');

  const listed = await listResumes(sessionOf(student));
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.items.length, 2);
  assert.equal(listed.json.items[0].id, created.json.resume.id);
  assert.equal(listed.json.items[0].isPrimary, true);
  assert.equal(
    listed.json.items.some((item) => item.id === otherCreated.json.resume.id),
    false,
  );
  assertNoSecrets(listed.json);

  const foreignGet = await getResume(sessionOf(student), otherCreated.json.resume.id);
  assert.equal(foreignGet.response.status, 404);
  assert.equal(foreignGet.json.error, 'Not found');

  const foreignPut = await putResume(sessionOf(student), otherCreated.json.resume.id, {
    title: 'Hijacked',
  });
  assert.equal(foreignPut.response.status, 404);

  const stillOther = await prisma.resume.findUnique({
    where: { id: otherCreated.json.resume.id },
  });
  assert.equal(stillOther.title, 'Other CV');

  const foreignDelete = await deleteResume(sessionOf(student), otherCreated.json.resume.id);
  assert.equal(foreignDelete.response.status, 404);
  assert.ok(await prisma.resume.findUnique({ where: { id: otherCreated.json.resume.id } }));

  const foreignPrimary = await setPrimary(sessionOf(student), otherCreated.json.resume.id);
  assert.equal(foreignPrimary.response.status, 404);

  const missing = await getResume(sessionOf(student), UNKNOWN_ID);
  assert.equal(missing.response.status, 404);

  const invalidId = await getResume(sessionOf(student), 'not-a-uuid');
  assert.equal(invalidId.response.status, 400);
  assert.equal(invalidId.json.error, 'Invalid request');

  const removed = await deleteResume(sessionOf(student), second.json.resume.id);
  assert.equal(removed.response.status, 200);
  assert.deepEqual(removed.json, { ok: true });
  assert.equal(await prisma.resume.findUnique({ where: { id: second.json.resume.id } }), null);
  assert.ok(await prisma.resume.findUnique({ where: { id: created.json.resume.id } }));
});

test('client payloads cannot set userId, role or unexpected fields', async () => {
  const student = await registerAs('strict');
  const created = await createResume(sessionOf(student), {
    title: 'Strict CV',
    userId: UNKNOWN_ID,
    role: 'ADMIN',
  });
  assert.equal(created.response.status, 400);
  assert.equal(created.json.error, 'Invalid request');

  const resume = await createResume(sessionOf(student), { title: 'Owned CV' });
  assert.equal(resume.response.status, 201, resume.text);

  const updated = await putResume(sessionOf(student), resume.json.resume.id, {
    title: 'Still owned',
    userId: UNKNOWN_ID,
  });
  assert.equal(updated.response.status, 400);

  const primary = await setPrimary(sessionOf(student), resume.json.resume.id, {
    userId: UNKNOWN_ID,
  });
  assert.equal(primary.response.status, 400);
});

test('a user cannot create more than five resumes', async () => {
  const student = await registerAs('cap');
  const session = sessionOf(student);
  for (let index = 0; index < MAX_RESUMES_PER_USER; index += 1) {
    const created = await createResume(session, { title: `Resume ${index + 1}` });
    assert.equal(created.response.status, 201, created.text);
  }
  const extra = await createResume(session, { title: 'Resume 6' });
  assert.equal(extra.response.status, 409);
  assert.equal(extra.json.error, RESUME_LIMIT_REACHED);
  assert.equal(await prisma.resume.count({ where: { userId: student.json.user.id } }), 5);
});

test('nested sections persist, omitted sections are kept, and invalid skills roll back', async () => {
  const student = await registerAs('nested');
  const session = sessionOf(student);
  const created = await createResume(session, { title: 'Nested CV' });
  const resumeId = created.json.resume.id;

  const saved = await putResume(session, resumeId, {
    summary: 'Candidate for software roles.',
    education: [
      {
        institution: 'TAR UMT',
        qualification: "Bachelor's Degree",
        fieldOfStudy: 'Computer Science',
        startYear: 2023,
        endYear: 2027,
      },
    ],
    experience: [
      {
        jobTitle: 'Intern',
        organization: 'Harbour Analytics',
        location: 'Petaling Jaya',
        startDate: '2025-06-01',
        endDate: '2025-08-31',
        isCurrent: false,
        description: 'Assisted with reporting.',
      },
    ],
    skills: [
      { skillId: ictSafety.id, proficiencyLevel: 'Intermediate' },
      { label: 'Stakeholder updates', proficiencyLevel: 'Beginner' },
    ],
    certifications: [{ name: 'First Aid', issuer: 'St John', year: 2024, credentialId: 'FA-1' }],
  });
  assert.equal(saved.response.status, 200, saved.text);
  assert.equal(saved.json.resume.summary, 'Candidate for software roles.');
  assert.equal(saved.json.resume.education[0].institution, 'TAR UMT');
  assert.equal(saved.json.resume.experience[0].jobTitle, 'Intern');
  assert.equal(saved.json.resume.experience[0].startDate, '2025-06-01');
  assert.equal(saved.json.resume.skills.length, 2);
  assert.equal(saved.json.resume.skills[0].skillId, ictSafety.id);
  assert.equal(saved.json.resume.skills[0].label, ictSafety.preferredLabel);
  assert.equal(saved.json.resume.skills[0].skill.sourceUri, ICT_SAFETY_URI);
  assert.equal(saved.json.resume.skills[1].skillId, null);
  assert.equal(saved.json.resume.skills[1].label, 'Stakeholder updates');
  assert.equal(saved.json.resume.certifications[0].name, 'First Aid');
  assertNoSecrets(saved.json);

  const titleOnly = await putResume(session, resumeId, { title: 'Nested CV updated' });
  assert.equal(titleOnly.response.status, 200, titleOnly.text);
  assert.equal(titleOnly.json.resume.title, 'Nested CV updated');
  assert.equal(titleOnly.json.resume.education.length, 1);
  assert.equal(titleOnly.json.resume.education[0].institution, 'TAR UMT');
  assert.equal(titleOnly.json.resume.skills.length, 2);
  assert.equal(titleOnly.json.resume.certifications.length, 1);

  const rolledBack = await putResume(session, resumeId, {
    title: 'Should not persist',
    education: [{ institution: 'Replacement College' }],
    skills: [{ skillId: UNKNOWN_ID, label: 'Missing' }],
  });
  assert.equal(rolledBack.response.status, 404);
  assert.equal(rolledBack.json.error, 'Not found');

  const afterRollback = await getResume(session, resumeId);
  assert.equal(afterRollback.response.status, 200);
  assert.equal(afterRollback.json.resume.title, 'Nested CV updated');
  assert.equal(afterRollback.json.resume.education.length, 1);
  assert.equal(afterRollback.json.resume.education[0].institution, 'TAR UMT');
  assert.equal(afterRollback.json.resume.skills[0].skillId, ictSafety.id);

  const cleared = await putResume(session, resumeId, { education: [] });
  assert.equal(cleared.response.status, 200, cleared.text);
  assert.equal(cleared.json.resume.education.length, 0);
  assert.equal(cleared.json.resume.skills.length, 2);
});

test('resume deletion does not delete UserSkill records', async () => {
  const student = await registerAs('userskill');
  const session = sessionOf(student);
  const recorded = await postJson(baseUrl, '/api/me/skills', session, {
    skillId: ictSafety.id,
    proficiencyLevel: 'Advanced',
  });
  assert.equal(recorded.response.status, 201, recorded.text);
  const userSkillId = recorded.json.userSkill.id;

  const created = await createResume(session, { title: 'Skill snapshot CV' });
  const withSkill = await putResume(session, created.json.resume.id, {
    skills: [{ skillId: ictSafety.id, proficiencyLevel: 'Advanced' }],
  });
  assert.equal(withSkill.response.status, 200, withSkill.text);
  assert.equal(withSkill.json.resume.skills[0].label, ictSafety.preferredLabel);

  const removed = await deleteResume(session, created.json.resume.id);
  assert.equal(removed.response.status, 200);
  assert.equal(await prisma.resume.findUnique({ where: { id: created.json.resume.id } }), null);
  assert.equal(await prisma.resumeSkill.count({ where: { resumeId: created.json.resume.id } }), 0);

  const stillRecorded = await prisma.userSkill.findUnique({ where: { id: userSkillId } });
  assert.ok(stillRecorded);
  assert.equal(stillRecorded.skillId, ictSafety.id);
  assert.equal(stillRecorded.proficiencyLevel, 'Advanced');
});

test('primary switching is transactional and unique per user', async () => {
  const student = await registerAs('primary');
  const session = sessionOf(student);
  const first = await createResume(session, { title: 'Primary A' });
  const second = await createResume(session, { title: 'Primary B' });
  const third = await createResume(session, { title: 'Primary C' });
  assert.equal(first.json.resume.isPrimary, true);
  assert.equal(second.json.resume.isPrimary, false);

  const switched = await setPrimary(session, second.json.resume.id);
  assert.equal(switched.response.status, 200, switched.text);
  assert.equal(switched.json.resume.id, second.json.resume.id);
  assert.equal(switched.json.resume.isPrimary, true);

  const rows = await prisma.resume.findMany({
    where: { userId: student.json.user.id },
    select: { id: true, isPrimary: true },
  });
  assert.equal(rows.filter((row) => row.isPrimary).length, 1);
  assert.equal(rows.find((row) => row.id === second.json.resume.id).isPrimary, true);
  assert.equal(rows.find((row) => row.id === first.json.resume.id).isPrimary, false);

  const [left, right] = await Promise.all([
    setPrimary(session, first.json.resume.id),
    setPrimary(session, third.json.resume.id),
  ]);
  assert.equal(left.response.status, 200, left.text);
  assert.equal(right.response.status, 200, right.text);

  const afterConcurrent = await prisma.resume.findMany({
    where: { userId: student.json.user.id },
    select: { id: true, isPrimary: true },
  });
  const primaryIds = afterConcurrent.filter((row) => row.isPrimary).map((row) => row.id);
  assert.equal(primaryIds.length, 1);
  assert.ok([first.json.resume.id, third.json.resume.id].includes(primaryIds[0]));

  await assert.rejects(
    () =>
      prisma.resume.create({
        data: {
          userId: student.json.user.id,
          title: 'Duplicate primary',
          fullName: 'Stage Four Five',
          email: student.email,
          isPrimary: true,
        },
      }),
    (error) => error?.code === 'P2002',
  );
});
