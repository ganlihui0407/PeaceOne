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

const TEST_EMAIL_PREFIX = 'stage-lms-';
const TEST_SLUG = `peaceone-test-lms-${Date.now()}`;
const createdEmails = [];
const createdContentIds = [];

let server;
let baseUrl;
let sqlSkill;
let pythonSkill;
let courseId;
let lessonIds = [];
let assessmentId;
let questionIds = [];

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

async function createAdmin() {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'admin');
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'LMS Test Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  return loginAs(email);
}

before(async () => {
  sqlSkill = await prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { contains: 'SQL', mode: 'insensitive' } },
    select: { id: true },
  });
  pythonSkill = await prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { contains: 'Python', mode: 'insensitive' } },
    select: { id: true },
  });
  assert.ok(sqlSkill, 'expected an ESCO SQL skill');
  assert.ok(pythonSkill, 'expected an ESCO Python skill');

  const course = await prisma.learningContent.create({
    data: {
      slug: TEST_SLUG,
      title: 'LMS Isolation Course',
      description: 'Temporary course for automated learning tests.',
      objectives: ['Complete lessons', 'Pass the quiz'],
      category: 'DATA_ANALYTICS',
      difficulty: 'BEGINNER',
      estimatedMinutes: 60,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      skills: {
        create: {
          skillId: sqlSkill.id,
          targetProficiency: 'Beginner',
        },
      },
      lessons: {
        create: [
          { title: 'Lesson one', body: 'First lesson body.', sortOrder: 1, estimatedMinutes: 10 },
          { title: 'Lesson two', body: 'Second lesson body.', sortOrder: 2, estimatedMinutes: 10 },
        ],
      },
    },
    include: { lessons: { orderBy: { sortOrder: 'asc' } } },
  });
  createdContentIds.push(course.id);
  courseId = course.id;
  lessonIds = course.lessons.map((lesson) => lesson.id);

  const assessment = await prisma.learningAssessment.create({
    data: {
      contentId: course.id,
      title: 'Isolation quiz',
      passingScore: 67,
      questions: {
        create: [
          {
            prompt: '2 + 2?',
            sortOrder: 1,
            options: [
              { id: 'a', text: '3' },
              { id: 'b', text: '4' },
            ],
            correctOptionId: 'b',
          },
          {
            prompt: 'SQL stands for?',
            sortOrder: 2,
            options: [
              { id: 'a', text: 'Structured Query Language' },
              { id: 'b', text: 'Simple Query List' },
            ],
            correctOptionId: 'a',
          },
          {
            prompt: 'A primary key is unique?',
            sortOrder: 3,
            options: [
              { id: 'a', text: 'Yes' },
              { id: 'b', text: 'Never' },
            ],
            correctOptionId: 'a',
          },
        ],
      },
    },
    include: { questions: { orderBy: { sortOrder: 'asc' } } },
  });
  assessmentId = assessment.id;
  questionIds = assessment.questions.map((question) => question.id);

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
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  }
  if (createdContentIds.length > 0) {
    await prisma.learningContent.deleteMany({ where: { id: { in: createdContentIds } } });
  }
  await prisma.learningContent.deleteMany({
    where: { slug: { startsWith: 'peaceone-test-lms-' } },
  });

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('unauthenticated visitors can browse published courses but cannot enrol or open lessons', async () => {
  const listed = await requestJson(baseUrl, '/api/learning/courses');
  assert.equal(listed.response.status, 200, listed.text);
  assert.ok(listed.json.courses.some((item) => item.id === courseId));
  const detail = await requestJson(baseUrl, `/api/learning/courses/${courseId}`);
  assert.equal(detail.response.status, 200, detail.text);
  assert.equal(detail.json.course.enrollmentStatus, null);
  assert.equal(detail.json.course.progressPercent, null);
  assert.equal(detail.json.lessons[0].completed, undefined);
  assert.equal(detail.json.assessments[0].passed, undefined);
  const serialized = JSON.stringify(detail.json);
  assert.equal(serialized.includes('correctOptionId'), false);
  const primed = await primeCsrf(baseUrl);
  const enroll = await postJson(baseUrl, '/api/me/learning/enrollments', primed, { contentId: courseId });
  assert.equal(enroll.response.status, 401);
  const lesson = await requestJson(baseUrl, `/api/me/learning/lessons/${lessonIds[0]}`);
  assert.equal(lesson.response.status, 401);
});

test('company staff can browse published courses but cannot enrol', async () => {
  const staff = await registerAs('staff', { role: 'employer' });
  const listed = await requestJson(baseUrl, '/api/learning/courses', { cookies: staff.cookies });
  assert.equal(listed.response.status, 200, listed.text);
  const enroll = await postJson(baseUrl, '/api/me/learning/enrollments', sessionOf(staff), {
    contentId: courseId,
  });
  assert.equal(enroll.response.status, 403);
});

test('students can list and open published courses', async () => {
  const student = await registerAs('reader');
  const listed = await requestJson(baseUrl, '/api/learning/courses?q=LMS Isolation', {
    cookies: student.cookies,
  });
  assert.equal(listed.response.status, 200, listed.text);
  assertNoSecrets(listed.json);
  assert.ok(listed.json.courses.some((item) => item.id === courseId));

  const detail = await requestJson(baseUrl, `/api/learning/courses/${courseId}`, {
    cookies: student.cookies,
  });
  assert.equal(detail.response.status, 200, detail.text);
  assert.equal(detail.json.course.title, 'LMS Isolation Course');
  assert.equal(detail.json.lessons.length, 2);
  assert.equal(detail.json.course.enrollmentStatus, null);
});

test('enrolment, duplicate prevention, lesson completion and progress persistence', async () => {
  const student = await registerAs('progress');
  const session = sessionOf(student);

  const enrolled = await postJson(baseUrl, '/api/me/learning/enrollments', session, { contentId: courseId });
  assert.equal(enrolled.response.status, 201, enrolled.text);
  assert.equal(enrolled.json.enrollment.status, 'ENROLLED');

  const duplicate = await postJson(baseUrl, '/api/me/learning/enrollments', session, { contentId: courseId });
  assert.equal(duplicate.response.status, 409);

  const first = await postJson(baseUrl, `/api/me/learning/lessons/${lessonIds[0]}/complete`, session, {});
  assert.equal(first.response.status, 200, first.text);
  assert.equal(first.json.courseCompleted, false);

  const relogin = sessionOf(await loginAs(student.email));
  const enrollments = await requestJson(baseUrl, '/api/me/learning/enrollments', {
    cookies: relogin.cookies,
  });
  assert.equal(enrollments.response.status, 200);
  const mine = enrollments.json.enrollments.find((item) => item.contentId === courseId);
  assert.ok(mine);
  assert.equal(mine.completedLessonCount, 1);
  assert.equal(mine.progressPercent, 50);
  assert.equal(mine.status, 'IN_PROGRESS');
});

test('failing then passing an assessment completes the course and records skills', async () => {
  const student = await registerAs('quiz');
  const session = sessionOf(student);
  await postJson(baseUrl, '/api/me/learning/enrollments', session, { contentId: courseId });
  await postJson(baseUrl, `/api/me/learning/lessons/${lessonIds[0]}/complete`, session, {});
  await postJson(baseUrl, `/api/me/learning/lessons/${lessonIds[1]}/complete`, session, {});

  const assessment = await requestJson(baseUrl, `/api/me/learning/assessments/${assessmentId}`, {
    cookies: session.cookies,
  });
  assert.equal(assessment.response.status, 200);
  assert.equal(assessment.json.assessment.questions[0].correctOptionId, undefined);

  const fail = await postJson(baseUrl, `/api/me/learning/assessments/${assessmentId}/attempts`, session, {
    answers: [
      { questionId: questionIds[0], optionId: 'a' },
      { questionId: questionIds[1], optionId: 'b' },
      { questionId: questionIds[2], optionId: 'b' },
    ],
  });
  assert.equal(fail.response.status, 201, fail.text);
  assert.equal(fail.json.attempt.passed, false);
  assert.equal(fail.json.courseCompleted, false);

  const userAfterFail = await prisma.userSkill.findUnique({
    where: {
      userId_skillId: {
        userId: (await prisma.user.findUnique({ where: { email: student.email } })).id,
        skillId: sqlSkill.id,
      },
    },
  });
  assert.equal(userAfterFail, null);

  const pass = await postJson(baseUrl, `/api/me/learning/assessments/${assessmentId}/attempts`, session, {
    answers: [
      { questionId: questionIds[0], optionId: 'b' },
      { questionId: questionIds[1], optionId: 'a' },
      { questionId: questionIds[2], optionId: 'a' },
    ],
  });
  assert.equal(pass.response.status, 201, pass.text);
  assert.equal(pass.json.attempt.passed, true);
  assert.equal(pass.json.courseCompleted, true);
  assert.equal(pass.json.skillsAwarded, true);

  const user = await prisma.user.findUnique({ where: { email: student.email } });
  const skill = await prisma.userSkill.findUnique({
    where: { userId_skillId: { userId: user.id, skillId: sqlSkill.id } },
  });
  assert.ok(skill);
  assert.equal(skill.proficiencyLevel, 'Beginner');

  const enrollment = await prisma.learningEnrollment.findUnique({
    where: { userId_contentId: { userId: user.id, contentId: courseId } },
  });
  assert.equal(enrollment.status, 'COMPLETED');

  const notes = await requestJson(baseUrl, '/api/me/notifications', { cookies: session.cookies });
  assert.equal(notes.response.status, 200, notes.text);
  const completedNotes = notes.json.notifications.filter((item) => item.type === 'LEARNING_COURSE_COMPLETED');
  assert.equal(completedNotes.length, 1);
  assert.equal(completedNotes[0].relatedEntityType, 'LEARNING_CONTENT');
  assert.equal(completedNotes[0].relatedEntityId, courseId);

  const secondPass = await postJson(baseUrl, `/api/me/learning/assessments/${assessmentId}/attempts`, session, {
    answers: [
      { questionId: questionIds[0], optionId: 'b' },
      { questionId: questionIds[1], optionId: 'a' },
      { questionId: questionIds[2], optionId: 'a' },
    ],
  });
  assert.equal(secondPass.response.status, 201, secondPass.text);
  assert.equal(secondPass.json.skillsAwarded, false);
  const notesAfter = await requestJson(baseUrl, '/api/me/notifications', { cookies: session.cookies });
  assert.equal(
    notesAfter.json.notifications.filter((item) => item.type === 'LEARNING_COURSE_COMPLETED').length,
    1,
  );
});

test('a student cannot complete another student lesson or read their enrolment list as theirs', async () => {
  const owner = await registerAs('owner');
  const stranger = await registerAs('stranger');
  const ownerSession = sessionOf(owner);
  const strangerSession = sessionOf(stranger);
  await postJson(baseUrl, '/api/me/learning/enrollments', ownerSession, { contentId: courseId });

  const blockedLesson = await requestJson(baseUrl, `/api/me/learning/lessons/${lessonIds[0]}`, {
    cookies: strangerSession.cookies,
  });
  assert.equal(blockedLesson.response.status, 403);

  const blockedComplete = await postJson(
    baseUrl,
    `/api/me/learning/lessons/${lessonIds[0]}/complete`,
    strangerSession,
    {},
  );
  assert.equal(blockedComplete.response.status, 403);

  const strangerList = await requestJson(baseUrl, '/api/me/learning/enrollments', {
    cookies: strangerSession.cookies,
  });
  assert.equal(strangerList.response.status, 200);
  assert.equal(strangerList.json.enrollments.some((item) => item.contentId === courseId), false);
});

test('admin can manage courses and students cannot', async () => {
  const admin = sessionOf(await createAdmin());
  const student = sessionOf(await registerAs('not-admin'));

  const forbidden = await postJson(baseUrl, '/api/admin/learning/courses', student, {
    slug: `${TEST_SLUG}-student`,
    title: 'Should fail',
    description: 'Students cannot create courses.',
    objectives: ['None'],
    category: 'DATA_ANALYTICS',
    difficulty: 'BEGINNER',
    estimatedMinutes: 30,
  });
  assert.equal(forbidden.response.status, 403);

  const created = await postJson(baseUrl, '/api/admin/learning/courses', admin, {
    slug: `${TEST_SLUG}-admin`,
    title: 'Admin created course',
    description: 'Created through the admin API.',
    objectives: ['Publish a course'],
    category: 'CYBERSECURITY',
    difficulty: 'BEGINNER',
    estimatedMinutes: 45,
    skills: [{ skillId: pythonSkill.id, targetProficiency: 'Beginner' }],
  });
  assert.equal(created.response.status, 201, created.text);
  createdContentIds.push(created.json.course.id);

  const lesson = await postJson(
    baseUrl,
    `/api/admin/learning/courses/${created.json.course.id}/lessons`,
    admin,
    {
      title: 'Intro',
      body: 'Admin lesson body.',
      sortOrder: 1,
      estimatedMinutes: 15,
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
  assert.equal(published.json.course.status, 'PUBLISHED');

  const stats = await requestJson(baseUrl, '/api/admin/learning/stats', { cookies: admin.cookies });
  assert.equal(stats.response.status, 200);
  assert.ok(stats.json.courses >= 1);
});
