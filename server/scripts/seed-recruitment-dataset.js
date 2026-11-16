import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTestDatabaseIsolationFromEnv } from '../src/lib/testDatabaseGuard.js';
import { parseDatabaseTarget } from '../src/lib/databaseTarget.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

if (!process.env.TEST_DATABASE_URL) {
  console.error('Refusing recruitment dataset seed: TEST_DATABASE_URL is not set.');
  process.exit(1);
}

const presentationName = parseDatabaseTarget(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL).databaseName;
applyTestDatabaseIsolationFromEnv(process.env);

if (parseDatabaseTarget(process.env.DATABASE_URL).databaseName !== 'peaceone_test') {
  console.error('Refusing recruitment dataset seed: process DATABASE_URL is not peaceone_test.');
  process.exit(1);
}

const { prisma, disconnectDatabase } = await import('../src/db.js');
const { seedRecruitmentDataset } = await import('../src/lib/recruitmentDatasetSeed.js');

try {
  const connected = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = connected[0]?.name;
  if (name !== 'peaceone_test') {
    throw new Error(`Refusing recruitment dataset seed: current_database() is "${name}".`);
  }
  if (presentationName === 'peaceone_test') {
    throw new Error('Refusing recruitment dataset seed: presentation DATABASE_URL already pointed at the test database.');
  }

  console.log(`Seeding PeaceOne recruitment dataset into 127.0.0.1/${name} (presentation remains ${presentationName}).`);
  const result = await seedRecruitmentDataset(prisma);
  console.log('\nSeed counts');
  for (const [key, value] of Object.entries(result.counts)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nIntegrity totals');
  for (const [key, value] of Object.entries(result.integrity.totals)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nApplication statuses');
  console.log(JSON.stringify(result.integrity.statuses, null, 2));
  console.log(`\nESCO JobSkill mappings: ${result.mappings.length}`);
  if (result.conflicts.length) {
    console.log('\nConflicts (existing records left unchanged)');
    for (const item of result.conflicts) {
      console.log(`  - ${item}`);
    }
  }
  console.log('\nAll organisations and people in this dataset are synthetic demonstration records.');
  console.log('Presentation peaceone was not written.');
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
