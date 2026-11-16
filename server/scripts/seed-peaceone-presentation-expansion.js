import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { parseDatabaseTarget, PRESENTATION_DATABASE_NAME } from '../src/lib/databaseTarget.js';
import { PRESENTATION_WRITE_APPROVAL } from '../src/lib/peaceonePresentationExpansionCatalog.js';
import {
  seedPeaceonePresentationExpansion,
  verifyPhase2BackupChecksum,
} from '../src/lib/peaceonePresentationExpansionSeed.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

if (process.env.PEACEONE_USE_TEST_DATABASE === '1') {
  console.error('Refusing presentation seed: PEACEONE_USE_TEST_DATABASE is set.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Refusing presentation seed: DATABASE_URL is not set.');
  process.exit(1);
}

const target = parseDatabaseTarget(process.env.DATABASE_URL);
if (target.databaseName !== PRESENTATION_DATABASE_NAME) {
  console.error(`Refusing presentation seed: DATABASE_URL database is "${target.databaseName}".`);
  process.exit(1);
}
if (target.databaseName === 'peaceone_test' || target.databaseName === 'peaceone_phase2_seed_test') {
  console.error('Refusing presentation seed: DATABASE_URL is not the presentation database.');
  process.exit(1);
}

const backup = verifyPhase2BackupChecksum(path.resolve(serverRoot, '..'));
const guard = new pg.Client({ connectionString: process.env.DATABASE_URL });
await guard.connect();
let prisma;
try {
  const identity = await guard.query(
    'SELECT current_database()::text AS name, current_user::text AS db_user, version()::text AS version',
  );
  const name = identity.rows[0].name;
  if (name !== PRESENTATION_DATABASE_NAME) {
    throw new Error(`Refusing presentation seed: current_database() is "${name}".`);
  }

  console.log(`PeaceOne presentation expansion WRITE on 127.0.0.1/${name}.`);
  console.log(`Backup verified: ${backup.relativePath} SHA-256 ${backup.sha256}`);
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const startedAt = new Date().toISOString();
  const result = await seedPeaceonePresentationExpansion(prisma, {
    authorisedPresentationWrite: PRESENTATION_WRITE_APPROVAL,
  });
  const finishedAt = new Date().toISOString();
  console.log(JSON.stringify({
    startedAt,
    finishedAt,
    identity: {
      database: name,
      currentUser: identity.rows[0].db_user,
      version: identity.rows[0].version,
    },
    backup,
    counts: result.counts,
    conflicts: result.conflicts,
    integrityTotals: {
      users: result.integrity.users,
      companies: result.integrity.companies,
      publishedJobs: result.integrity.publishedJobs,
      candidates: result.integrity.candidates,
      applications: result.integrity.applications,
      snapshots: result.integrity.snapshots,
      interviews: result.integrity.interviews,
      offers: result.integrity.offers,
      courses: result.integrity.courses,
      lessons: result.integrity.lessons,
      enrolments: result.integrity.enrolments,
      progress: result.integrity.progress,
      attempts: result.integrity.attempts,
      completed: result.integrity.completed,
      notifications: result.integrity.notifications,
      userSkills: result.integrity.userSkills,
      statuses: result.integrity.statuses,
      integrity: result.integrity.integrity,
    },
  }, null, 2));
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  if (prisma) {
    await prisma.$disconnect();
  }
  await guard.end();
}
