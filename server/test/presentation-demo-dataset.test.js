import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import {
  DATASET_TARGETS,
  PRESENTATION_CANDIDATES,
  PRESENTATION_COMPANIES,
  PRESENTATION_COURSES,
  PRESENTATION_JOBS,
  STATUS_TARGETS,
} from '../src/lib/presentationDemoDatasetCatalog.js';
import {
  assertPeaceoneTestDatabase,
  collectPresentationDemoIntegrity,
  seedPresentationDemoDataset,
} from '../src/lib/presentationDemoDatasetSeed.js';

let firstSeed;
let secondSeed;

before(async () => {
  const connected = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  assert.equal(connected[0].name, 'peaceone_test');
  firstSeed = await seedPresentationDemoDataset(prisma);
  secondSeed = await seedPresentationDemoDataset(prisma);
});

after(async () => {
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('presentation demo catalogue is deterministic and unique', () => {
  assert.equal(PRESENTATION_COMPANIES.length, 15);
  assert.equal(PRESENTATION_JOBS.length, 50);
  assert.equal(PRESENTATION_CANDIDATES.length, 85);
  assert.equal(PRESENTATION_COURSES.length, 12);
  assert.equal(new Set(PRESENTATION_COMPANIES.map((item) => item.registrationNumber)).size, 15);
  assert.equal(new Set(PRESENTATION_CANDIDATES.map((item) => item.email)).size, 85);
  assert.equal(new Set(PRESENTATION_JOBS.map((item) => `${item.companyKey}::${item.title}`)).size, 50);
  assert.ok(PRESENTATION_COMPANIES.every((item) => item.registrationNumber.startsWith('DEMO-PRESENTATION-COMPANY-')));
  assert.ok(PRESENTATION_CANDIDATES.every((item) => item.email.endsWith('@peaceone.demo')));
});

test('seed refuses any database other than peaceone_test', async () => {
  await assert.rejects(
    () => assertPeaceoneTestDatabase({
      $queryRaw: async () => [{ name: 'peaceone' }],
    }),
    /peaceone_test/,
  );
});

test('expanded dataset reaches demonstration totals without duplicates', async () => {
  const integrity = firstSeed.integrity;
  assert.equal(integrity.database, 'peaceone_test');
  assert.equal(integrity.totals.companies, DATASET_TARGETS.companies);
  assert.equal(integrity.totals.publishedJobs, DATASET_TARGETS.publishedJobs);
  assert.equal(integrity.totals.candidates, DATASET_TARGETS.candidates);
  assert.equal(integrity.totals.applications, DATASET_TARGETS.applications);
  assert.equal(integrity.totals.snapshots, DATASET_TARGETS.applications);
  assert.equal(integrity.totals.interviews, DATASET_TARGETS.interviews);
  assert.equal(integrity.totals.offers, DATASET_TARGETS.offers);
  assert.equal(integrity.totals.courses, DATASET_TARGETS.publishedCourses);
  assert.equal(integrity.totals.lessons, DATASET_TARGETS.lessons);
  assert.equal(integrity.totals.enrolments, DATASET_TARGETS.enrolments);
  assert.ok(integrity.totals.progress >= DATASET_TARGETS.lessonProgressMin);
  assert.ok(integrity.totals.progress <= DATASET_TARGETS.lessonProgressMax);
  assert.equal(integrity.totals.attempts, DATASET_TARGETS.assessmentAttempts);
  assert.ok(integrity.totals.notifications >= DATASET_TARGETS.notificationsMin);
  assert.ok(integrity.totals.completed >= DATASET_TARGETS.completedCoursesMin);
  assert.ok(integrity.totals.completed <= DATASET_TARGETS.completedCoursesMax);
  assert.ok(integrity.totals.hrAccounts >= 20);
  assert.equal(integrity.duplicates.applications, 0);
  assert.equal(integrity.duplicates.enrolments, 0);
  assert.equal(integrity.duplicates.userSkills, 0);
  assert.equal(integrity.orphans.jobSkills, 0);
  assert.equal(integrity.orphans.courseSkills, 0);
  assert.equal(integrity.orphans.missingSnapshots, 0);
  assert.equal(integrity.orphans.interviewMismatches, 0);
  for (const [status, target] of Object.entries(STATUS_TARGETS)) {
    assert.equal(integrity.statuses[status], target, status);
  }
});

test('second seed is idempotent and preserves Aisyah Rahman', async () => {
  assert.equal(secondSeed.counts.companiesCreated, 0);
  assert.equal(secondSeed.counts.usersCreated, 0);
  assert.equal(secondSeed.counts.jobsCreated, 0);
  assert.equal(secondSeed.counts.applicationsCreated, 0);
  assert.equal(secondSeed.counts.interviewsCreated, 0);
  assert.equal(secondSeed.counts.enrollmentsCreated, 0);
  assert.equal(secondSeed.integrity.totals.applications, firstSeed.integrity.totals.applications);
  assert.equal(secondSeed.integrity.totals.notifications, firstSeed.integrity.totals.notifications);

  const aisyah = await prisma.user.findUnique({
    where: { email: 'student@peaceone.demo' },
    select: { id: true, fullName: true },
  });
  assert.equal(aisyah.fullName, 'Aisyah Rahman');
  const sql = await prisma.learningContent.findUnique({
    where: { slug: 'peaceone-demo-sql-fundamentals' },
    select: { id: true },
  });
  const enrolment = await prisma.learningEnrollment.findUnique({
    where: { userId_contentId: { userId: aisyah.id, contentId: sql.id } },
  });
  assert.equal(enrolment.status, 'COMPLETED');
});

test('post-seed integrity still matches peaceone_test targets', async () => {
  const integrity = await collectPresentationDemoIntegrity(prisma);
  assert.equal(integrity.database, 'peaceone_test');
  assert.equal(integrity.totals.companies, 20);
  assert.equal(integrity.totals.publishedJobs, 60);
  assert.equal(integrity.totals.candidates, 100);
  assert.equal(integrity.totals.applications, 250);
});
