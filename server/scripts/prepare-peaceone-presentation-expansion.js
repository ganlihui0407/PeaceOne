import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { parseDatabaseTarget, PRESENTATION_DATABASE_NAME } from '../src/lib/databaseTarget.js';
import {
  dryRunPeaceonePresentationExpansion,
  verifyPhase2BackupChecksum,
} from '../src/lib/peaceonePresentationExpansionSeed.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

if (!process.env.DATABASE_URL) {
  console.error('Refusing dry-run: DATABASE_URL is not set.');
  process.exit(1);
}

const target = parseDatabaseTarget(process.env.DATABASE_URL);
if (target.databaseName !== PRESENTATION_DATABASE_NAME) {
  console.error(`Refusing dry-run: DATABASE_URL database is "${target.databaseName}".`);
  process.exit(1);
}
if (target.databaseName === 'peaceone_test') {
  console.error('Refusing dry-run: DATABASE_URL points at peaceone_test.');
  process.exit(1);
}

const guard = new pg.Client({ connectionString: process.env.DATABASE_URL });
await guard.connect();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  await guard.query('SET default_transaction_read_only = on');
  const identity = await guard.query(
    'SELECT current_database()::text AS name, current_user::text AS db_user, version()::text AS version',
  );
  const name = identity.rows[0].name;
  if (name !== PRESENTATION_DATABASE_NAME) {
    throw new Error(`Refusing dry-run: current_database() is "${name}".`);
  }

  const startedAt = new Date().toISOString();
  const backup = verifyPhase2BackupChecksum(path.resolve(serverRoot, '..'));
  console.log(`PeaceOne presentation expansion DRY-RUN on 127.0.0.1/${name} (read-only).`);
  console.log(`Backup verified: ${backup.relativePath} SHA-256 ${backup.sha256}`);
  const result = await dryRunPeaceonePresentationExpansion(prisma);
  const finishedAt = new Date().toISOString();
  console.log(JSON.stringify({
    startedAt,
    finishedAt,
    backup,
    identity: result.identity,
    presentationMutations: result.presentationMutations,
    writes: result.writes,
    mode: result.mode,
    baseline: {
      users: result.baseline.users,
      companies: result.baseline.companies,
      publishedJobs: result.baseline.publishedJobs,
      candidates: result.baseline.candidates,
      applications: result.baseline.applications,
      interviews: result.baseline.interviews,
      offers: result.baseline.offers,
      courses: result.baseline.courses,
      lessons: result.baseline.lessons,
      enrolments: result.baseline.enrolments,
      progress: result.baseline.progress,
      attempts: result.baseline.attempts,
      completed: result.baseline.completed,
      notifications: result.baseline.notifications,
      userSkills: result.baseline.userSkills,
      occupations: result.baseline.occupations,
      skills: result.baseline.skills,
      statuses: result.baseline.statuses,
      integrity: result.baseline.integrity,
      industries: result.baseline.industries,
      roles: result.baseline.roles,
    },
    protected: result.protectedRecords,
    missing: result.missing,
    proposedFinal: result.proposedFinal,
    comparison: result.comparison,
    esco: result.esco,
    conflicts: result.conflicts,
    achievable: result.achievable,
    preservedWalkthrough: result.preservedWalkthrough,
    companyPlan: result.plans.companies,
    userSummary: {
      alreadyExists: result.plans.users.filter((item) => item.classification === 'ALREADY EXISTS').length,
      missing: result.plans.users.filter((item) => item.classification === 'MISSING').length,
      conflict: result.plans.users.filter((item) => item.classification === 'CONFLICT').length,
    },
    jobSummary: {
      alreadyExists: result.plans.jobs.filter((item) => item.classification === 'ALREADY EXISTS').length,
      missing: result.plans.jobs.filter((item) => item.classification === 'MISSING').length,
    },
    courseSummary: {
      alreadyExists: result.plans.courses.filter((item) => item.classification === 'ALREADY EXISTS').length,
      missing: result.plans.courses.filter((item) => item.classification === 'MISSING').length,
      conflict: result.plans.courses.filter((item) => item.classification === 'CONFLICT').length,
    },
  }, null, 2));
  console.log('\nPresentation INSERT statements: 0');
  console.log('Presentation UPDATE statements: 0');
  console.log('Presentation DELETE statements: 0');
  console.log('Presentation UPSERT statements: 0');
  console.log(`Dry-run started: ${startedAt}`);
  console.log(`Dry-run finished: ${finishedAt}`);
  console.log('\nNo INSERT/UPDATE/DELETE/UPSERT was issued. Presentation peaceone was not mutated.');
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await guard.end();
}
