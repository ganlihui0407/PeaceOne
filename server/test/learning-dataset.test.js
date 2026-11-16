import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { LEARNING_DATASET_COURSES } from '../src/lib/learningDatasetCatalog.js';
import { DEMO_LEARNING_COURSES } from '../src/lib/demoLearningCatalog.js';
import {
  DATASET_GRADUATE_EMAIL,
  DATASET_STUDENT_EMAIL,
  seedLearningDataset,
} from '../src/lib/learningDatasetSeed.js';
import { recommendCourses } from '../src/lib/learningQuery.js';
import { postJson, primeCsrf, requestJson } from './helpers.js';

const SUBSTRING_TRAPS = ['React', 'REST', 'API', 'UI', 'SEO'];

let server;
let baseUrl;
let firstSeed;

before(async () => {
  const connected = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  assert.equal(connected[0].name, 'peaceone_test');
  firstSeed = await seedLearningDataset(prisma);
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('dataset catalogue is unique, published-ready and ESCO-labelled', () => {
  assert.equal(DEMO_LEARNING_COURSES.length, 15);
  assert.ok(LEARNING_DATASET_COURSES.length >= 18);
  const slugs = LEARNING_DATASET_COURSES.map((item) => item.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  const titles = LEARNING_DATASET_COURSES.map((item) => item.title);
  assert.equal(new Set(titles).size, titles.length);

  let lessons = 0;
  let questions = 0;
  const categories = new Set();
  for (const course of LEARNING_DATASET_COURSES) {
    categories.add(course.category);
    assert.ok(course.lessons.length >= 4, course.slug);
    assert.ok(course.quiz.questions.length >= 4, course.slug);
    assert.match(course.lessons[0].body, /Introduction/);
    assert.match(course.lessons[0].body, /Explanation/);
    assert.match(course.lessons[0].body, /Practical example/);
    assert.match(course.lessons[0].body, /Learning summary/);
    assert.match(course.lessons[0].body, /Completion criteria/);
    lessons += course.lessons.length;
    questions += course.quiz.questions.length;
    assert.ok(course.skillLabels.length >= 1);
    assert.ok(course.skillLabels.length <= 3);
    for (const label of course.skillLabels) {
      assert.equal(SUBSTRING_TRAPS.includes(label), false, `${course.slug} ${label}`);
    }
    const orders = course.quiz.questions.map((item) => item.sortOrder);
    assert.equal(new Set(orders).size, orders.length);
  }
  assert.equal(categories.size, 5);
  assert.ok(lessons >= 60, `lessons ${lessons}`);
  assert.ok(questions >= 60, `questions ${questions}`);
});

test('seed writes unique published courses with ESCO foreign keys', async () => {
  assert.ok(firstSeed.totals.courses >= 18);
  assert.ok(firstSeed.totals.lessons >= 60);
  assert.ok(firstSeed.totals.assessments >= 18);
  assert.ok(firstSeed.totals.questions >= 60);
  assert.equal(firstSeed.mappings.length, firstSeed.totals.courseSkills);

  const orphanSkills = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n
    FROM learning_content_skills lcs
    LEFT JOIN skills s ON s.id = lcs.skill_id
    WHERE s.id IS NULL OR s.source_system <> 'ESCO'
  `;
  assert.equal(orphanSkills[0].n, 0);

  const duplicateSkills = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM (
      SELECT 1 FROM learning_content_skills
      GROUP BY content_id, skill_id
      HAVING COUNT(*) > 1
    ) d
  `;
  assert.equal(duplicateSkills[0].n, 0);

  const unpublished = await prisma.learningContent.count({
    where: { slug: { startsWith: 'peaceone-demo-' }, status: { not: 'PUBLISHED' } },
  });
  assert.equal(unpublished, 0);
});

test('demo enrolments match the intended Aisyah and Tan states', async () => {
  const rows = await prisma.learningEnrollment.findMany({
    where: { user: { email: { in: [DATASET_STUDENT_EMAIL, DATASET_GRADUATE_EMAIL] } } },
    include: {
      user: { select: { email: true } },
      content: {
        select: {
          slug: true,
          _count: { select: { lessons: true } },
        },
      },
    },
  });
  const mapped = [];
  for (const row of rows) {
    const completed = await prisma.learningLessonProgress.count({
      where: { userId: row.userId, contentId: row.contentId },
    });
    mapped.push({
      email: row.user.email,
      slug: row.content.slug,
      status: row.status,
      lessons: row.content._count.lessons,
      completed,
    });
  }
  const byKey = Object.fromEntries(mapped.map((row) => [`${row.email}:${row.slug}`, row]));
  const sql = byKey[`${DATASET_STUDENT_EMAIL}:peaceone-demo-sql-fundamentals`];
  assert.equal(sql.status, 'COMPLETED');
  assert.equal(sql.completed, sql.lessons);
  assert.equal(Number(sql.lessons), 4);

  const js = byKey[`${DATASET_STUDENT_EMAIL}:peaceone-demo-javascript-programming-fundamentals`];
  assert.equal(js.status, 'IN_PROGRESS');
  assert.equal(Number(js.completed), 2);
  assert.equal(Number(js.lessons), 4);

  const react = byKey[`${DATASET_STUDENT_EMAIL}:peaceone-demo-react-development-essentials`];
  assert.equal(react.status, 'ENROLLED');
  assert.equal(Number(react.completed), 0);

  const python = byKey[`${DATASET_GRADUATE_EMAIL}:peaceone-demo-python-for-data-analysis`];
  assert.equal(python.status, 'IN_PROGRESS');
  assert.equal(Number(python.completed), 2);
});

test('completing SQL awards the exact ESCO SQL UserSkill using existing rules', async () => {
  const sqlSkill = await prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { equals: 'SQL', mode: 'insensitive' } },
  });
  const student = await prisma.user.findUnique({ where: { email: DATASET_STUDENT_EMAIL } });
  const awarded = await prisma.userSkill.findUnique({
    where: { userId_skillId: { userId: student.id, skillId: sqlSkill.id } },
  });
  assert.ok(awarded);
  assert.equal(['Beginner', 'Intermediate', 'Advanced'].includes(awarded.proficiencyLevel), true);
});

test('repeated seed is idempotent and does not duplicate enrolments or questions', async () => {
  const before = firstSeed.totals;
  const enrollmentsBefore = await prisma.learningEnrollment.count({
    where: { user: { email: { in: [DATASET_STUDENT_EMAIL, DATASET_GRADUATE_EMAIL] } } },
  });
  const second = await seedLearningDataset(prisma);
  assert.equal(second.totals.courses, before.courses);
  assert.equal(second.totals.lessons, before.lessons);
  assert.equal(second.totals.questions, before.questions);
  assert.equal(second.totals.courseSkills, before.courseSkills);
  const enrollmentsAfter = await prisma.learningEnrollment.count({
    where: { user: { email: { in: [DATASET_STUDENT_EMAIL, DATASET_GRADUATE_EMAIL] } } },
  });
  assert.equal(enrollmentsAfter, enrollmentsBefore);
  const sql = await prisma.learningEnrollment.findFirst({
    where: {
      user: { email: DATASET_STUDENT_EMAIL },
      content: { slug: 'peaceone-demo-sql-fundamentals' },
    },
  });
  assert.equal(sql.status, 'COMPLETED');
});

test('API course counts match SQL and quiz GET hides answers plus explanations', async () => {
  const listed = await requestJson(baseUrl, '/api/learning/courses?limit=20&q=SQL%20Fundamentals');
  assert.equal(listed.response.status, 200, listed.text);
  const sqlCount = await prisma.learningContent.count({
    where: { slug: 'peaceone-demo-sql-fundamentals', status: 'PUBLISHED' },
  });
  assert.equal(sqlCount, 1);
  assert.equal(listed.json.total, 1);
  assert.equal(listed.json.courses[0].slug, 'peaceone-demo-sql-fundamentals');

  const sql = await prisma.learningContent.findUnique({
    where: { slug: 'peaceone-demo-sql-fundamentals' },
    include: { assessments: { include: { questions: true } } },
  });
  const primed = await primeCsrf(baseUrl);
  const login = await postJson(baseUrl, '/api/auth/login', primed, {
    email: DATASET_STUDENT_EMAIL,
    password: process.env.DEMO_SEED_PASSWORD || 'PeaceOneDemo1',
  });
  assert.equal(login.response.status, 200, login.text);
  const cookies = login.cookies;

  const assessmentId = sql.assessments[0].id;
  const quiz = await requestJson(baseUrl, `/api/me/learning/assessments/${assessmentId}`, { cookies });
  assert.equal(quiz.response.status, 200, quiz.text);
  const body = JSON.stringify(quiz.json);
  assert.equal(body.includes('correctOptionId'), false);
  assert.equal(body.includes('"explanation"'), false);
  assert.ok(quiz.json.assessment.questions[0].options[0].text);
});

test('published course list filters by exact LearningContentSkill identifiers', async () => {
  const sqlSkill = await prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { equals: 'SQL', mode: 'insensitive' } },
  });
  assert.ok(sqlSkill);
  const matched = await requestJson(baseUrl, `/api/learning/courses?skillId=${sqlSkill.id}&limit=50`);
  assert.equal(matched.response.status, 200, matched.text);
  assert.ok(matched.json.courses.length >= 1);
  assert.ok(matched.json.courses.every((course) => (
    course.skills.some((item) => item.skillId === sqlSkill.id)
  )));
  assert.ok(matched.json.courses.some((course) => course.slug === 'peaceone-demo-sql-fundamentals'));

  const invalid = await requestJson(baseUrl, '/api/learning/courses?skillId=not-a-uuid');
  assert.equal(invalid.response.status, 400);

  const primed = await primeCsrf(baseUrl);
  const login = await postJson(baseUrl, '/api/auth/login', primed, {
    email: DATASET_STUDENT_EMAIL,
    password: process.env.DEMO_SEED_PASSWORD || 'PeaceOneDemo1',
  });
  assert.equal(login.response.status, 200, login.text);
  const listed = await requestJson(baseUrl, '/api/learning/courses?q=SQL%20Fundamentals', {
    cookies: login.cookies,
  });
  const sqlCourse = listed.json.courses.find((item) => item.slug === 'peaceone-demo-sql-fundamentals');
  assert.equal(sqlCourse.enrollmentStatus, 'COMPLETED');
  assert.equal(sqlCourse.progressPercent, 100);
});

test('recommendations return published courses covering unrecorded occupation skills', async () => {
  const sqlSkill = await prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { equals: 'SQL', mode: 'insensitive' } },
  });
  const occupation = await prisma.occupation.findFirst({
    where: {
      sourceSystem: 'ESCO',
      preferredLabel: { equals: 'database developer', mode: 'insensitive' },
      skillRelations: { some: { skillId: sqlSkill.id } },
    },
    select: { id: true, preferredLabel: true },
  });
  assert.ok(occupation, 'expected the ESCO database developer occupation linked to SQL');

  const outsider = await prisma.user.create({
    data: {
      email: `p15-rec-${Date.now()}@peaceone.test`,
      passwordHash: (await prisma.user.findUnique({ where: { email: DATASET_STUDENT_EMAIL } })).passwordHash,
      fullName: 'Recommendation Fixture',
      role: 'STUDENT',
      termsAcceptedAt: new Date(),
      targetOccupationId: occupation.id,
    },
  });
  try {
    const payload = await recommendCourses(prisma, outsider.id);
    assert.equal(payload.status, 'ready');
    assert.ok(payload.courses.some((item) => item.slug === 'peaceone-demo-sql-fundamentals'));
    assert.ok(payload.courses.every((item) => item.status === 'PUBLISHED'));
    assert.ok(payload.courses.every((item) => item.matchedSkillCount >= 1));
  } finally {
    await prisma.user.delete({ where: { id: outsider.id } });
  }
});
