import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  JOB_SKILL_MATCH_DISCLAIMER,
  JOB_SKILL_MATCH_EMPTY_CANDIDATE,
  JOB_SKILL_MATCH_UNAVAILABLE,
  MATCH_STATUS,
  canComputeJobSkillOverlap,
  candidateSkillGapPath,
  candidateSkillsPath,
  compareJobSkillOverlap,
  formatRecordedSkillOverlap,
  matchStatusLabel,
  missingSkillExplanation,
  proficiencyGapExplanation,
} from './jobSkillMatch.js'

const PYTHON = '11111111-1111-4111-8111-111111111111'
const SQL = '22222222-2222-4222-8222-222222222222'
const COMMUNICATION = '33333333-3333-4333-8333-333333333333'
const DATA_ANALYSIS = '44444444-4444-4444-8444-444444444444'
const PYTHON_LOOKALIKE = '55555555-5555-4555-8555-555555555555'

function requiredSkill(id, label, requiredLevel) {
  return {
    id: `job-skill-${id}`,
    requiredLevel,
    skill: {
      id,
      sourceUri: `http://data.europa.eu/esco/skill/${id}`,
      preferredLabel: label,
      skillType: 'skill',
      sourceSystem: 'ESCO',
    },
  }
}

function candidateSkill(id, label, proficiencyLevel) {
  return {
    id: `user-skill-${id}`,
    proficiencyLevel,
    skill: {
      id,
      sourceUri: `http://data.europa.eu/esco/skill/${id}`,
      preferredLabel: label,
      skillType: 'skill',
      sourceSystem: 'ESCO',
    },
  }
}

const exampleRequired = [
  requiredSkill(PYTHON, 'Python', 'Intermediate'),
  requiredSkill(SQL, 'SQL', 'Advanced'),
  requiredSkill(COMMUNICATION, 'Communication', 'Beginner'),
  requiredSkill(DATA_ANALYSIS, 'Data Analysis', 'Intermediate'),
]

const exampleCandidate = [
  candidateSkill(PYTHON, 'Python', 'Intermediate'),
  candidateSkill(SQL, 'SQL', 'Beginner'),
  candidateSkill(COMMUNICATION, 'Communication', 'Advanced'),
]

test('exact ESCO skill IDs match even when labels differ', () => {
  const result = compareJobSkillOverlap(
    [requiredSkill(PYTHON, 'use Python', 'Beginner')],
    [candidateSkill(PYTHON, 'Python programming', 'Beginner')],
  )
  assert.equal(result.matchedCount, 1)
  assert.equal(result.matched[0].skillId, PYTHON)
  assert.equal(result.matched[0].status, MATCH_STATUS.MATCHED)
})

test('different skill IDs with similar labels must not match', () => {
  const result = compareJobSkillOverlap(
    [requiredSkill(PYTHON, 'Python', 'Beginner')],
    [candidateSkill(PYTHON_LOOKALIKE, 'Python', 'Advanced')],
  )
  assert.equal(result.matchedCount, 0)
  assert.equal(result.missingCount, 1)
  assert.equal(result.missing[0].skillId, PYTHON)
  assert.equal(result.missing[0].status, MATCH_STATUS.MISSING)
})

test('candidate proficiency that meets the required level is MATCHED', () => {
  const result = compareJobSkillOverlap(
    [requiredSkill(PYTHON, 'Python', 'Intermediate')],
    [candidateSkill(PYTHON, 'Python', 'Intermediate')],
  )
  assert.equal(result.matched[0].status, MATCH_STATUS.MATCHED)
  assert.equal(result.matched[0].candidateLevel, 'Intermediate')
  assert.equal(result.matched[0].requiredLevel, 'Intermediate')
})

test('candidate proficiency that exceeds the required level is MATCHED', () => {
  const result = compareJobSkillOverlap(
    [requiredSkill(COMMUNICATION, 'Communication', 'Beginner')],
    [candidateSkill(COMMUNICATION, 'Communication', 'Advanced')],
  )
  assert.equal(result.matchedCount, 1)
  assert.equal(result.proficiencyGapCount, 0)
})

test('candidate proficiency below the required level is a PROFICIENCY_GAP', () => {
  const result = compareJobSkillOverlap(
    [requiredSkill(SQL, 'SQL', 'Advanced')],
    [candidateSkill(SQL, 'SQL', 'Beginner')],
  )
  assert.equal(result.proficiencyGapCount, 1)
  assert.equal(result.matchedCount, 0)
  assert.equal(result.proficiencyGaps[0].status, MATCH_STATUS.PROFICIENCY_GAP)
  assert.equal(result.proficiencyGaps[0].candidateLevel, 'Beginner')
  assert.equal(result.proficiencyGaps[0].requiredLevel, 'Advanced')
  assert.equal(
    proficiencyGapExplanation('Beginner', 'Advanced').includes('does not change your recorded level'),
    true,
  )
})

test('a required skill without a UserSkill record is MISSING', () => {
  const result = compareJobSkillOverlap(
    [requiredSkill(DATA_ANALYSIS, 'Data Analysis', 'Intermediate')],
    exampleCandidate,
  )
  assert.equal(result.missingCount, 1)
  assert.equal(result.missing[0].skillId, DATA_ANALYSIS)
  assert.equal(result.missing[0].candidateLevel, null)
  assert.equal(missingSkillExplanation().includes('has not been recorded in My Skills'), true)
})

test('empty candidate skills mark every required skill as MISSING', () => {
  const result = compareJobSkillOverlap(exampleRequired, [])
  assert.equal(result.available, true)
  assert.equal(result.matchedCount, 0)
  assert.equal(result.missingCount, 4)
  assert.equal(result.overlapPercent, 0)
  assert.equal(canComputeJobSkillOverlap([]), true)
})

test('a job with no required skills does not divide by zero', () => {
  const result = compareJobSkillOverlap([], exampleCandidate)
  assert.equal(result.available, false)
  assert.equal(result.overlapPercent, null)
  assert.equal(result.totalRequired, 0)
  assert.equal(result.message, JOB_SKILL_MATCH_UNAVAILABLE)
  assert.equal(formatRecordedSkillOverlap(result.overlapPercent), null)
})

test('overlap percentage counts only MATCHED required skills', () => {
  const result = compareJobSkillOverlap(exampleRequired, exampleCandidate)
  assert.equal(result.totalRequired, 4)
  assert.equal(result.matchedCount, 2)
  assert.equal(result.proficiencyGapCount, 1)
  assert.equal(result.missingCount, 1)
  assert.equal(result.overlapPercent, 50)
  assert.equal(formatRecordedSkillOverlap(50), 'Recorded-skill overlap: 50%')
  assert.equal(result.matched.map((row) => row.preferredLabel).sort().join(','), 'Communication,Python')
  assert.equal(result.proficiencyGaps[0].preferredLabel, 'SQL')
  assert.equal(result.missing[0].preferredLabel, 'Data Analysis')
})

test('six matched skills out of ten required skills are 60 percent', () => {
  const required = Array.from({ length: 10 }, (_, index) => (
    requiredSkill(`aaaaaaa${index}-1111-4111-8111-11111111111${index}`, `Skill ${index}`, 'Beginner')
  ))
  const candidate = required.slice(0, 6).map((item) => (
    candidateSkill(item.skill.id, item.skill.preferredLabel, 'Beginner')
  ))
  const result = compareJobSkillOverlap(required, candidate)
  assert.equal(result.matchedCount, 6)
  assert.equal(result.missingCount, 4)
  assert.equal(result.overlapPercent, 60)
})

test('multiple proficiency gaps stay separate from missing skills', () => {
  const required = [
    requiredSkill(PYTHON, 'Python', 'Advanced'),
    requiredSkill(SQL, 'SQL', 'Advanced'),
    requiredSkill(DATA_ANALYSIS, 'Data Analysis', 'Intermediate'),
  ]
  const candidate = [
    candidateSkill(PYTHON, 'Python', 'Beginner'),
    candidateSkill(SQL, 'SQL', 'Intermediate'),
  ]
  const result = compareJobSkillOverlap(required, candidate)
  assert.equal(result.proficiencyGapCount, 2)
  assert.equal(result.missingCount, 1)
  assert.equal(result.matchedCount, 0)
  assert.equal(result.overlapPercent, 0)
})

test('duplicate required skill IDs and duplicate candidate rows are collapsed', () => {
  const required = [
    requiredSkill(PYTHON, 'Python', 'Intermediate'),
    requiredSkill(PYTHON, 'Python', 'Advanced'),
    requiredSkill(SQL, 'SQL', 'Advanced'),
  ]
  const candidate = [
    candidateSkill(PYTHON, 'Python', 'Beginner'),
    candidateSkill(PYTHON, 'Python', 'Advanced'),
    candidateSkill(SQL, 'SQL', 'Beginner'),
    candidateSkill(SQL, 'SQL', 'Beginner'),
  ]
  const result = compareJobSkillOverlap(required, candidate)
  assert.equal(result.totalRequired, 2)
  assert.equal(result.matchedCount, 1)
  assert.equal(result.proficiencyGapCount, 1)
  assert.equal(result.matched[0].candidateLevel, 'Advanced')
  assert.equal(result.proficiencyGaps[0].candidateLevel, 'Beginner')
})

test('null candidate skills must not be treated as an empty recorded list', () => {
  assert.equal(canComputeJobSkillOverlap(null), false)
  assert.equal(canComputeJobSkillOverlap(undefined), false)
  const result = compareJobSkillOverlap(exampleRequired, null)
  assert.equal(result.available, true)
  assert.equal(result.missingCount, 4)
  assert.equal(JOB_SKILL_MATCH_DISCLAIMER.includes('not an employability probability'), true)
  assert.equal(JOB_SKILL_MATCH_EMPTY_CANDIDATE.includes('does not infer skills from a resume'), true)
  assert.equal(matchStatusLabel(MATCH_STATUS.MATCHED), 'Matched')
  assert.equal(candidateSkillsPath('/student'), '/student/skills')
  assert.equal(candidateSkillGapPath('/jobseeker'), '/jobseeker/skill-gap')
})

test('job details and listing wire recorded-skill overlap without AI claims', () => {
  const details = readFileSync(fileURLToPath(new URL('../pages/shared/CandidateJobDetailPage.jsx', import.meta.url)), 'utf8')
  const list = readFileSync(fileURLToPath(new URL('../pages/shared/CandidateJobsPage.jsx', import.meta.url)), 'utf8')
  const panel = readFileSync(fileURLToPath(new URL('../components/jobs/JobSkillMatchPanel.jsx', import.meta.url)), 'utf8')
  const hook = readFileSync(fileURLToPath(new URL('../hooks/useRecordedSkills.js', import.meta.url)), 'utf8')
  const matcher = readFileSync(fileURLToPath(new URL('./jobSkillMatch.js', import.meta.url)), 'utf8')
  const userSkills = readFileSync(fileURLToPath(new URL('./userSkills.js', import.meta.url)), 'utf8')
  const skillGap = readFileSync(fileURLToPath(new URL('./skillGap.js', import.meta.url)), 'utf8')
  const careerTarget = readFileSync(fileURLToPath(new URL('./careerTarget.js', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')

  assert.equal(details.includes('JobSkillMatchPanel'), true)
  assert.equal(details.includes('useRecordedSkills'), true)
  assert.equal(details.includes('Your Skills vs Job Requirements') || panel.includes('Your Skills vs Job Requirements'), true)
  assert.equal(panel.includes('compareJobSkillOverlap'), true)
  assert.equal(panel.includes('onRetry'), true)
  assert.equal(panel.includes('fetchSavedSkills'), false)
  assert.equal(panel.includes('createSavedSkill'), false)
  assert.equal(panel.includes('updateSavedSkill'), false)
  assert.equal(panel.includes('AI compatibility'), false)
  assert.equal(panel.includes('job success'), false)
  assert.equal(list.includes('useRecordedSkills'), true)
  assert.equal(list.includes('formatRecordedSkillOverlap'), true)
  assert.equal(list.includes('% Match'), false)
  assert.equal(list.includes('canComputeJobSkillOverlap'), true)
  assert.equal(hook.includes("fetchSavedSkills"), true)
  assert.equal(hook.includes('/api/me/skills') || userSkills.includes("'/api/me/skills'"), true)
  assert.equal(matcher.includes('userId'), false)
  assert.equal(userSkills.includes('clearRecordedSkillsCache'), true)
  assert.equal(skillGap.includes('compareJobSkillOverlap'), false)
  assert.equal(skillGap.includes('jobSkillMatch'), false)
  assert.equal(careerTarget.includes('jobSkillMatch'), false)
  assert.equal(app.includes("roles={['STUDENT']}"), true)
  assert.equal(app.includes("roles={['JOB_SEEKER']}"), true)
})
