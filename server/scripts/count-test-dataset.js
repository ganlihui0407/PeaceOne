import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTestDatabaseIsolationFromEnv } from '../src/lib/testDatabaseGuard.js';
import { parseDatabaseTarget } from '../src/lib/databaseTarget.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

if (!process.env.TEST_DATABASE_URL) {
  console.error('TEST_DATABASE_URL is not set.');
  process.exit(1);
}

const presentationName = parseDatabaseTarget(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL).databaseName;
applyTestDatabaseIsolationFromEnv(process.env);
if (parseDatabaseTarget(process.env.DATABASE_URL).databaseName !== 'peaceone_test') {
  console.error('DATABASE_URL after isolation is not peaceone_test.');
  process.exit(1);
}

const { prisma, disconnectDatabase } = await import('../src/db.js');

try {
  const connected = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = connected[0]?.name;
  if (name !== 'peaceone_test') {
    throw new Error(`current_database() is "${name}"`);
  }
  if (presentationName === 'peaceone_test') {
    throw new Error('presentation DATABASE_URL already pointed at the test database');
  }

  const [
    companies,
    jobsPublished,
    jobsAll,
    candidates,
    staff,
    applications,
    snapshots,
    interviews,
    offered,
    courses,
    lessons,
    enrolments,
    progress,
    attempts,
    userSkills,
    notifications,
    statuses,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.job.count({ where: { status: 'PUBLISHED' } }),
    prisma.job.count(),
    prisma.user.count({ where: { role: { in: ['STUDENT', 'JOB_SEEKER'] } } }),
    prisma.user.count({ where: { role: 'COMPANY_STAFF' } }),
    prisma.application.count(),
    prisma.applicationResumeSnapshot.count(),
    prisma.interview.count(),
    prisma.application.count({ where: { status: 'OFFERED' } }),
    prisma.learningContent.count({ where: { status: 'PUBLISHED' } }),
    prisma.learningLesson.count(),
    prisma.learningEnrollment.count(),
    prisma.learningLessonProgress.count(),
    prisma.learningAttempt.count(),
    prisma.userSkill.count(),
    prisma.notification.count(),
    prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  console.log(JSON.stringify({
    database: name,
    presentationName,
    companies,
    jobsPublished,
    jobsAll,
    candidates,
    staff,
    applications,
    snapshots,
    interviews,
    offered,
    courses,
    lessons,
    enrolments,
    progress,
    attempts,
    userSkills,
    notifications,
    statuses: Object.fromEntries(statuses.map((row) => [row.status, row._count._all])),
  }, null, 2));
} finally {
  await disconnectDatabase();
}
