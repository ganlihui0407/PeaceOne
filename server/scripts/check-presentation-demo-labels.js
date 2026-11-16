import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTestDatabaseIsolationFromEnv } from '../src/lib/testDatabaseGuard.js';
import { parseDatabaseTarget } from '../src/lib/databaseTarget.js';
import {
  JOB_SKILL_SETS,
  PRESENTATION_CANDIDATES,
  PRESENTATION_COURSES,
  TRACKS,
} from '../src/lib/presentationDemoDatasetCatalog.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });
applyTestDatabaseIsolationFromEnv(process.env);

const { prisma, disconnectDatabase } = await import('../src/db.js');

try {
  const connected = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = connected[0]?.name;
  if (name !== 'peaceone_test') {
    throw new Error(`current_database() is "${name}"`);
  }
  const labels = new Set();
  for (const set of JOB_SKILL_SETS) {
    for (const label of set) labels.add(label);
  }
  for (const track of TRACKS) {
    for (const entry of track.skillLabels) {
      for (const label of entry.labels) labels.add(label);
    }
  }
  for (const course of PRESENTATION_COURSES) {
    for (const label of course.skillLabels) labels.add(label);
  }
  const missing = [];
  const found = [];
  for (const label of [...labels].sort()) {
    const skill = await prisma.skill.findFirst({
      where: { sourceSystem: 'ESCO', preferredLabel: { equals: label, mode: 'insensitive' } },
      select: { id: true, preferredLabel: true },
    });
    if (skill) {
      found.push(`${skill.preferredLabel} ${skill.id}`);
    } else {
      missing.push(label);
    }
  }
  const occupations = new Set(PRESENTATION_CANDIDATES.flatMap((item) => item.occupationLabels));
  const missingOcc = [];
  for (const label of occupations) {
    const occupation = await prisma.occupation.findFirst({
      where: { sourceSystem: 'ESCO', preferredLabel: { equals: label, mode: 'insensitive' } },
      select: { preferredLabel: true },
    });
    if (!occupation) missingOcc.push(label);
  }
  console.log(JSON.stringify({ database: name, found: found.length, missing, missingOcc }, null, 2));
  if (missing.length) process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
