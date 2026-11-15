import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { assertNoSecrets } from './helpers.js';

let server;
let baseUrl;
let unitGroup;
let records = [];

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, json, text };
}

async function createFixtures() {
  for (let code = 1000; code <= 9999; code++) {
    const existing = await prisma.mascoUnitGroup.findFirst({
      where: {
        classification: 'MASCO',
        version: '2020',
        code: String(code),
      },
      select: { id: true },
    });

    if (!existing) {
      unitGroup = await prisma.mascoUnitGroup.create({
        data: {
          classification: 'MASCO',
          version: '2020',
          code: String(code),
          title: 'PeaceOne Automated Test Group',
          description: 'Temporary API regression test fixture',
          tasks: 'Temporary test tasks',
          sourceMetadata: { testFixture: true },
        },
      });
      break;
    }
  }

  if (!unitGroup) {
    throw new Error('Could not allocate a MASCO test unit group');
  }

  for (const [suffix, title, scope] of [
    ['01', 'PeaceOne Test Accountant', 'V4_EXAMPLE'],
    ['02', 'PeaceOne Test Engineer', 'SUPPLEMENTAL_INDEX'],
  ]) {
    const record = await prisma.mascoOccupationRecord.create({
      data: {
        classification: 'MASCO',
        version: '2020',
        code: `${unitGroup.code}-${suffix}`,
        title,
        recordScope: scope,
        unitGroupId: unitGroup.id,
        sourceMetadata: { testFixture: true },
      },
    });

    records.push(record);
  }
}

async function cleanupFixtures() {
  if (unitGroup) {
    await prisma.mascoOccupationRecord.deleteMany({
      where: { unitGroupId: unitGroup.id },
    });

    await prisma.mascoUnitGroup.deleteMany({
      where: { id: unitGroup.id },
    });
  }
}

before(async () => {
  await createFixtures();

  server = createApp().listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => err ? reject(err) : resolve());
      });
    }
  } finally {
    try {
      await cleanupFixtures();
    } finally {
      await Promise.all([
        prisma.$disconnect(),
        closeSessionStore(),
      ]);
    }
  }
});

test('lists MASCO occupations with pagination', async () => {
  const { response, json } = await getJson(
    '/api/masco/occupations?limit=1'
  );

  assert.equal(response.status, 200);
  assert.equal(json.page, 1);
  assert.equal(json.limit, 1);
  assert.ok(json.total >= 2);
  assert.equal(json.items.length, 1);
  assert.ok(json.totalPages >= 2);
  assertNoSecrets(json);
});

test('searches MASCO occupations by title', async () => {
  const { response, json } = await getJson(
    '/api/masco/occupations?q=PeaceOne%20Test%20Accountant'
  );

  assert.equal(response.status, 200);
  assert.ok(json.items.some(
    item => item.code === records[0].code
  ));
});

test('searches MASCO occupations by code', async () => {
  const { response, json } = await getJson(
    `/api/masco/occupations?q=${records[0].code}`
  );

  assert.equal(response.status, 200);
  assert.ok(json.items.some(
    item => item.code === records[0].code
  ));
});

test('filters MASCO occupations by unit group', async () => {
  const { response, json } = await getJson(
    `/api/masco/occupations?unitGroup=${unitGroup.code}`
  );

  assert.equal(response.status, 200);
  assert.equal(json.total, 2);
  assert.equal(
    json.items.every(item => item.unitGroup.code === unitGroup.code),
    true
  );
});

test('filters supplemental occupations', async () => {
  const { response, json } = await getJson(
    '/api/masco/occupations?scope=SUPPLEMENTAL_INDEX'
  );

  assert.equal(response.status, 200);
  assert.ok(json.items.some(
    item => item.code === records[1].code
  ));
  assert.equal(
    json.items.every(item => item.recordScope === 'SUPPLEMENTAL_INDEX'),
    true
  );
});

test('filters V4 occupations', async () => {
  const { response, json } = await getJson(
    `/api/masco/occupations?scope=V4_EXAMPLE&q=PeaceOne%20Test%20Accountant`
  );

  assert.equal(response.status, 200);
  assert.ok(json.items.some(
    item => item.code === records[0].code
  ));
  assert.equal(
    json.items.every(item => item.recordScope === 'V4_EXAMPLE'),
    true
  );
});

test('returns an individual MASCO occupation with source metadata', async () => {
  const { response, json } = await getJson(
    `/api/masco/occupations/${records[0].code}`
  );

  assert.equal(response.status, 200);
  assert.equal(json.occupation.code, records[0].code);
  assert.equal(json.occupation.title, records[0].title);
  assert.equal(json.occupation.unitGroup.code, unitGroup.code);
  assert.equal(json.occupation.unitGroup.description, unitGroup.description);
  assert.equal(json.occupation.sourceMetadata.testFixture, true);
  assertNoSecrets(json);
});

test('rejects invalid MASCO query parameters', async () => {
  const paths = [
    '/api/masco/occupations?page=0',
    '/api/masco/occupations?limit=51',
    '/api/masco/occupations?unitGroup=invalid',
    '/api/masco/occupations?scope=INVALID',
  ];

  for (const path of paths) {
    const { response, json } = await getJson(path);
    assert.equal(response.status, 400, path);
    assert.equal(json.error, 'Invalid request');
    assertNoSecrets(json);
  }
});

test('rejects invalid MASCO occupation codes', async () => {
  const { response, json } = await getJson(
    '/api/masco/occupations/not-a-code'
  );

  assert.equal(response.status, 400);
  assert.equal(json.error, 'Invalid request');
});

test('returns 404 for unknown valid MASCO occupation codes', async () => {
  const { response, json } = await getJson(
    '/api/masco/occupations/9999-99'
  );

  assert.equal(response.status, 404);
  assert.equal(json.error, 'Not found');
});