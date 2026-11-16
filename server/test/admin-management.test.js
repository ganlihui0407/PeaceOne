import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import { CANNOT_SUSPEND_SELF } from '../src/lib/adminUserQuery.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage-p05-admin-';
const createdEmails = [];
const createdCompanyIds = [];
const createdContentIds = [];

let server;
let baseUrl;

async function snapshotCore() {
  const [users, companies, jobs, applications, interviews, enrollments] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
    prisma.job.count(),
    prisma.application.count(),
    prisma.interview.count(),
    prisma.learningEnrollment.count(),
  ]);
  return { users, companies, jobs, applications, interviews, enrollments };
}

async function registerStudent(label) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/register', primed, validRegisterBody(email));
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

async function registerStaff(label) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(
    baseUrl,
    '/api/auth/register',
    primed,
    validRegisterBody(email, { role: 'employer', currentPosition: undefined }),
  );
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

async function createAdmin(label = 'admin') {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Prompt Five Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/login', primed, {
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(result.response.status, 200, result.text);
  return { email, ...result };
}

function sessionOf(result) {
  return {
    csrfToken: result.json.csrfToken,
    cookies: result.cookies,
  };
}

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (createdContentIds.length > 0) {
    await prisma.learningContent.deleteMany({ where: { id: { in: createdContentIds } } });
  }
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  }
  if (createdCompanyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
  }
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('non-admin cannot access admin user, company, stats or report APIs', async () => {
  const student = sessionOf(await registerStudent('denied'));
  for (const path of [
    '/api/admin/users',
    '/api/admin/users/stats',
    '/api/admin/companies',
    '/api/admin/stats',
    '/api/admin/reports',
    '/api/admin/content-monitoring',
    '/api/admin/activity',
  ]) {
    const listed = await requestJson(baseUrl, path, { cookies: student.cookies });
    assert.equal(listed.response.status, 403, path);
  }
});

test('admin can list, search, paginate users and cannot see password hashes', async () => {
  const admin = sessionOf(await createAdmin('lister'));
  const alpha = await registerStudent('alpha-search');
  await registerStudent('beta-other');

  const listed = await requestJson(baseUrl, '/api/admin/users?limit=5&page=1', {
    cookies: admin.cookies,
  });
  assert.equal(listed.response.status, 200, listed.text);
  assert.ok(Array.isArray(listed.json.users));
  assert.ok(listed.json.total >= 2);
  assert.equal(listed.json.limit, 5);
  assertNoSecrets(listed.json);
  assert.equal(
    JSON.stringify(listed.json).includes('passwordHash'),
    false,
  );

  const searched = await requestJson(
    baseUrl,
    `/api/admin/users?q=${encodeURIComponent(alpha.email)}&role=STUDENT`,
    { cookies: admin.cookies },
  );
  assert.equal(searched.response.status, 200, searched.text);
  assert.equal(searched.json.users.length, 1);
  assert.equal(searched.json.users[0].email, alpha.email);
  assert.equal(searched.json.users[0].role, 'STUDENT');
});

test('admin can view user details and update status, but cannot suspend themselves', async () => {
  const adminResult = await createAdmin('status-admin');
  const admin = sessionOf(adminResult);
  const studentResult = await registerStudent('to-suspend');
  const studentId = studentResult.json.user.id;
  const before = await snapshotCore();

  const detail = await requestJson(baseUrl, `/api/admin/users/${studentId}`, {
    cookies: admin.cookies,
  });
  assert.equal(detail.response.status, 200, detail.text);
  assert.equal(detail.json.user.email, studentResult.email);
  assert.equal(detail.json.user.applicationCount, 0);
  assertNoSecrets(detail.json);

  const selfSuspend = await requestJson(baseUrl, `/api/admin/users/${adminResult.json.user.id}/status`, {
    method: 'PATCH',
    csrfToken: admin.csrfToken,
    cookies: admin.cookies,
    body: { accountStatus: 'SUSPENDED' },
  });
  assert.equal(selfSuspend.response.status, 409);
  assert.equal(selfSuspend.json.error, CANNOT_SUSPEND_SELF);

  const suspended = await requestJson(baseUrl, `/api/admin/users/${studentId}/status`, {
    method: 'PATCH',
    csrfToken: admin.csrfToken,
    cookies: admin.cookies,
    body: { accountStatus: 'SUSPENDED' },
  });
  assert.equal(suspended.response.status, 200, suspended.text);
  assert.equal(suspended.json.user.accountStatus, 'SUSPENDED');

  const blocked = await requestJson(baseUrl, '/api/me', { cookies: studentResult.cookies });
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.json.error, 'Account is unavailable');

  const reactivated = await requestJson(baseUrl, `/api/admin/users/${studentId}/status`, {
    method: 'PATCH',
    csrfToken: admin.csrfToken,
    cookies: admin.cookies,
    body: { accountStatus: 'ACTIVE' },
  });
  assert.equal(reactivated.response.status, 200);
  assert.equal(reactivated.json.user.accountStatus, 'ACTIVE');

  const after = await snapshotCore();
  assert.equal(after.applications, before.applications);
  assert.equal(after.interviews, before.interviews);
  assert.equal(after.enrollments, before.enrollments);
});

test('admin company list and details include staff and job counts', async () => {
  const staff = await registerStaff('co-owner');
  const staffSession = sessionOf(staff);
  const saved = await requestJson(baseUrl, '/api/me/company', {
    method: 'PUT',
    csrfToken: staffSession.csrfToken,
    cookies: staffSession.cookies,
    body: {
      companyName: 'Prompt Five Holdings',
      registrationNumber: 'P05-1111',
      industry: 'Technology',
    },
  });
  assert.equal(saved.response.status, 201, saved.text);
  createdCompanyIds.push(saved.json.company.id);
  const admin = sessionOf(await createAdmin('co-admin'));

  const listed = await requestJson(
    baseUrl,
    `/api/admin/companies?q=${encodeURIComponent('Prompt Five Holdings')}`,
    { cookies: admin.cookies },
  );
  assert.equal(listed.response.status, 200, listed.text);
  assert.equal(listed.json.companies.length, 1);
  assert.equal(listed.json.companies[0].companyName, 'Prompt Five Holdings');
  assert.equal(listed.json.companies[0].staffCount, 1);
  assert.equal(listed.json.companies[0].jobCount, 0);
  assert.equal(listed.json.companies[0].publishedJobCount, 0);
  assert.equal(listed.json.companies[0].draftJobCount, 0);
  assertNoSecrets(listed.json);

  const detail = await requestJson(baseUrl, `/api/admin/companies/${saved.json.company.id}`, {
    cookies: admin.cookies,
  });
  assert.equal(detail.response.status, 200, detail.text);
  assert.equal(detail.json.company.registrationNumber, 'P05-1111');
  assert.equal(detail.json.staff.length, 1);
  assert.equal(detail.json.staff[0].email, staff.email);
});

test('dashboard and report aggregates match PostgreSQL counts', async () => {
  const admin = sessionOf(await createAdmin('stats-admin'));
  const [userCount, studentCount, companyCount, publishedJobs, draftJobs, applications, interviews, publishedCourses, enrollments, completed] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.company.count(),
      prisma.job.count({ where: { status: 'PUBLISHED' } }),
      prisma.job.count({ where: { status: 'DRAFT' } }),
      prisma.application.count(),
      prisma.interview.count(),
      prisma.learningContent.count({ where: { status: 'PUBLISHED' } }),
      prisma.learningEnrollment.count(),
      prisma.learningEnrollment.count({ where: { status: 'COMPLETED' } }),
    ]);

  const stats = await requestJson(baseUrl, '/api/admin/stats', { cookies: admin.cookies });
  assert.equal(stats.response.status, 200, stats.text);
  assert.equal(stats.json.users.total, userCount);
  assert.equal(stats.json.users.students, studentCount);
  assert.equal(stats.json.companies.total, companyCount);
  assert.equal(stats.json.jobs.published, publishedJobs);
  assert.equal(stats.json.jobs.draft, draftJobs);
  assert.equal(stats.json.applications.total, applications);
  assert.equal(stats.json.interviews.total, interviews);
  assert.equal(stats.json.learning.publishedCourses, publishedCourses);
  assert.equal(stats.json.learning.enrollments, enrollments);
  assert.equal(stats.json.learning.completed, completed);
  assert.ok(Array.isArray(stats.json.recentActivity.items));
  assert.equal(Number.isInteger(stats.json.recentActivity.total), true);
  assert.equal(stats.json.recentActivity.page, 1);
  for (const item of stats.json.recentActivity.items) {
    assert.equal(typeof item.id, 'string');
    assert.equal(typeof item.type, 'string');
    assert.equal(typeof item.title, 'string');
    assert.equal(typeof item.description, 'string');
    assert.equal(typeof item.occurredAt, 'string');
    assert.equal(item.description.includes('reviewNote'), false);
    assert.equal(JSON.stringify(item).includes('passwordHash'), false);
  }
  assertNoSecrets(stats.json);

  const activity = await requestJson(baseUrl, '/api/admin/activity?page=1&limit=5', {
    cookies: admin.cookies,
  });
  assert.equal(activity.response.status, 200, activity.text);
  assert.ok(Array.isArray(activity.json.items));
  assert.equal(activity.json.page, 1);
  assert.equal(activity.json.limit, 5);
  assert.equal(Number.isInteger(activity.json.total), true);
  assert.equal(activity.json.total, stats.json.recentActivity.total);
  for (const item of activity.json.items) {
    assert.equal(typeof item.title, 'string');
    assert.equal(typeof item.occurredAt, 'string');
    assert.equal(item.description.includes('reviewNote'), false);
  }
  assertNoSecrets(activity.json);

  const reports = await requestJson(baseUrl, '/api/admin/reports', { cookies: admin.cookies });
  assert.equal(reports.response.status, 200, reports.text);
  assert.equal(reports.json.totals.users, userCount);
  assert.equal(reports.json.totals.applications, applications);
  assert.equal(reports.json.learning.completed, completed);

  const monitoring = await requestJson(baseUrl, '/api/admin/content-monitoring', {
    cookies: admin.cookies,
  });
  assert.equal(monitoring.response.status, 200, monitoring.text);
  assert.equal(monitoring.json.moderationQueueSupported, false);
  assert.ok(Array.isArray(monitoring.json.publishedJobs));
  assert.ok(Array.isArray(monitoring.json.publishedCourses));
});

test('admin can create and update quiz questions without leaking answers on student APIs', async () => {
  const admin = sessionOf(await createAdmin('quiz-admin'));
  const created = await postJson(baseUrl, '/api/admin/learning/courses', admin, {
    slug: `p05-quiz-${Date.now()}`,
    title: 'Prompt 05 quiz course',
    description: 'Used to test administrator quiz editing.',
    objectives: ['Edit a quiz'],
    category: 'CYBERSECURITY',
    difficulty: 'BEGINNER',
    estimatedMinutes: 30,
  });
  assert.equal(created.response.status, 201, created.text);
  createdContentIds.push(created.json.course.id);

  const assessment = await postJson(
    baseUrl,
    `/api/admin/learning/courses/${created.json.course.id}/assessments`,
    admin,
    {
      title: 'Safety check',
      passingScore: 70,
      questions: [
        {
          prompt: 'What is least privilege?',
          options: [
            { id: 'a', text: 'Everyone is admin' },
            { id: 'b', text: 'Grant only required access' },
          ],
          correctOptionId: 'b',
          sortOrder: 1,
        },
      ],
    },
  );
  assert.equal(assessment.response.status, 201, assessment.text);
  assert.equal(assessment.json.assessment.questions[0].correctOptionId, 'b');

  const lesson = await postJson(
    baseUrl,
    `/api/admin/learning/courses/${created.json.course.id}/lessons`,
    admin,
    {
      title: 'Intro',
      body: 'Quiz course lesson.',
      sortOrder: 1,
      estimatedMinutes: 10,
    },
  );
  assert.equal(lesson.response.status, 201, lesson.text);
  const published = await requestJson(baseUrl, `/api/admin/learning/courses/${created.json.course.id}/publish`, {
    method: 'PATCH',
    csrfToken: admin.csrfToken,
    cookies: admin.cookies,
    body: {},
  });
  assert.equal(published.response.status, 200, published.text);

  const updated = await requestJson(
    baseUrl,
    `/api/admin/learning/assessments/${assessment.json.assessment.id}`,
    {
      method: 'PUT',
      csrfToken: admin.csrfToken,
      cookies: admin.cookies,
      body: {
        title: 'Safety check revised',
        passingScore: 80,
        questions: [
          {
            prompt: 'What is least privilege?',
            options: [
              { id: 'a', text: 'Everyone is admin' },
              { id: 'b', text: 'Grant only required access' },
              { id: 'c', text: 'Disable logging' },
            ],
            correctOptionId: 'b',
            sortOrder: 1,
          },
        ],
      },
    },
  );
  assert.equal(updated.response.status, 200, updated.text);
  assert.equal(updated.json.assessment.title, 'Safety check revised');
  assert.equal(updated.json.assessment.questions[0].options.length, 3);

  const publicDetail = await requestJson(
    baseUrl,
    `/api/learning/courses/${created.json.course.id}`,
  );
  assert.equal(publicDetail.response.status, 200, publicDetail.text);
  const serialized = JSON.stringify(publicDetail.json);
  assert.equal(serialized.includes('correctOptionId'), false);
});
