import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage-m5a-crosswalk-';
const EXPECTED = {
  unitGroups: 492,
  occupations: 1967,
  crosswalks: 41,
  escoOccupations: 3039,
  escoSkills: 13939,
  escoRelations: 126051,
};
const HISTORICAL_CODE = '1219-01';
const CURRENT_CODE = '1324-06';
const EMPTY_OCCUPATION_CODE = '0111-01';
const VERIFIED_STATUS = 'VISUALLY_VERIFIED_FROM_SOURCE_ROW_CONTACT_SHEET';
const createdEmails = [];

let server;
let baseUrl;
let fingerprint;
let baseline;
let knownCrosswalk;

async function snapshot() {
  const [unitGroups, occupations, crosswalks, escoOccupations, escoSkills, escoRelations, rows] = await Promise.all([
    prisma.mascoUnitGroup.count(),
    prisma.mascoOccupationRecord.count(),
    prisma.mascoHistoricalCrosswalk.count(),
    prisma.occupation.count(),
    prisma.skill.count(),
    prisma.occupationSkillRelation.count(),
    prisma.mascoHistoricalCrosswalk.findMany({
      select: {
        id: true,
        historicalCode: true,
        currentCode: true,
        mappingStatus: true,
        reviewDecision: true,
        updatedAt: true,
      },
      orderBy: [{ historicalCode: 'asc' }, { currentCode: 'asc' }],
    }),
  ]);

  return {
    unitGroups,
    occupations,
    crosswalks,
    escoOccupations,
    escoSkills,
    escoRelations,
    rows,
  };
}

async function createAdmin() {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'admin');
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'MASCO M5A Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/login', primed, {
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(result.response.status, 200, result.text);
  return result;
}

async function registerAs(label, body = {}) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/register', primed, validRegisterBody(email, body));
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

function getAs(path, cookies) {
  return requestJson(baseUrl, path, { cookies });
}

before(async () => {
  baseline = await snapshot();
  fingerprint = JSON.stringify(baseline.rows);
  assert.equal(baseline.unitGroups, EXPECTED.unitGroups);
  assert.equal(baseline.occupations, EXPECTED.occupations);
  assert.equal(baseline.crosswalks, EXPECTED.crosswalks);
  assert.equal(baseline.escoOccupations, EXPECTED.escoOccupations);
  assert.equal(baseline.escoSkills, EXPECTED.escoSkills);
  assert.equal(baseline.escoRelations, EXPECTED.escoRelations);
  assert.equal(baseline.rows.length, EXPECTED.crosswalks);

  knownCrosswalk = await prisma.mascoHistoricalCrosswalk.findFirst({
    where: {
      historicalCode: HISTORICAL_CODE,
      currentCode: CURRENT_CODE,
      sourceVersion: '2013',
      targetVersion: '2020',
    },
    select: {
      sourceVersion: true,
      targetVersion: true,
      historicalCode: true,
      currentCode: true,
      mappingStatus: true,
      reviewDecision: true,
      sourceMetadata: true,
    },
  });
  assert.ok(knownCrosswalk, 'expected imported 1219-01 to 1324-06 crosswalk');

  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
  } finally {
    const afterSnapshot = await snapshot();
    assert.equal(afterSnapshot.unitGroups, EXPECTED.unitGroups);
    assert.equal(afterSnapshot.occupations, EXPECTED.occupations);
    assert.equal(afterSnapshot.crosswalks, EXPECTED.crosswalks);
    assert.equal(afterSnapshot.escoOccupations, EXPECTED.escoOccupations);
    assert.equal(afterSnapshot.escoSkills, EXPECTED.escoSkills);
    assert.equal(afterSnapshot.escoRelations, EXPECTED.escoRelations);
    assert.equal(JSON.stringify(afterSnapshot.rows), fingerprint);

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }

    await Promise.all([
      prisma.$disconnect(),
      closeSessionStore(),
    ]);
  }
});

test('unauthenticated crosswalk requests are rejected', async () => {
  const listed = await getAs('/api/masco/crosswalks');
  assert.equal(listed.response.status, 401);
  assert.equal(listed.json.error, 'Unauthenticated');

  const nested = await getAs(`/api/masco/occupations/${CURRENT_CODE}/crosswalks`);
  assert.equal(nested.response.status, 401);
  assert.equal(nested.json.error, 'Unauthenticated');
  assertNoSecrets(listed.json);
  assertNoSecrets(nested.json);
});

test('non-admin users cannot read crosswalks', async () => {
  const student = await registerAs('student', { currentPosition: 'student' });
  const staff = await registerAs('staff', { role: 'employer', currentPosition: undefined });

  const studentList = await getAs('/api/masco/crosswalks', student.cookies);
  assert.equal(studentList.response.status, 403);
  assert.equal(studentList.json.error, 'Forbidden');

  const staffNested = await getAs(`/api/masco/occupations/${CURRENT_CODE}/crosswalks`, staff.cookies);
  assert.equal(staffNested.response.status, 403);
  assert.equal(staffNested.json.error, 'Forbidden');
  assertNoSecrets(studentList.json);
  assertNoSecrets(staffNested.json);
});

test('admin can list all 41 historical crosswalks with pagination', async () => {
  const admin = await createAdmin();
  const listed = await getAs('/api/masco/crosswalks?limit=10', admin.cookies);

  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.page, 1);
  assert.equal(listed.json.limit, 10);
  assert.equal(listed.json.total, EXPECTED.crosswalks);
  assert.equal(listed.json.totalPages, 5);
  assert.equal(listed.json.items.length, 10);
  assert.equal(listed.json.items[0].historicalCode, HISTORICAL_CODE);
  assert.equal(listed.json.items[0].currentCode, CURRENT_CODE);
  assert.equal(listed.json.items[0].sourceVersion, '2013');
  assert.equal(listed.json.items[0].targetVersion, '2020');
  assert.equal(listed.json.items[0].mappingStatus, knownCrosswalk.mappingStatus);
  assert.equal(listed.json.items[0].reviewDecision, knownCrosswalk.reviewDecision);
  assert.deepEqual(listed.json.items[0].sourceMetadata, knownCrosswalk.sourceMetadata);
  assertNoSecrets(listed.json);

  const lastPage = await getAs('/api/masco/crosswalks?page=5&limit=10', admin.cookies);
  assert.equal(lastPage.response.status, 200);
  assert.equal(lastPage.json.page, 5);
  assert.equal(lastPage.json.items.length, 1);
  assert.equal(lastPage.json.total, EXPECTED.crosswalks);
});

test('admin can search by historical code, current code and mapping status', async () => {
  const admin = await createAdmin();

  const historical = await getAs(
    `/api/masco/crosswalks?historicalCode=${HISTORICAL_CODE}`,
    admin.cookies,
  );
  assert.equal(historical.response.status, 200);
  assert.equal(historical.json.total, 1);
  assert.equal(historical.json.items[0].historicalCode, HISTORICAL_CODE);
  assert.equal(historical.json.items[0].currentCode, CURRENT_CODE);

  const current = await getAs(
    `/api/masco/crosswalks?currentCode=${CURRENT_CODE}`,
    admin.cookies,
  );
  assert.equal(current.response.status, 200);
  assert.equal(current.json.total, 1);
  assert.equal(current.json.items[0].currentCode, CURRENT_CODE);

  const query = await getAs('/api/masco/crosswalks?q=1219-01', admin.cookies);
  assert.equal(query.response.status, 200);
  assert.ok(query.json.items.some((item) => item.historicalCode === HISTORICAL_CODE));

  const status = await getAs(
    `/api/masco/crosswalks?mappingStatus=${VERIFIED_STATUS}`,
    admin.cookies,
  );
  assert.equal(status.response.status, 200);
  assert.equal(status.json.total, 37);
  assert.equal(
    status.json.items.every((item) => item.mappingStatus === VERIFIED_STATUS),
    true,
  );
  assertNoSecrets(status.json);
});

test('occupation crosswalks return existing mappings and 404 for unknown codes', async () => {
  const admin = await createAdmin();

  const mapped = await getAs(
    `/api/masco/occupations/${CURRENT_CODE}/crosswalks`,
    admin.cookies,
  );
  assert.equal(mapped.response.status, 200);
  assert.equal(mapped.json.occupation.code, CURRENT_CODE);
  assert.equal(mapped.json.items.length, 1);
  assert.equal(mapped.json.items[0].historicalCode, HISTORICAL_CODE);
  assert.equal(mapped.json.items[0].currentCode, CURRENT_CODE);
  assertNoSecrets(mapped.json);

  const empty = await getAs(
    `/api/masco/occupations/${EMPTY_OCCUPATION_CODE}/crosswalks`,
    admin.cookies,
  );
  assert.equal(empty.response.status, 200);
  assert.equal(empty.json.occupation.code, EMPTY_OCCUPATION_CODE);
  assert.equal(empty.json.items.length, 0);

  const missing = await getAs('/api/masco/occupations/9999-99/crosswalks', admin.cookies);
  assert.equal(missing.response.status, 404);
  assert.equal(missing.json.error, 'Not found');
  assertNoSecrets(missing.json);
});

test('invalid crosswalk query parameters and occupation codes are rejected', async () => {
  const admin = await createAdmin();
  const paths = [
    '/api/masco/crosswalks?page=0',
    '/api/masco/crosswalks?limit=51',
    '/api/masco/crosswalks?historicalCode=invalid',
    '/api/masco/crosswalks?currentCode=2411',
    '/api/masco/crosswalks?mappingStatus=not-a-status',
    '/api/masco/occupations/not-a-code/crosswalks',
  ];

  for (const path of paths) {
    const result = await getAs(path, admin.cookies);
    assert.equal(result.response.status, 400, path);
    assert.equal(result.json.error, 'Invalid request');
    assertNoSecrets(result.json);
  }
});

test('public MASCO occupation endpoints stay available without admin auth', async () => {
  const listed = await getAs('/api/masco/occupations?limit=1');
  assert.equal(listed.response.status, 200);
  assert.ok(listed.json.total >= EXPECTED.occupations);

  const detail = await getAs(`/api/masco/occupations/${CURRENT_CODE}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.occupation.code, CURRENT_CODE);
  assert.equal(Object.hasOwn(detail.json, 'items'), false);
  assertNoSecrets(detail.json);
});

test('listed crosswalks match the existing database records and do not invent mappings', async () => {
  const admin = await createAdmin();
  const listed = await getAs('/api/masco/crosswalks?limit=50', admin.cookies);
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.total, EXPECTED.crosswalks);
  assert.equal(listed.json.items.length, EXPECTED.crosswalks);

  const dbRows = await prisma.mascoHistoricalCrosswalk.findMany({
    select: {
      historicalCode: true,
      currentCode: true,
      mappingStatus: true,
      reviewDecision: true,
    },
    orderBy: [{ historicalCode: 'asc' }, { currentCode: 'asc' }],
  });

  assert.deepEqual(
    listed.json.items.map((item) => ({
      historicalCode: item.historicalCode,
      currentCode: item.currentCode,
      mappingStatus: item.mappingStatus,
      reviewDecision: item.reviewDecision,
    })),
    dbRows,
  );
  assert.equal(
    listed.json.items.every((item) => item.sourceVersion === '2013' && item.targetVersion === '2020'),
    true,
  );
});
