import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OCCUPATION_HEADERS,
  SKILL_HEADERS,
} from '../src/lib/esco/constants.js';
import { parseEscoCsv } from '../src/lib/esco/csv.js';
import { EscoImportError } from '../src/lib/esco/errors.js';
import { prepareOccupations, prepareRelations, prepareSkills } from '../src/lib/esco/prepare.js';
import { csvTable, occupationFields, relationFields, skillFields } from './escoFixtures.js';

function parseOccupations(rows) {
  const csv = csvTable(OCCUPATION_HEADERS, rows);
  return parseEscoCsv(Buffer.from(csv), OCCUPATION_HEADERS, 'occupations_en.csv');
}

function parseSkills(rows) {
  const csv = csvTable(SKILL_HEADERS, rows);
  return parseEscoCsv(Buffer.from(csv), SKILL_HEADERS, 'skills_en.csv');
}

test('parses quoted commas, escaped quotes and quoted newlines', () => {
  const csv = [
    OCCUPATION_HEADERS.join(','),
    [
      'Occupation',
      '"http://data.europa.eu/esco/occupation/quoted"',
      '2354',
      '"teacher, assistant"',
      '"alias ""quoted"""',
      '',
      'released',
      '2025-07-31T09:38:59.122Z',
      '',
      '',
      '',
      '',
      '"line1\nline2"',
      '2354.1',
      '',
    ].join(','),
    '',
  ].join('\r\n');
  const parsed = parseEscoCsv(Buffer.from(csv), OCCUPATION_HEADERS, 'occupations_en.csv');
  assert.equal(parsed.encoding, 'utf-8');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].rowNumber, 2);
  assert.equal(parsed.rows[0].fields.preferredLabel, 'teacher, assistant');
  assert.equal(parsed.rows[0].fields.altLabels, 'alias "quoted"');
  assert.equal(parsed.rows[0].fields.description, 'line1\nline2');
});

test('accepts UTF-8 BOM and rejects invalid encoding and headers', () => {
  const body = csvTable(OCCUPATION_HEADERS, [occupationFields()]);
  const bom = parseEscoCsv(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(body)]), OCCUPATION_HEADERS, 'occupations_en.csv');
  assert.equal(bom.encoding, 'utf-8-bom');
  assert.equal(bom.rows.length, 1);

  assert.throws(
    () => parseEscoCsv(Buffer.from([0xc3, 0x28]), OCCUPATION_HEADERS, 'occupations_en.csv'),
    (error) => error instanceof EscoImportError && error.code === 'INVALID_ENCODING',
  );

  const wrongHeader = `notAHeader\r\nvalue\r\n`;
  assert.throws(
    () => parseEscoCsv(Buffer.from(wrongHeader), OCCUPATION_HEADERS, 'occupations_en.csv'),
    (error) => error instanceof EscoImportError && error.code === 'HEADER_MISMATCH',
  );
});

test('keeps the later valid modifiedDate and reports collapsed duplicates', () => {
  const parsed = parseOccupations([
    occupationFields({
      preferredLabel: 'early years teaching assistant',
      modifiedDate: '2025-07-31T09:38:59.122Z',
    }),
    occupationFields({
      preferredLabel: 'early years teaching assistant',
      modifiedDate: '2025-11-26T10:02:16.164Z',
    }),
  ]);
  const prepared = prepareOccupations(parsed.rows, 'occupations_en.csv');
  assert.equal(prepared.counts.inputRows, 2);
  assert.equal(prepared.counts.acceptedUnique, 1);
  assert.equal(prepared.counts.duplicatesCollapsed, 1);
  assert.equal(prepared.counts.rejected, 0);
  assert.equal(prepared.records[0].sourceMetadata.modifiedDate, '2025-11-26T10:02:16.164Z');
  assert.equal(prepared.duplicates[0].reason, 'older_modified_date');
});

test('rejects unresolved equal or invalid modifiedDate conflicts', () => {
  const equalConflict = prepareOccupations(
    parseOccupations([
      occupationFields({ preferredLabel: 'alpha', modifiedDate: '2025-11-26T10:02:16.164Z' }),
      occupationFields({ preferredLabel: 'beta', modifiedDate: '2025-11-26T10:02:16.164Z' }),
    ]).rows,
    'occupations_en.csv',
  );
  assert.equal(equalConflict.counts.acceptedUnique, 0);
  assert.equal(equalConflict.counts.rejected, 2);
  assert.equal(equalConflict.rejects[0].reason, 'conflicting_duplicate');

  const invalidConflict = prepareOccupations(
    parseOccupations([
      occupationFields({ modifiedDate: 'not-a-date' }),
      occupationFields({ modifiedDate: '' }),
    ]).rows,
    'occupations_en.csv',
  );
  assert.equal(invalidConflict.counts.acceptedUnique, 0);
  assert.ok(invalidConflict.rejects.every((item) => item.reason === 'unresolved_modified_date'));
});

test('stores empty skillType as null without inventing metadata', () => {
  const prepared = prepareSkills(
    parseSkills([
      skillFields({
        preferredLabel: 'ICT safety',
        skillType: '',
        conceptType: 'KnowledgeSkillCompetence',
      }),
    ]).rows,
    'skills_en.csv',
  );
  assert.equal(prepared.records[0].skillType, null);
  assert.equal(prepared.records[0].sourceMetadata.conceptType, 'KnowledgeSkillCompetence');
  assert.equal(Object.hasOwn(prepared.records[0].sourceMetadata, 'skillType'), false);
});

test('resolves relations through canonical URIs and rejects invalid URIs and types', () => {
  const occupations = prepareOccupations(parseOccupations([occupationFields()]).rows, 'occupations_en.csv');
  const skills = prepareSkills(parseSkills([skillFields({ skillType: '' })]).rows, 'skills_en.csv');
  const relations = prepareRelations(
    [
      {
        rowNumber: 2,
        fields: relationFields({ skillType: '' }),
      },
      {
        rowNumber: 3,
        fields: relationFields({
          occupationUri: 'http://missing/occupation',
          relationType: 'essential',
        }),
      },
      {
        rowNumber: 4,
        fields: relationFields({ relationType: 'related' }),
      },
    ],
    'occupationSkillRelations_en.csv',
    occupations.uriMap,
    skills.uriMap,
  );
  assert.equal(relations.counts.acceptedUnique, 1);
  assert.equal(relations.records[0].sourceMetadata.skillType, null);
  assert.equal(relations.records[0].sourceMetadata.occupationLabel, 'test occupation');
  assert.ok(relations.rejects.some((item) => item.reason === 'unresolved_occupation_uri'));
  assert.ok(relations.rejects.some((item) => item.reason === 'invalid_relation_type'));
});
