import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PHASE2_BACKUP_SHA256,
  PHASE2_ISOLATED_DATABASE_NAME,
  PRESENTATION_EXPANSION_TARGETS,
  WRITE_REFUSAL,
} from '../src/lib/peaceonePresentationExpansionCatalog.js';
import {
  PRESENTATION_COMPANIES,
  PRESENTATION_JOBS,
  PRESENTATION_CANDIDATES,
  PRESENTATION_COURSES,
} from '../src/lib/presentationDemoDatasetCatalog.js';
import { createPrismaClient } from '../src/db.js';
import {
  assertPeaceonePresentationDatabase,
  assertPhase2IsolatedWriteDatabase,
  executePeaceonePresentationExpansion,
  seedPeaceonePresentationExpansion,
  verifyPhase2BackupChecksum,
} from '../src/lib/peaceonePresentationExpansionSeed.js';
import { prisma } from '../src/db.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const container = process.env.PEACEONE_POSTGRES_CONTAINER || 'peaceone-postgres';

test('Phase 1 expansion catalogue is unchanged and reused', () => {
  assert.equal(PRESENTATION_COMPANIES.length, 15);
  assert.equal(PRESENTATION_JOBS.length, 50);
  assert.equal(PRESENTATION_CANDIDATES.length, 85);
  assert.equal(PRESENTATION_COURSES.length, 12);
});

test('Option A presentation expansion targets preserve leftover walkthrough records', () => {
  assert.equal(PRESENTATION_EXPANSION_TARGETS.companies, 21);
  assert.equal(PRESENTATION_EXPANSION_TARGETS.publishedJobs, 61);
  assert.equal(PRESENTATION_EXPANSION_TARGETS.candidates, 107);
  assert.equal(PRESENTATION_EXPANSION_TARGETS.applications, 250);
  assert.equal(PRESENTATION_EXPANSION_TARGETS.interviews, 60);
  assert.equal(PRESENTATION_EXPANSION_TARGETS.offers, 15);
  assert.equal(PRESENTATION_EXPANSION_TARGETS.publishedCourses, 30);
  assert.equal(PRESENTATION_EXPANSION_TARGETS.lessons, 120);
});

test('Phase 2 backup checksum still matches the Prompt 26 dump', () => {
  const backup = verifyPhase2BackupChecksum(repoRoot);
  assert.equal(backup.sha256, PHASE2_BACKUP_SHA256);
  assert.ok(backup.bytes > 0);
});

test('presentation dry-run identity rejects peaceone_test', async () => {
  const connected = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  assert.equal(connected[0].name, 'peaceone_test');
  await assert.rejects(
    () => assertPeaceonePresentationDatabase(prisma),
    /peaceone_test/,
  );
});

test('presentation expansion write entrypoint always refuses', async () => {
  await assert.rejects(
    () => seedPeaceonePresentationExpansion(prisma),
    new RegExp(WRITE_REFUSAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );
});

test('Phase 2 execute refuses peaceone_test', async () => {
  await assert.rejects(
    () => assertPhase2IsolatedWriteDatabase(prisma),
    /peaceone_test/,
  );
  await assert.rejects(
    () => executePeaceonePresentationExpansion(prisma),
    /peaceone_test/,
  );
});

function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function isolatedUrl() {
  const source = process.env.TEST_DATABASE_URL;
  const url = new URL(source);
  url.pathname = `/${PHASE2_ISOLATED_DATABASE_NAME}`;
  return url.toString();
}

async function restoreIsolatedCopy() {
  const backup = verifyPhase2BackupChecksum(repoRoot);
  docker(['exec', container, 'psql', '-U', 'peaceone', '-d', 'postgres', '-c',
    `DROP DATABASE IF EXISTS ${PHASE2_ISOLATED_DATABASE_NAME} WITH (FORCE)`]);
  docker(['exec', container, 'psql', '-U', 'peaceone', '-d', 'postgres', '-c',
    `CREATE DATABASE ${PHASE2_ISOLATED_DATABASE_NAME} OWNER peaceone`]);
  docker(['cp', backup.backupPath, `${container}:/tmp/peaceone-phase2-isolated.dump`]);
  try {
    docker([
      'exec',
      container,
      'pg_restore',
      `--dbname=${PHASE2_ISOLATED_DATABASE_NAME}`,
      '--username=peaceone',
      '--no-owner',
      '--no-acl',
      '/tmp/peaceone-phase2-isolated.dump',
    ]);
  } catch (error) {
    const combined = `${error.stdout || ''}\n${error.stderr || ''}\n${error.message || ''}`;
    if (!/WARNING|errors ignored/i.test(combined) && error.status !== 1) {
      throw error;
    }
  }
}

function dropIsolatedCopy() {
  docker(['exec', container, 'psql', '-U', 'peaceone', '-d', 'postgres', '-c',
    `DROP DATABASE IF EXISTS ${PHASE2_ISOLATED_DATABASE_NAME} WITH (FORCE)`]);
}

test('isolated Phase 2 seed preserves walkthrough records, meets Option A totals, and is idempotent', { timeout: 600000 }, async () => {
  await restoreIsolatedCopy();
  const isolated = createPrismaClient(isolatedUrl());
  try {
    const beforeUsers = await isolated.user.findMany({
      select: { email: true, role: true, passwordHash: true, fullName: true, accountStatus: true },
    });
    const beforeCompanies = await isolated.company.findMany({
      select: { companyName: true, registrationNumber: true },
    });
    const beforeJobs = await isolated.job.findMany({
      select: { title: true, status: true, company: { select: { companyName: true } } },
    });
    const aisyah = await isolated.user.findUnique({
      where: { email: 'student@peaceone.demo' },
      include: { skills: { include: { skill: { select: { preferredLabel: true } } } } },
    });
    const sql = await isolated.learningContent.findUnique({
      where: { slug: 'peaceone-demo-sql-fundamentals' },
    });
    const aisyahSql = await isolated.learningEnrollment.findUnique({
      where: { userId_contentId: { userId: aisyah.id, contentId: sql.id } },
    });
    const beforeApps = await isolated.application.findMany({
      select: { id: true, status: true, applicantUserId: true, jobId: true },
    });
    const beforeSkillMap = Object.fromEntries(
      aisyah.skills.map((row) => [row.skill.preferredLabel, row.proficiencyLevel]),
    );

    assert.ok(beforeCompanies.some((row) => row.companyName.includes('Northwind')));
    assert.ok(beforeJobs.some((row) => row.title === 'Stage 8.3 Backend Engineer'));
    assert.equal(aisyahSql.status, 'COMPLETED');

    const first = await executePeaceonePresentationExpansion(isolated);
    const after = await isolated.$transaction(async (tx) => ({
      companies: await tx.company.count(),
      publishedJobs: await tx.job.count({ where: { status: 'PUBLISHED' } }),
      candidates: await tx.user.count({ where: { role: { in: ['STUDENT', 'JOB_SEEKER'] } } }),
      applications: await tx.application.count(),
      snapshots: await tx.applicationResumeSnapshot.count(),
      interviews: await tx.interview.count(),
      offers: await tx.application.count({ where: { status: 'OFFERED' } }),
      courses: await tx.learningContent.count({ where: { status: 'PUBLISHED' } }),
      lessons: await tx.learningLesson.count(),
      enrolments: await tx.learningEnrollment.count(),
      progress: await tx.learningLessonProgress.count(),
      attempts: await tx.learningAttempt.count(),
      completed: await tx.learningEnrollment.count({ where: { status: 'COMPLETED' } }),
      notifications: await tx.notification.count(),
      northwind: await tx.company.findFirst({ where: { companyName: { contains: 'Northwind' } } }),
      stage83: await tx.job.findFirst({ where: { title: 'Stage 8.3 Backend Engineer' } }),
    }));

    assert.equal(after.companies, PRESENTATION_EXPANSION_TARGETS.companies);
    assert.equal(after.publishedJobs, PRESENTATION_EXPANSION_TARGETS.publishedJobs);
    assert.equal(after.candidates, PRESENTATION_EXPANSION_TARGETS.candidates);
    assert.equal(after.applications, PRESENTATION_EXPANSION_TARGETS.applications);
    assert.equal(after.snapshots, PRESENTATION_EXPANSION_TARGETS.applications);
    assert.equal(after.interviews, PRESENTATION_EXPANSION_TARGETS.interviews);
    assert.equal(after.offers, PRESENTATION_EXPANSION_TARGETS.offers);
    assert.equal(after.courses, PRESENTATION_EXPANSION_TARGETS.publishedCourses);
    assert.equal(after.lessons, PRESENTATION_EXPANSION_TARGETS.lessons);
    assert.equal(after.enrolments, PRESENTATION_EXPANSION_TARGETS.enrolments);
    assert.ok(after.progress >= PRESENTATION_EXPANSION_TARGETS.lessonProgressMin);
    assert.ok(after.progress <= PRESENTATION_EXPANSION_TARGETS.lessonProgressMax);
    assert.equal(after.attempts, PRESENTATION_EXPANSION_TARGETS.assessmentAttempts);
    assert.ok(after.completed >= PRESENTATION_EXPANSION_TARGETS.completedCoursesMin);
    assert.ok(after.completed <= PRESENTATION_EXPANSION_TARGETS.completedCoursesMax);
    assert.ok(after.notifications >= PRESENTATION_EXPANSION_TARGETS.notificationsMin);
    assert.ok(after.northwind);
    assert.ok(after.stage83);

    for (const user of beforeUsers) {
      const current = await isolated.user.findUnique({ where: { email: user.email } });
      assert.equal(current.role, user.role);
      assert.equal(current.passwordHash, user.passwordHash);
      assert.equal(current.fullName, user.fullName);
      assert.equal(current.accountStatus, user.accountStatus);
    }
    for (const company of beforeCompanies) {
      const current = await isolated.company.findFirst({
        where: { companyName: company.companyName },
      });
      assert.ok(current);
    }
    for (const job of beforeJobs) {
      const current = await isolated.job.findFirst({
        where: { title: job.title, company: { companyName: job.company.companyName } },
      });
      assert.equal(current.status, job.status);
    }
    for (const application of beforeApps) {
      const current = await isolated.application.findUnique({ where: { id: application.id } });
      assert.equal(current.status, application.status);
    }

    const aisyahAfter = await isolated.user.findUnique({
      where: { email: 'student@peaceone.demo' },
      include: { skills: { include: { skill: { select: { preferredLabel: true } } } } },
    });
    for (const [label, level] of Object.entries(beforeSkillMap)) {
      const row = aisyahAfter.skills.find((item) => item.skill.preferredLabel === label);
      assert.equal(row.proficiencyLevel, level);
    }
    const sqlAfter = await isolated.learningEnrollment.findUnique({
      where: { userId_contentId: { userId: aisyah.id, contentId: sql.id } },
    });
    assert.equal(sqlAfter.status, 'COMPLETED');

    const duplicateApps = await isolated.$queryRaw`
      SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM applications GROUP BY job_id, applicant_user_id HAVING COUNT(*) > 1) d
    `;
    assert.equal(duplicateApps[0].n, 0);

    const second = await executePeaceonePresentationExpansion(isolated);
    assert.equal(second.counts.applicationsCreated, 0);
    assert.equal(second.counts.companiesCreated, 0);
    assert.equal(second.counts.jobsCreated, 0);
    assert.equal(second.counts.usersCreated, 0);
    assert.equal(first.conflicts.length, 0);
  } finally {
    await isolated.$disconnect();
    dropIsolatedCopy();
  }
});
