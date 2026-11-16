import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTestDatabaseIsolationFromEnv } from '../src/lib/testDatabaseGuard.js';
import { parseDatabaseTarget } from '../src/lib/databaseTarget.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

if (!process.env.TEST_DATABASE_URL) {
  console.error('Refusing presentation demo dataset seed: TEST_DATABASE_URL is not set.');
  process.exit(1);
}

const presentationName = parseDatabaseTarget(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL).databaseName;
applyTestDatabaseIsolationFromEnv(process.env);

if (parseDatabaseTarget(process.env.DATABASE_URL).databaseName !== 'peaceone_test') {
  console.error('Refusing presentation demo dataset seed: process DATABASE_URL is not peaceone_test.');
  process.exit(1);
}

const { prisma, disconnectDatabase } = await import('../src/db.js');
const { seedPresentationDemoDataset } = await import('../src/lib/presentationDemoDatasetSeed.js');

try {
  const connected = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = connected[0]?.name;
  if (name !== 'peaceone_test') {
    throw new Error(`Refusing presentation demo dataset seed: current_database() is "${name}".`);
  }
  if (presentationName === 'peaceone_test') {
    throw new Error('Refusing presentation demo dataset seed: presentation DATABASE_URL already pointed at the test database.');
  }

  console.log(`Seeding expanded PeaceOne demonstration dataset into 127.0.0.1/${name} (presentation remains ${presentationName}).`);
  const result = await seedPresentationDemoDataset(prisma);
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
  if (result.conflicts.length) {
    console.log('\nConflicts');
    for (const item of result.conflicts.slice(0, 30)) {
      console.log(`  - ${item}`);
    }
    if (result.conflicts.length > 30) {
      console.log(`  … ${result.conflicts.length - 30} more`);
    }
  }
  console.log('\nPresentation peaceone was not written.');
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
