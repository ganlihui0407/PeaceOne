import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import { allowedMeProfilePatchFields } from '../src/lib/meProfileQuery.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage61-me-';
const createdEmails = [];
const existingUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  accountStatus: true,
  educationLevel: true,
  fieldOfStudy: true,
  institution: true,
  graduationYear: true,
  location: true,
  experienceSummary: true,
  jobTitle: true,
  department: true,
  targetOccupationId: true,
  passwordHash: true,
};

let server;
let baseUrl;
let baseline;
let existingFingerprint;

async function snapshotExistingUsers() {
  return prisma.user.findMany({
    select: existingUserSelect,
    orderBy: { email: 'asc' },
  });
}

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

function patchMe(session, body) {
  return requestJson(baseUrl, '/api/me', {
    method: 'PATCH',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body,
  });
}

function assertSafeProfile(json, expected) {
  assert.equal(json.user.id, expected.id);
  assert.equal(json.user.email, expected.email);
  assert.equal(json.user.fullName, expected.fullName);
  assert.equal(json.user.phone, expected.phone);
  assert.equal(json.user.role, expected.role);
  assert.equal(json.user.accountStatus, expected.accountStatus);
  assert.equal(json.user.educationLevel, expected.educationLevel ?? null);
  assert.equal(json.user.fieldOfStudy, expected.fieldOfStudy ?? null);
  assert.equal(json.user.institution, expected.institution ?? null);
  assert.equal(json.user.graduationYear, expected.graduationYear ?? null);
  assert.equal(json.user.location, expected.location ?? null);
  assert.equal(json.user.experienceSummary, expected.experienceSummary ?? null);
  assert.equal(json.user.jobTitle, expected.jobTitle ?? null);
  assert.equal(json.user.department, expected.department ?? null);
  assert.equal(json.user.passwordHash, undefined);
  assert.equal(json.user.targetOccupationId, undefined);
  assert.equal(json.passwordHash, undefined);
  assert.equal(json.sid, undefined);
  assertNoSecrets(json);
}

before(async () => {
  baseline = {
    occupations: await prisma.occupation.count(),
    skills: await prisma.skill.count(),
    relations: await prisma.occupationSkillRelation.count(),
    userSkills: await prisma.userSkill.count(),
    mascoOccupations: await prisma.mascoOccupationRecord.count(),
    mascoCrosswalks: await prisma.mascoHistoricalCrosswalk.count(),
  };
  existingFingerprint = JSON.stringify(await snapshotExistingUsers());

  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
  } finally {
    assert.equal(JSON.stringify(await snapshotExistingUsers()), existingFingerprint);
    assert.equal(await prisma.occupation.count(), baseline.occupations);
    assert.equal(await prisma.skill.count(), baseline.skills);
    assert.equal(await prisma.occupationSkillRelation.count(), baseline.relations);
    assert.equal(await prisma.userSkill.count(), baseline.userSkills);
    assert.equal(await prisma.mascoOccupationRecord.count(), baseline.mascoOccupations);
    assert.equal(await prisma.mascoHistoricalCrosswalk.count(), baseline.mascoCrosswalks);

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }

    await Promise.all([
      prisma.$disconnect(),
      closeSessionStore(),
    ]);
  }
});

test('unauthenticated profile requests are rejected', async () => {
  const listed = await requestJson(baseUrl, '/api/me');
  assert.equal(listed.response.status, 401);
  assert.equal(listed.json.error, 'Unauthenticated');
  assertNoSecrets(listed.json);

  const primed = await primeCsrf(baseUrl);
  const patched = await requestJson(baseUrl, '/api/me', {
    method: 'PATCH',
    csrfToken: primed.csrfToken,
    cookies: primed.cookies,
    body: { fullName: 'Unauthenticated User' },
  });
  assert.equal(patched.response.status, 401);
  assert.equal(patched.json.error, 'Unauthenticated');
  assertNoSecrets(patched.json);
});

test('suspended accounts cannot read or update a profile', async () => {
  const registered = await registerAs('suspended');
  await prisma.user.update({
    where: { email: registered.email },
    data: { accountStatus: 'SUSPENDED' },
  });

  const listed = await requestJson(baseUrl, '/api/me', { cookies: registered.cookies });
  assert.equal(listed.response.status, 403);
  assert.equal(listed.json.error, 'Account is unavailable');
  assertNoSecrets(listed.json);

  const patched = await patchMe(sessionOf(registered), { fullName: 'Suspended Rename' });
  assert.equal(patched.response.status, 403);
  assert.equal(patched.json.error, 'Account is unavailable');

  const stored = await prisma.user.findUnique({
    where: { email: registered.email },
    select: { fullName: true, accountStatus: true },
  });
  assert.equal(stored.fullName, registered.json.user.fullName);
  assert.equal(stored.accountStatus, 'SUSPENDED');
});

test('authenticated users can read their own profile including phone', async () => {
  const student = await registerAs('reader', { phone: '012-345 6789' });
  const listed = await requestJson(baseUrl, '/api/me?userId=other-user&role=ADMIN', {
    cookies: student.cookies,
  });
  assert.equal(listed.response.status, 200);
  assertSafeProfile(listed.json, {
    id: student.json.user.id,
    email: student.email,
    fullName: student.json.user.fullName,
    phone: '012-345 6789',
    role: 'STUDENT',
    accountStatus: 'ACTIVE',
  });
});

test('students, job seekers, company staff and admins can update their own fullName and phone', async () => {
  const student = await registerAs('student', { phone: '011-000 0001' });
  const jobSeeker = await registerAs('jobseeker', {
    currentPosition: 'jobseeker',
    phone: '011-000 0002',
  });
  const staff = await registerAs('staff', { role: 'employer', currentPosition: undefined });
  const adminEmail = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'admin');
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage 6.1 Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const admin = await loginAs(adminEmail);

  const cases = [
    { session: sessionOf(student), email: student.email, fullName: 'Student Six One', phone: '013-111 1111', role: 'STUDENT' },
    { session: sessionOf(jobSeeker), email: jobSeeker.email, fullName: 'Job Seeker Six One', phone: null, role: 'JOB_SEEKER' },
    { session: sessionOf(staff), email: staff.email, fullName: 'Staff Six One', phone: '014-222 2222', role: 'COMPANY_STAFF' },
    { session: sessionOf(admin), email: adminEmail, fullName: 'Admin Six One', phone: '015-333 3333', role: 'ADMIN' },
  ];

  for (const item of cases) {
    const patched = await patchMe(item.session, {
      fullName: item.fullName,
      phone: item.phone,
    });
    assert.equal(patched.response.status, 200, item.email);
    assert.equal(patched.json.user.email, item.email);
    assert.equal(patched.json.user.fullName, item.fullName);
    assert.equal(patched.json.user.phone, item.phone);
    assert.equal(patched.json.user.role, item.role);
    assertNoSecrets(patched.json);

    const stored = await prisma.user.findUnique({
      where: { email: item.email },
      select: { fullName: true, phone: true, role: true },
    });
    assert.equal(stored.fullName, item.fullName);
    assert.equal(stored.phone, item.phone);
    assert.equal(stored.role, item.role);

    const reloaded = await requestJson(baseUrl, '/api/me', { cookies: item.session.cookies });
    assert.equal(reloaded.response.status, 200);
    assert.equal(reloaded.json.user.fullName, item.fullName);
    assert.equal(reloaded.json.user.phone, item.phone);
  }
});

test('PATCH persists only the caller record and can clear phone', async () => {
  const owner = await registerAs('owner', { phone: '016-444 4444' });
  const other = await registerAs('other', {
    fullName: 'Unchanged Other',
    phone: '017-555 5555',
  });
  const beforeOther = await prisma.user.findUnique({
    where: { email: other.email },
    select: existingUserSelect,
  });

  const patched = await patchMe(sessionOf(owner), { phone: '' });
  assert.equal(patched.response.status, 200);
  assert.equal(patched.json.user.id, owner.json.user.id);
  assert.equal(patched.json.user.fullName, owner.json.user.fullName);
  assert.equal(patched.json.user.phone, null);

  const storedOwner = await prisma.user.findUnique({
    where: { email: owner.email },
    select: { fullName: true, phone: true },
  });
  assert.equal(storedOwner.fullName, owner.json.user.fullName);
  assert.equal(storedOwner.phone, null);

  const storedOther = await prisma.user.findUnique({
    where: { email: other.email },
    select: existingUserSelect,
  });
  assert.deepEqual(storedOther, beforeOther);
});

test('invalid profile fields are rejected and do not write', async () => {
  const student = await registerAs('invalid', {
    fullName: 'Keep Original Name',
    phone: '018-666 6666',
  });
  const before = await prisma.user.findUnique({
    where: { email: student.email },
    select: existingUserSelect,
  });
  const session = sessionOf(student);
  const bodies = [
    {},
    { fullName: '' },
    { fullName: ' ' },
    { fullName: 'a'.repeat(101) },
    { phone: '1'.repeat(31) },
    { phone: 12345 },
    { fullName: null },
  ];

  for (const body of bodies) {
    const result = await patchMe(session, body);
    assert.equal(result.response.status, 400, JSON.stringify(body));
    assert.equal(result.json.error, 'Invalid request');
    assertNoSecrets(result.json);
  }

  const after = await prisma.user.findUnique({
    where: { email: student.email },
    select: existingUserSelect,
  });
  assert.deepEqual(after, before);
});

test('protected fields cannot be modified', async () => {
  const student = await registerAs('protected', { phone: '019-777 7777' });
  const before = await prisma.user.findUnique({
    where: { email: student.email },
    select: existingUserSelect,
  });
  const session = sessionOf(student);
  const bodies = [
    { role: 'ADMIN' },
    { accountStatus: 'SUSPENDED' },
    { email: 'hijacked@peaceone.test' },
    { passwordHash: 'not-a-hash' },
    { id: otherIdPlaceholder() },
    { targetOccupationId: otherIdPlaceholder() },
    { fullName: 'Should Not Apply', role: 'ADMIN' },
    { fullName: 'Should Not Apply', email: 'hijacked@peaceone.test' },
    { userId: student.json.user.id, fullName: 'Should Not Apply' },
  ];

  for (const body of bodies) {
    const result = await patchMe(session, body);
    assert.equal(result.response.status, 400, JSON.stringify(Object.keys(body)));
    assert.equal(result.json.error, 'Invalid request');
    assertNoSecrets(result.json);
  }

  const after = await prisma.user.findUnique({
    where: { email: student.email },
    select: existingUserSelect,
  });
  assert.deepEqual(after, before);
  assert.equal(after.role, 'STUDENT');
  assert.equal(after.accountStatus, 'ACTIVE');
  assert.equal(after.email, student.email);
  assert.equal(after.passwordHash, before.passwordHash);
  assert.equal(after.targetOccupationId, before.targetOccupationId);
});

test('mutations without a valid CSRF token are rejected', async () => {
  const student = await registerAs('csrf', { fullName: 'CSRF Original' });
  const missing = await requestJson(baseUrl, '/api/me', {
    method: 'PATCH',
    cookies: student.cookies,
    body: { fullName: 'CSRF Missing' },
  });
  assert.equal(missing.response.status, 403);
  assert.equal(missing.json.error, 'Invalid CSRF token');

  const invalid = await patchMe(
    { csrfToken: 'not-a-csrf-token', cookies: student.cookies },
    { fullName: 'CSRF Invalid' },
  );
  assert.equal(invalid.response.status, 403);
  assert.equal(invalid.json.error, 'Invalid CSRF token');

  const stored = await prisma.user.findUnique({
    where: { email: student.email },
    select: { fullName: true },
  });
  assert.equal(stored.fullName, 'CSRF Original');
  assertNoSecrets(missing.json);
  assertNoSecrets(invalid.json);
});

test('students and job seekers can persist candidate profile fields', async () => {
  const payload = {
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Information Systems',
    institution: 'Universiti Malaya',
    graduationYear: 2027,
    location: 'Kuala Lumpur',
    experienceSummary: 'Internship reporting and introductory data analysis.',
  };
  const student = await registerAs('candidate-fields');
  const jobSeeker = await registerAs('candidate-job', { currentPosition: 'jobseeker' });

  for (const account of [student, jobSeeker]) {
    const patched = await patchMe(sessionOf(account), payload);
    assert.equal(patched.response.status, 200, patched.text);
    assert.equal(patched.json.user.educationLevel, payload.educationLevel);
    assert.equal(patched.json.user.fieldOfStudy, payload.fieldOfStudy);
    assert.equal(patched.json.user.institution, payload.institution);
    assert.equal(patched.json.user.graduationYear, 2027);
    assert.equal(patched.json.user.location, payload.location);
    assert.equal(patched.json.user.experienceSummary, payload.experienceSummary);
    assert.equal(patched.json.user.jobTitle, null);
    assert.equal(patched.json.user.department, null);
    assertNoSecrets(patched.json);
  }
});

test('company staff can persist location and department but cannot change jobTitle', async () => {
  assert.equal(allowedMeProfilePatchFields('COMPANY_STAFF').includes('jobTitle'), false);
  assert.deepEqual(allowedMeProfilePatchFields('COMPANY_STAFF'), [
    'fullName',
    'phone',
    'location',
    'department',
  ]);

  const staff = await registerAs('staff-fields', { role: 'employer', currentPosition: undefined });
  await prisma.user.update({
    where: { id: staff.json.user.id },
    data: { jobTitle: 'Talent Partner' },
  });

  const denied = await patchMe(sessionOf(staff), { jobTitle: 'Hiring Manager' });
  assert.equal(denied.response.status, 400, denied.text);
  assert.equal(denied.json.error, 'Invalid request');

  const mixed = await patchMe(sessionOf(staff), {
    location: 'Petaling Jaya',
    jobTitle: 'Hiring Manager',
    department: 'Human Resources',
  });
  assert.equal(mixed.response.status, 400, mixed.text);
  assert.equal(mixed.json.error, 'Invalid request');

  const storedAfterDenied = await prisma.user.findUnique({
    where: { id: staff.json.user.id },
    select: { jobTitle: true, location: true, department: true },
  });
  assert.equal(storedAfterDenied.jobTitle, 'Talent Partner');
  assert.equal(storedAfterDenied.location, null);
  assert.equal(storedAfterDenied.department, null);

  const patched = await patchMe(sessionOf(staff), {
    fullName: 'Staff Six Two',
    phone: '03-555 0100',
    location: 'Petaling Jaya',
    department: 'Human Resources',
  });
  assert.equal(patched.response.status, 200, patched.text);
  assert.equal(patched.json.user.fullName, 'Staff Six Two');
  assert.equal(patched.json.user.phone, '03-555 0100');
  assert.equal(patched.json.user.location, 'Petaling Jaya');
  assert.equal(patched.json.user.department, 'Human Resources');
  assert.equal(patched.json.user.jobTitle, 'Talent Partner');
  assert.equal(patched.json.user.educationLevel, null);
  assert.equal(patched.json.user.graduationYear, null);
  assertNoSecrets(patched.json);
});

test('role-specific extended fields are rejected and do not write', async () => {
  const student = await registerAs('role-student');
  const staff = await registerAs('role-staff', { role: 'employer', currentPosition: undefined });
  const adminEmail = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'role-admin');
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage 6.2 Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const admin = await loginAs(adminEmail);

  const studentBefore = await prisma.user.findUnique({
    where: { email: student.email },
    select: existingUserSelect,
  });
  const staffBefore = await prisma.user.findUnique({
    where: { email: staff.email },
    select: existingUserSelect,
  });
  const adminBefore = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: existingUserSelect,
  });

  const studentDenied = await patchMe(sessionOf(student), { jobTitle: 'Analyst' });
  assert.equal(studentDenied.response.status, 400);
  const staffJobTitleDenied = await patchMe(sessionOf(staff), { jobTitle: 'Analyst' });
  assert.equal(staffJobTitleDenied.response.status, 400);
  const staffDenied = await patchMe(sessionOf(staff), { educationLevel: "Bachelor's Degree" });
  assert.equal(staffDenied.response.status, 400);
  const adminDenied = await patchMe(sessionOf(admin), { location: 'Kuala Lumpur' });
  assert.equal(adminDenied.response.status, 400);

  assert.deepEqual(
    await prisma.user.findUnique({ where: { email: student.email }, select: existingUserSelect }),
    studentBefore,
  );
  assert.deepEqual(
    await prisma.user.findUnique({ where: { email: staff.email }, select: existingUserSelect }),
    staffBefore,
  );
  assert.deepEqual(
    await prisma.user.findUnique({ where: { email: adminEmail }, select: existingUserSelect }),
    adminBefore,
  );
});

test('invalid extended profile values are rejected', async () => {
  const student = await registerAs('extended-invalid');
  const before = await prisma.user.findUnique({
    where: { email: student.email },
    select: existingUserSelect,
  });
  const session = sessionOf(student);
  const bodies = [
    { educationLevel: 'PhD' },
    { fieldOfStudy: 'a'.repeat(101) },
    { institution: 'a'.repeat(151) },
    { graduationYear: 1949 },
    { graduationYear: 2101 },
    { graduationYear: '2027' },
    { graduationYear: 2027.5 },
    { location: 'a'.repeat(101) },
    { experienceSummary: 'a'.repeat(2001) },
  ];

  for (const body of bodies) {
    const result = await patchMe(session, body);
    assert.equal(result.response.status, 400, JSON.stringify(body));
    assert.equal(result.json.error, 'Invalid request');
  }

  assert.deepEqual(
    await prisma.user.findUnique({ where: { email: student.email }, select: existingUserSelect }),
    before,
  );
});

const EMPTY_EXTENDED_FIELDS = {
  educationLevel: null,
  fieldOfStudy: null,
  institution: null,
  graduationYear: null,
  location: null,
  experienceSummary: null,
  jobTitle: null,
  department: null,
};

const extendedFieldSelect = {
  educationLevel: true,
  fieldOfStudy: true,
  institution: true,
  graduationYear: true,
  location: true,
  experienceSummary: true,
  jobTitle: true,
  department: true,
};

test('existing leftover profiles keep their saved extended fields', async () => {
  const leftover = await prisma.user.findMany({
    where: { NOT: { email: { startsWith: TEST_EMAIL_PREFIX } } },
    select: existingUserSelect,
    orderBy: { email: 'asc' },
  });
  assert.ok(leftover.length >= 1);
  const expected = JSON.parse(existingFingerprint).filter(
    (user) => !user.email.startsWith(TEST_EMAIL_PREFIX),
  );
  assert.deepEqual(leftover, expected);
});

test('new users start with null extended fields and GET /api/me returns them', async () => {
  const student = await registerAs('fresh-nulls');
  const stored = await prisma.user.findUnique({
    where: { email: student.email },
    select: extendedFieldSelect,
  });
  assert.deepEqual(stored, EMPTY_EXTENDED_FIELDS);

  const listed = await requestJson(baseUrl, '/api/me', { cookies: student.cookies });
  assert.equal(listed.response.status, 200);
  assertSafeProfile(listed.json, {
    id: student.json.user.id,
    email: student.email,
    fullName: student.json.user.fullName,
    phone: null,
    role: 'STUDENT',
    accountStatus: 'ACTIVE',
    ...EMPTY_EXTENDED_FIELDS,
  });
});

test('PATCH writes only requested fields and GET returns the saved values', async () => {
  const student = await registerAs('partial-patch', { phone: '012-100 2000' });
  const session = sessionOf(student);
  const education = {
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Information Systems',
    institution: 'Universiti Malaya',
    graduationYear: 2027,
    location: 'Kuala Lumpur',
    experienceSummary: 'Internship reporting.',
  };

  const saved = await patchMe(session, education);
  assert.equal(saved.response.status, 200, saved.text);
  const afterEducation = await requestJson(baseUrl, '/api/me', { cookies: session.cookies });
  assert.equal(afterEducation.response.status, 200);
  assertSafeProfile(afterEducation.json, {
    id: student.json.user.id,
    email: student.email,
    fullName: student.json.user.fullName,
    phone: '012-100 2000',
    role: 'STUDENT',
    accountStatus: 'ACTIVE',
    ...education,
    jobTitle: null,
    department: null,
  });

  const renamed = await patchMe(session, { fullName: 'Partial Patch Student', phone: '012-100 2001' });
  assert.equal(renamed.response.status, 200, renamed.text);
  const afterName = await requestJson(baseUrl, '/api/me', { cookies: session.cookies });
  assert.equal(afterName.response.status, 200);
  assertSafeProfile(afterName.json, {
    id: student.json.user.id,
    email: student.email,
    fullName: 'Partial Patch Student',
    phone: '012-100 2001',
    role: 'STUDENT',
    accountStatus: 'ACTIVE',
    ...education,
    jobTitle: null,
    department: null,
  });

  const stored = await prisma.user.findUnique({
    where: { email: student.email },
    select: existingUserSelect,
  });
  assert.equal(stored.fullName, 'Partial Patch Student');
  assert.equal(stored.phone, '012-100 2001');
  assert.equal(stored.educationLevel, education.educationLevel);
  assert.equal(stored.graduationYear, 2027);
  assert.equal(stored.jobTitle, null);
  assert.equal(stored.role, 'STUDENT');
  assert.equal(stored.email, student.email);
});

function otherIdPlaceholder() {
  return 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
}
