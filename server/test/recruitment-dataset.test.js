import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import {
  DATASET_APPLICATIONS,
  DATASET_CANDIDATE_EMAILS,
  DATASET_CANDIDATES,
  DATASET_COMPANIES,
  DATASET_JOBS,
  PROTECTED_DEMO_EMAILS,
} from '../src/lib/recruitmentDatasetCatalog.js';
import {
  collectRecruitmentIntegrity,
  seedRecruitmentDataset,
} from '../src/lib/recruitmentDatasetSeed.js';

let firstSeed;
let secondSeed;

before(async () => {
  const connected = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  assert.equal(connected[0].name, 'peaceone_test');
  firstSeed = await seedRecruitmentDataset(prisma);
  secondSeed = await seedRecruitmentDataset(prisma);
});

after(async () => {
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('catalogue targets five companies, ten jobs, fifteen candidates and twenty-five unique applications', () => {
  assert.equal(DATASET_COMPANIES.length, 5);
  assert.equal(DATASET_JOBS.length, 10);
  assert.equal(DATASET_CANDIDATES.length, 15);
  assert.equal(DATASET_APPLICATIONS.length, 25);
  assert.ok(DATASET_CANDIDATE_EMAILS.includes('student@peaceone.demo'));
  assert.ok(DATASET_CANDIDATE_EMAILS.includes('graduate@peaceone.demo'));
  const pairs = DATASET_APPLICATIONS.map((item) => `${item.candidateEmail}::${item.companyKey}::${item.jobTitle}`);
  assert.equal(new Set(pairs).size, pairs.length);
  const regs = DATASET_COMPANIES.map((item) => item.registrationNumber);
  assert.equal(new Set(regs).size, regs.length);
  const emails = [
    ...PROTECTED_DEMO_EMAILS,
    ...DATASET_COMPANIES.flatMap((company) => company.staff.map((staff) => staff.email)),
    ...DATASET_CANDIDATES.filter((item) => !PROTECTED_DEMO_EMAILS.includes(item.email)).map((item) => item.email),
  ];
  assert.equal(new Set(emails).size, emails.length);
});

test('seed writes the isolated recruitment totals without inventing ESCO skills', async () => {
  assert.equal(firstSeed.integrity.database, 'peaceone_test');
  assert.equal(firstSeed.integrity.totals.companies, 5);
  assert.equal(firstSeed.integrity.totals.jobs, 10);
  assert.equal(firstSeed.integrity.totals.candidates, 15);
  assert.equal(firstSeed.integrity.totals.applications, 25);
  assert.equal(firstSeed.integrity.totals.snapshots, 25);
  assert.ok(firstSeed.integrity.totals.interviews >= 5);
  assert.ok(firstSeed.mappings.length >= 10);
  assert.equal(firstSeed.integrity.duplicates.applications, 0);
  assert.equal(firstSeed.integrity.duplicates.emails, 0);
  assert.equal(firstSeed.integrity.duplicates.registrations, 0);
  assert.equal(firstSeed.integrity.orphans.jobSkills, 0);
  assert.equal(firstSeed.integrity.orphans.missingSnapshots, 0);
  assert.equal(firstSeed.integrity.orphans.interviewMismatches, 0);
  assert.equal(firstSeed.integrity.orphans.notificationCross, 0);

  const statuses = firstSeed.integrity.statuses;
  for (const required of ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED']) {
    assert.ok((statuses[required] ?? 0) >= 1, `missing status ${required}`);
  }
});

test('second seed is idempotent and does not overwrite protected demo accounts', async () => {
  assert.equal(secondSeed.counts.usersCreated, 0);
  assert.equal(secondSeed.counts.companiesCreated, 0);
  assert.equal(secondSeed.counts.jobsCreated, 0);
  assert.equal(secondSeed.counts.applicationsCreated, 0);
  assert.equal(secondSeed.counts.interviewsCreated, 0);
  assert.equal(secondSeed.counts.resumesCreated, 0);
  assert.equal(secondSeed.integrity.totals.applications, 25);

  const names = Object.fromEntries(
    (await prisma.user.findMany({
      where: { email: { in: ['student@peaceone.demo', 'graduate@peaceone.demo'] } },
      select: { email: true, fullName: true },
    })).map((row) => [row.email, row.fullName]),
  );
  assert.equal(names['student@peaceone.demo'], 'Aisyah Rahman');
  assert.equal(names['graduate@peaceone.demo'], 'Tan Wei Jie');

  const integrity = await collectRecruitmentIntegrity(prisma);
  assert.equal(integrity.totals.companies, 5);
  assert.equal(integrity.protectedUsers.length, 5);
});
