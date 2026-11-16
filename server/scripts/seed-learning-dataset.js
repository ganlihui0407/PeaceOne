import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTestDatabaseIsolationFromEnv } from '../src/lib/testDatabaseGuard.js';
import { parseDatabaseTarget } from '../src/lib/databaseTarget.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

if (!process.env.TEST_DATABASE_URL) {
  console.error('Refusing learning dataset seed: TEST_DATABASE_URL is not set.');
  process.exit(1);
}

const presentationName = parseDatabaseTarget(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL).databaseName;
applyTestDatabaseIsolationFromEnv(process.env);

if (parseDatabaseTarget(process.env.DATABASE_URL).databaseName !== 'peaceone_test') {
  console.error('Refusing learning dataset seed: process DATABASE_URL is not peaceone_test.');
  process.exit(1);
}

const { prisma, disconnectDatabase } = await import('../src/db.js');
const { seedLearningDataset } = await import('../src/lib/learningDatasetSeed.js');

try {
  const connected = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = connected[0]?.name;
  if (name !== 'peaceone_test') {
    throw new Error(`Refusing learning dataset seed: current_database() is "${name}".`);
  }
  if (presentationName === 'peaceone_test') {
    throw new Error('Refusing learning dataset seed: presentation DATABASE_URL already pointed at the test database.');
  }

  console.log(`Seeding PeaceOne learning dataset into 127.0.0.1/${name} (presentation remains ${presentationName}).`);
  const result = await seedLearningDataset(prisma);
  console.log('\nSeed counts');
  for (const [key, value] of Object.entries(result.counts)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nTotals');
  for (const [key, value] of Object.entries(result.totals)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log(`\nESCO mappings: ${result.mappings.length}`);
  console.log('Student progress rows were not deleted. Presentation peaceone was not written.');
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
