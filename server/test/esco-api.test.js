import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { LIMIT_MAX } from '../src/lib/escoQuery.js';
import { assertNoSecrets } from './helpers.js';

const ICT_SAFETY_URI = 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2';
const FOOD_SERVICE_URI = 'http://data.europa.eu/esco/occupation/b4bff870-5c8f-4c33-b07f-f04d79830633';

let server;
let baseUrl;
let counts;

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

before(async () => {
  counts = {
    occupations: await prisma.occupation.count(),
    skills: await prisma.skill.count(),
    relations: await prisma.occupationSkillRelation.count(),
  };
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  assert.equal(await prisma.occupation.count(), counts.occupations);
  assert.equal(await prisma.skill.count(), counts.skills);
  assert.equal(await prisma.occupationSkillRelation.count(), counts.relations);
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('lists occupations with validated pagination metadata', async () => {
  const { response, json } = await getJson('/api/occupations');
  assert.equal(response.status, 200);
  assert.equal(json.page, 1);
  assert.equal(json.limit, 20);
  assert.equal(json.total, 3039);
  assert.equal(json.totalPages, 152);
  assert.equal(json.items.length, 20);
  assert.ok(json.items.length < json.total);
  const labels = json.items.map((item) => item.preferredLabel);
  const sorted = [...labels].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(labels, sorted);
  assertNoSecrets(json);
  assert.equal(json.items.every((item) => item.sourceSystem === 'ESCO'), true);
});

test('searches occupations by label and supports ISCO group filter', async () => {
  const search = await getJson('/api/occupations?q=food%20service%20worker');
  assert.equal(search.response.status, 200);
  assert.ok(search.json.total >= 1);
  assert.ok(search.json.items.some((item) => item.preferredLabel === 'food service worker'));

  const empty = await getJson('/api/occupations?q=zzzz-no-such-occupation-label');
  assert.equal(empty.response.status, 200);
  assert.equal(empty.json.total, 0);
  assert.deepEqual(empty.json.items, []);
  assert.equal(empty.json.totalPages, 0);

  const sample = await prisma.occupation.findFirst({
    where: { sourceUri: FOOD_SERVICE_URI },
    select: { sourceMetadata: true },
  });
  const iscoGroup = sample.sourceMetadata?.iscoGroup;
  assert.equal(typeof iscoGroup, 'string');
  const filtered = await getJson(`/api/occupations?iscoGroup=${encodeURIComponent(iscoGroup)}`);
  assert.equal(filtered.response.status, 200);
  assert.ok(filtered.json.total >= 1);
  assert.equal(filtered.json.items.every((item) => item.iscoGroup === iscoGroup), true);
});

test('rejects invalid occupation list parameters', async () => {
  const cases = [
    '/api/occupations?page=0',
    '/api/occupations?page=-1',
    '/api/occupations?page=abc',
    `/api/occupations?limit=${LIMIT_MAX + 1}`,
    '/api/occupations?limit=0',
    '/api/occupations?iscoGroup=not-a-code',
  ];
  for (const path of cases) {
    const { response, json } = await getJson(path);
    assert.equal(response.status, 400, path);
    assert.equal(json.error, 'Invalid request');
    assertNoSecrets(json);
  }
});

test('returns an occupation by UUID and by source URI', async () => {
  const stored = await prisma.occupation.findFirst({
    where: { sourceUri: FOOD_SERVICE_URI },
    select: { id: true, sourceUri: true, preferredLabel: true },
  });
  assert.ok(stored);

  const byId = await getJson(`/api/occupations/${stored.id}`);
  assert.equal(byId.response.status, 200);
  assert.equal(byId.json.occupation.id, stored.id);
  assert.equal(byId.json.occupation.sourceUri, FOOD_SERVICE_URI);
  assert.equal(byId.json.occupation.preferredLabel, 'food service worker');
  assert.ok(Object.hasOwn(byId.json.occupation, 'description'));
  assertNoSecrets(byId.json);

  const byUri = await getJson(`/api/occupations/by-uri?uri=${encodeURIComponent(FOOD_SERVICE_URI)}`);
  assert.equal(byUri.response.status, 200);
  assert.equal(byUri.json.occupation.id, stored.id);
  assert.equal(byUri.json.occupation.sourceUri, FOOD_SERVICE_URI);
});

test('returns 404 for missing occupation IDs and 400 for invalid IDs', async () => {
  const missing = await getJson('/api/occupations/00000000-0000-4000-8000-000000000000');
  assert.equal(missing.response.status, 404);
  assert.equal(missing.json.error, 'Not found');
  assertNoSecrets(missing.json);

  const invalid = await getJson('/api/occupations/not-a-uuid');
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.json.error, 'Invalid request');

  const missingUri = await getJson('/api/occupations/by-uri?uri=http://example.test/missing');
  assert.equal(missingUri.response.status, 404);

  const badUri = await getJson('/api/occupations/by-uri?uri=not-a-uri');
  assert.equal(badUri.response.status, 400);
});

test('pages occupation skills and filters by relationType while preserving null skillType', async () => {
  const occupation = await prisma.occupation.findFirst({
    where: {
      skillRelations: {
        some: {
          skill: { sourceUri: ICT_SAFETY_URI },
        },
      },
    },
    select: { id: true },
    orderBy: { preferredLabel: 'asc' },
  });
  assert.ok(occupation);

  const listed = await getJson(`/api/occupations/${occupation.id}/skills?limit=5`);
  assert.equal(listed.response.status, 200);
  assert.ok(listed.json.total >= 1);
  assert.ok(listed.json.items.length <= 5);
  assert.equal(listed.json.limit, 5);
  assert.ok(listed.json.items.every((item) => item.relationType === 'essential' || item.relationType === 'optional'));
  assert.ok(listed.json.items.every((item) => typeof item.skill.preferredLabel === 'string'));
  assertNoSecrets(listed.json);

  const essential = await getJson(`/api/occupations/${occupation.id}/skills?relationType=essential`);
  assert.equal(essential.response.status, 200);
  assert.equal(essential.json.items.every((item) => item.relationType === 'essential'), true);

  const optional = await getJson(`/api/occupations/${occupation.id}/skills?relationType=optional`);
  assert.equal(optional.response.status, 200);
  assert.equal(optional.json.items.every((item) => item.relationType === 'optional'), true);

  const ict = listed.json.items.find((item) => item.skill.sourceUri === ICT_SAFETY_URI)
    ?? essential.json.items.find((item) => item.skill.sourceUri === ICT_SAFETY_URI)
    ?? optional.json.items.find((item) => item.skill.sourceUri === ICT_SAFETY_URI);
  if (!ict) {
    const targeted = await getJson(`/api/occupations/${occupation.id}/skills?limit=50`);
    const found = targeted.json.items.find((item) => item.skill.sourceUri === ICT_SAFETY_URI);
    assert.ok(found);
    assert.equal(found.skill.skillType, null);
  } else {
    assert.equal(ict.skill.skillType, null);
  }

  const invalidRelation = await getJson(`/api/occupations/${occupation.id}/skills?relationType=related`);
  assert.equal(invalidRelation.response.status, 400);

  const missingOccupationSkills = await getJson(
    '/api/occupations/00000000-0000-4000-8000-000000000000/skills',
  );
  assert.equal(missingOccupationSkills.response.status, 404);
});

test('lists skills with label search, skillType filter and pagination', async () => {
  const listed = await getJson('/api/skills');
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.page, 1);
  assert.equal(listed.json.limit, 20);
  assert.equal(listed.json.total, 13939);
  assert.equal(listed.json.items.length, 20);
  assert.ok(listed.json.items.length < listed.json.total);
  assertNoSecrets(listed.json);

  const search = await getJson('/api/skills?q=ICT%20safety');
  assert.equal(search.response.status, 200);
  assert.ok(search.json.items.some((item) => item.preferredLabel === 'ICT safety'));

  const knowledge = await getJson('/api/skills?skillType=knowledge');
  assert.equal(knowledge.response.status, 200);
  assert.ok(knowledge.json.total >= 1);
  assert.equal(knowledge.json.items.every((item) => item.skillType === 'knowledge'), true);

  const nullTypes = await getJson('/api/skills?skillType=null');
  assert.equal(nullTypes.response.status, 200);
  assert.equal(nullTypes.json.total, 5);
  assert.equal(nullTypes.json.items.every((item) => item.skillType === null), true);
  assert.ok(nullTypes.json.items.some((item) => item.sourceUri === ICT_SAFETY_URI));

  const empty = await getJson('/api/skills?q=zzzz-no-such-skill-label');
  assert.equal(empty.response.status, 200);
  assert.equal(empty.json.total, 0);
  assert.deepEqual(empty.json.items, []);

  const invalid = await getJson('/api/skills?page=0');
  assert.equal(invalid.response.status, 400);

  const page1 = await getJson('/api/skills?page=1&limit=10');
  const page2 = await getJson('/api/skills?page=2&limit=10');
  assert.equal(page1.json.items[0].id !== page2.json.items[0].id, true);
});
