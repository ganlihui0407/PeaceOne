import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serializeSkillGap } from '../src/lib/skillGapQuery.js';

const OCCUPATION_ID = '11111111-1111-4111-8111-111111111111';
const SQL_ID = '15036597-4e14-4a83-882e-15592322ca92';
const SQL_URI = 'http://data.europa.eu/esco/skill/598de5b0-5b58-4ea7-8058-a4bc4d18c742';
const QUERY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const QUERY_URI = 'http://data.europa.eu/esco/skill/query-languages';
const PYTHON_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PYTHON_URI = 'http://data.europa.eu/esco/skill/python';
const STATS_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STATS_URI = 'http://data.europa.eu/esco/skill/statistics';

function occupation() {
  return {
    id: OCCUPATION_ID,
    sourceUri: 'http://data.europa.eu/esco/occupation/data-analyst',
    preferredLabel: 'data analyst',
    sourceSystem: 'ESCO',
    sourceMetadata: { iscoGroup: '2511' },
  };
}

function skill(id, label, sourceUri, extras = {}) {
  return {
    id,
    preferredLabel: label,
    sourceUri,
    skillType: 'knowledge',
    sourceSystem: 'ESCO',
    ...extras,
  };
}

function relation(skillRecord, relationType = 'essential') {
  return { relationType, skill: skillRecord };
}

function userSkill(skillRecord, proficiencyLevel) {
  return {
    skillId: skillRecord.id,
    proficiencyLevel,
    skill: skillRecord,
  };
}

test('occupation retrieval and required skill count stay ID-based', () => {
  const relations = [
    relation(skill(QUERY_ID, 'query languages', QUERY_URI)),
    relation(skill(STATS_ID, 'statistics', STATS_URI), 'optional'),
  ];
  const result = serializeSkillGap(occupation(), relations, []);
  assert.equal(result.occupation.id, OCCUPATION_ID);
  assert.equal(result.occupation.preferredLabel, 'data analyst');
  assert.equal(result.totals.relations, 2);
  assert.equal(result.totals.essential.total, 1);
  assert.equal(result.totals.optional.total, 1);
  assert.equal(result.matchedOccupationSkillCount, 0);
  assert.equal(result.recordedSkillCount, 0);
});

test('UserSkill matching uses exact ESCO skill identifiers', () => {
  const query = skill(QUERY_ID, 'query languages', QUERY_URI);
  const stats = skill(STATS_ID, 'statistics', STATS_URI);
  const result = serializeSkillGap(
    occupation(),
    [relation(query), relation(stats, 'optional')],
    [userSkill(query, 'Intermediate')],
  );
  assert.equal(result.recordedSkillCount, 1);
  assert.equal(result.matchedOccupationSkillCount, 1);
  assert.equal(result.totals.essential.recorded, 1);
  assert.equal(result.totals.optional.recorded, 0);
  assert.equal(result.items.find((item) => item.skill.id === QUERY_ID).recorded, true);
  assert.equal(result.items.find((item) => item.skill.id === STATS_ID).recorded, false);
  assert.equal(result.unmatchedRecordedSkills.length, 0);
});

test('SQL user skills do not match a different occupation skill such as query languages', () => {
  const query = skill(QUERY_ID, 'query languages', QUERY_URI);
  const sql = skill(SQL_ID, 'SQL', SQL_URI);
  const result = serializeSkillGap(
    occupation(),
    [relation(query)],
    [userSkill(sql, 'Beginner')],
  );
  assert.equal(result.recordedSkillCount, 1);
  assert.equal(result.matchedOccupationSkillCount, 0);
  assert.equal(result.items[0].recorded, false);
  assert.equal(result.unmatchedRecordedSkills.length, 1);
  assert.equal(result.unmatchedRecordedSkills[0].skill.preferredLabel, 'SQL');
  assert.match(result.coverageExplanation, /SQL/);
  assert.match(result.coverageExplanation, /exact ESCO skill identifiers/);
});

test('unrelated recorded skills are excluded from occupation-linked coverage', () => {
  const stats = skill(STATS_ID, 'statistics', STATS_URI);
  const python = skill(PYTHON_ID, 'Python (computer programming)', PYTHON_URI);
  const result = serializeSkillGap(
    occupation(),
    [relation(stats)],
    [userSkill(stats, 'Beginner'), userSkill(python, 'Intermediate')],
  );
  assert.equal(result.recordedSkillCount, 2);
  assert.equal(result.matchedOccupationSkillCount, 1);
  assert.deepEqual(
    result.unmatchedRecordedSkills.map((item) => item.skill.preferredLabel),
    ['Python (computer programming)'],
  );
});

test('duplicate UserSkill rows keep the higher proficiency and count once', () => {
  const stats = skill(STATS_ID, 'statistics', STATS_URI);
  const result = serializeSkillGap(
    occupation(),
    [relation(stats)],
    [userSkill(stats, 'Beginner'), userSkill(stats, 'Advanced')],
  );
  assert.equal(result.recordedSkillCount, 1);
  assert.equal(result.items[0].proficiencyLevel, 'Advanced');
});

test('invalid skill identifiers are ignored', () => {
  const stats = skill(STATS_ID, 'statistics', STATS_URI);
  const result = serializeSkillGap(
    occupation(),
    [relation(stats)],
    [
      { skillId: 'not-a-uuid', proficiencyLevel: 'Beginner', skill: stats },
      { skillId: SQL_ID, proficiencyLevel: 'Expert', skill: skill(SQL_ID, 'SQL', SQL_URI) },
    ],
  );
  assert.equal(result.recordedSkillCount, 0);
  assert.equal(result.matchedOccupationSkillCount, 0);
});

test('the same ESCO source URI matches when local skill ids differ', () => {
  const occupationSkill = skill(QUERY_ID, 'query languages', QUERY_URI);
  const recordedSkill = skill('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'query languages', QUERY_URI);
  const result = serializeSkillGap(
    occupation(),
    [relation(occupationSkill)],
    [userSkill(recordedSkill, 'Beginner')],
  );
  assert.equal(result.items[0].recorded, true);
  assert.equal(result.matchedOccupationSkillCount, 1);
  assert.equal(result.unmatchedRecordedSkills.length, 0);
});
