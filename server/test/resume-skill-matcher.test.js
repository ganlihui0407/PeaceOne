import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evidenceSnippet,
  matchResumeSkills,
  normalizeMatchText,
  splitAltLabels,
} from '../src/lib/resumeSkillMatch.js';
import {
  REVIEW_TTL_MS,
  assertSelectedSubset,
  createReviewToken,
  verifyReviewToken,
} from '../src/lib/resumeExtractionReview.js';
import { ResumeError } from '../src/lib/resumeQuery.js';

const PYTHON = {
  id: '11111111-1111-4111-8111-111111111111',
  preferredLabel: 'Python',
  skillType: 'skill',
  sourceUri: 'http://data.europa.eu/esco/skill/python',
  sourceMetadata: { altLabels: '' },
};
const JAVA = {
  id: '22222222-2222-4222-8222-222222222222',
  preferredLabel: 'Java',
  skillType: 'skill',
  sourceUri: 'http://data.europa.eu/esco/skill/java',
  sourceMetadata: { altLabels: '' },
};
const JAVASCRIPT = {
  id: '33333333-3333-4333-8333-333333333333',
  preferredLabel: 'JavaScript',
  skillType: 'skill',
  sourceUri: 'http://data.europa.eu/esco/skill/javascript',
  sourceMetadata: { altLabels: 'JS\nECMAScript' },
};
const ICT = {
  id: '44444444-4444-4444-8444-444444444444',
  preferredLabel: 'ICT safety',
  skillType: null,
  sourceUri: 'http://data.europa.eu/esco/skill/ict',
  sourceMetadata: { altLabels: 'information security\ncyber safety' },
};
const NODE = {
  id: '55555555-5555-4555-8555-555555555555',
  preferredLabel: 'Node.js',
  skillType: 'skill',
  sourceUri: 'http://data.europa.eu/esco/skill/node',
  sourceMetadata: { altLabels: '' },
};
const CATALOG = [PYTHON, JAVA, JAVASCRIPT, ICT, NODE];

function ids(suggestions) {
  return suggestions.map((item) => item.preferredLabel);
}

test('matches exact preferred labels case-insensitively', () => {
  const suggestions = matchResumeSkills('Experience with PYTHON and teamwork.', CATALOG);
  assert.deepEqual(ids(suggestions), ['Python']);
  assert.equal(suggestions[0].matchType, 'preferred');
  assert.equal(suggestions[0].matchingMethod, 'preferred-label');
  assert.equal(suggestions[0].skillId, PYTHON.id);
  assert.match(suggestions[0].evidence, /PYTHON/i);
});

test('matches alternative ESCO labels', () => {
  const suggestions = matchResumeSkills('I work in information security every day.', CATALOG);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].preferredLabel, 'ICT safety');
  assert.equal(suggestions[0].matchedLabel, 'information security');
  assert.equal(suggestions[0].matchType, 'altLabel');
  assert.equal(suggestions[0].matchingMethod, 'alternative-label');
  assert.match(suggestions[0].evidence, /information security/);
});

test('normalises punctuation and whitespace without changing words', () => {
  assert.equal(normalizeMatchText('  Node.js\nexperience  '), 'node.js experience');
  const suggestions = matchResumeSkills('Built Node.js  services.', CATALOG);
  assert.deepEqual(ids(suggestions), ['Node.js']);
});

test('does not match Java inside JavaScript', () => {
  const suggestions = matchResumeSkills('Primary language: JavaScript.', CATALOG);
  assert.deepEqual(ids(suggestions), ['JavaScript']);
  assert.equal(suggestions.some((item) => item.preferredLabel === 'Java'), false);
});

test('matches Java only as a whole token', () => {
  const suggestions = matchResumeSkills('Backend work in Java and Python.', CATALOG);
  assert.deepEqual(ids(suggestions).sort(), ['Java', 'Python']);
});

test('deduplicates the same skill found twice', () => {
  const suggestions = matchResumeSkills('Python in year one. Later more Python.', CATALOG);
  assert.equal(suggestions.filter((item) => item.skillId === PYTHON.id).length, 1);
});

test('returns multiple distinct skill matches', () => {
  const suggestions = matchResumeSkills('JavaScript, Python and ICT safety.', CATALOG);
  assert.deepEqual(ids(suggestions).sort(), ['ICT safety', 'JavaScript', 'Python']);
});

test('returns no suggestions when nothing matches', () => {
  assert.deepEqual(matchResumeSkills('I enjoy hiking and pottery.', CATALOG), []);
});

test('builds a short evidence snippet around the match', () => {
  const snippet = evidenceSnippet('AAA ICT safety BBB', 'ICT safety');
  assert.equal(snippet.includes('ICT safety'), true);
});

test('marks already saved skills without duplicating them', () => {
  const suggestions = matchResumeSkills('Python and JavaScript', CATALOG, {
    savedBySkillId: new Map([[PYTHON.id, 'Advanced']]),
  });
  const python = suggestions.find((item) => item.skillId === PYTHON.id);
  const js = suggestions.find((item) => item.skillId === JAVASCRIPT.id);
  assert.equal(python.alreadySaved, true);
  assert.equal(python.existingProficiency, 'Advanced');
  assert.equal(js.alreadySaved, false);
  assert.equal(js.existingProficiency, null);
});

test('splits ESCO alternative labels on newlines', () => {
  assert.deepEqual(splitAltLabels('JS\nECMAScript'), ['JS', 'ECMAScript']);
});

test('signed review tokens bind user, resume, file hash and expire', () => {
  const secret = 'test-review-secret';
  const token = createReviewToken(
    {
      userId: 'user-1',
      resumeId: 'resume-1',
      sha256: 'abc',
      skillIds: [PYTHON.id, JAVA.id],
    },
    { secret, now: 1_000, ttlMs: 50 },
  );

  const payload = verifyReviewToken(
    token,
    { userId: 'user-1', resumeId: 'resume-1', sha256: 'abc', now: 1_010 },
    { secret },
  );
  assert.deepEqual(payload.skillIds, [JAVA.id, PYTHON.id].sort());

  assert.throws(
    () =>
      verifyReviewToken(
        token,
        { userId: 'user-2', resumeId: 'resume-1', sha256: 'abc', now: 1_010 },
        { secret },
      ),
    (error) => error instanceof ResumeError && error.message === 'Invalid request',
  );
  assert.throws(
    () =>
      verifyReviewToken(
        token,
        { userId: 'user-1', resumeId: 'resume-2', sha256: 'abc', now: 1_010 },
        { secret },
      ),
    (error) => error instanceof ResumeError,
  );
  assert.throws(
    () =>
      verifyReviewToken(
        token,
        { userId: 'user-1', resumeId: 'resume-1', sha256: 'other', now: 1_010 },
        { secret },
      ),
    (error) => error instanceof ResumeError,
  );
  assert.throws(
    () =>
      verifyReviewToken(
        token,
        { userId: 'user-1', resumeId: 'resume-1', sha256: 'abc', now: 2_000 },
        { secret },
      ),
    (error) => error instanceof ResumeError && error.message === 'Review has expired',
  );

  const tampered = `${token.slice(0, -2)}aa`;
  assert.throws(
    () =>
      verifyReviewToken(
        tampered,
        { userId: 'user-1', resumeId: 'resume-1', sha256: 'abc', now: 1_010 },
        { secret },
      ),
    (error) => error instanceof ResumeError && error.message === 'Invalid request',
  );

  assert.throws(
    () => assertSelectedSubset(['not-allowed'], payload.skillIds),
    (error) => error instanceof ResumeError,
  );
  assert.deepEqual(assertSelectedSubset([PYTHON.id], payload.skillIds), [PYTHON.id]);
  assert.equal(REVIEW_TTL_MS, 15 * 60 * 1000);
});
