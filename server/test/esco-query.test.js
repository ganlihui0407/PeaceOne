import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeLabelSearch,
  skillListWhere,
  taxonomyCatalogueSearchOr,
  uriSearchVariants,
} from '../src/lib/escoQuery.js';

test('normalizeLabelSearch trims and strips LIKE wildcards', () => {
  assert.equal(normalizeLabelSearch('  PYTHON  '), 'PYTHON');
  assert.equal(normalizeLabelSearch('%OR 1=1'), 'OR 1=1');
  assert.equal(normalizeLabelSearch('   '), null);
  assert.equal(normalizeLabelSearch(''), null);
});

test('uriSearchVariants keep both http and https forms', () => {
  assert.deepEqual(
    uriSearchVariants('https://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d').sort(),
    [
      'http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d',
      'https://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d',
    ],
  );
});

test('skillListWhere searches label, altLabels JSON, URI and UUID', () => {
  const where = skillListWhere({ q: 'ccd0a1d9' });
  assert.equal(where.sourceSystem, 'ESCO');
  assert.equal(Array.isArray(where.OR), true);
  assert.equal(where.OR.some((item) => item.preferredLabel?.contains === 'ccd0a1d9'), true);
  assert.equal(where.OR.some((item) => item.sourceUri?.contains === 'ccd0a1d9'), true);
  assert.equal(where.OR.some((item) => item.sourceMetadata?.path?.[0] === 'altLabels'), true);

  const byId = skillListWhere({ q: '22222222-2222-4222-8222-222222222222' });
  assert.equal(byId.OR.some((item) => item.id === '22222222-2222-4222-8222-222222222222'), true);

  const empty = skillListWhere({ q: '   ' });
  assert.equal(empty.OR, undefined);
});

test('taxonomyCatalogueSearchOr does not invent extra fields', () => {
  const or = taxonomyCatalogueSearchOr('Python');
  assert.equal(or.every((item) => (
    item.preferredLabel
    || item.sourceUri
    || item.sourceMetadata
    || item.id
  )), true);
});
