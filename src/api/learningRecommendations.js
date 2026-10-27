import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { CAREER_TARGET_EMPTY, fetchCareerTarget } from './careerTarget.js'
import { ApiError } from './client.js'
import { isAbortError } from './esco.js'
import { SKILL_GAP_DISCLAIMER, SKILL_GAP_EMPTY_SKILLS, fetchSkillGap } from './skillGap.js'

export const LEARNING_UNAVAILABLE = 'Learning recommendations are unavailable right now.'
export const LEARNING_DISCLAIMER =
  'These are skill-development topics from ESCO occupation-skill relationships. They are not verified courses, providers, prices, durations or certificates. Not recorded does not mean you lack that skill.'
export const LEARNING_NO_TARGET = {
  title: CAREER_TARGET_EMPTY.title,
  description:
    'Save an official ESCO occupation on the Career Target page to see skill-development topics for that role.',
}
export const LEARNING_NO_RECORDED = SKILL_GAP_EMPTY_SKILLS
export const LEARNING_ALL_RECORDED = {
  title: 'All linked skills are already recorded.',
  description:
    'Every essential and optional ESCO skill linked to your career target is in your PeaceOne skill list. That is a record of saved skills, not a competence score.',
}
export const LEARNING_NO_LINKED_SKILLS = {
  title: 'No ESCO skills are linked to this occupation.',
  description:
    'PeaceOne can only recommend skill-development topics from official occupation-skill relationships. This occupation has none in the imported ESCO data.',
}

export const EMPTY_LEARNING_RECOMMENDATIONS = {
  occupation: null,
  recordedSkillCount: 0,
  totals: null,
  status: 'empty-target',
  topics: [],
  recordedTopics: [],
}

function compareRecommendationItems(left, right) {
  if (left.relationType !== right.relationType) {
    return left.relationType === 'essential' ? -1 : 1
  }
  const label = left.skill.preferredLabel.localeCompare(right.skill.preferredLabel, 'en')
  if (label !== 0) {
    return label
  }
  return left.skill.sourceUri.localeCompare(right.skill.sourceUri, 'en')
}

export function learningGoalsFor(skillLabel, occupationLabel) {
  return [
    `Read the official ESCO meaning of ${skillLabel}.`,
    `Practise ${skillLabel} in work similar to ${occupationLabel}.`,
    `When you can demonstrate ${skillLabel}, record it on the Skills page with an honest proficiency level.`,
  ]
}

export function rationaleFor({ relationType, recorded, proficiencyLevel, occupationLabel }) {
  const kind = relationType === 'essential' ? 'essential' : 'optional'
  if (recorded) {
    return `You have recorded this ${kind} skill for ${occupationLabel} at ${proficiencyLevel}. That is your saved proficiency, not a PeaceOne competence score.`
  }
  return `This ${kind} skill is linked to ${occupationLabel} in ESCO and is not in your recorded PeaceOne skill list. Not recorded does not mean you lack the skill. This is a skill-development topic, not a verified course.`
}

function serializeTopic(item, occupation) {
  return {
    id: item.skill.id,
    skill: item.skill,
    occupation: {
      id: occupation.id,
      preferredLabel: occupation.preferredLabel,
      sourceUri: occupation.sourceUri,
      sourceSystem: occupation.sourceSystem,
    },
    relationType: item.relationType,
    recorded: item.recorded,
    proficiencyLevel: item.proficiencyLevel,
    rationale: rationaleFor({
      relationType: item.relationType,
      recorded: item.recorded,
      proficiencyLevel: item.proficiencyLevel,
      occupationLabel: occupation.preferredLabel,
    }),
    learningGoals: learningGoalsFor(item.skill.preferredLabel, occupation.preferredLabel),
  }
}

export function buildLearningRecommendations(gap) {
  const occupation = gap.occupation
  const topics = gap.items
    .filter((item) => !item.recorded)
    .sort(compareRecommendationItems)
    .map((item) => serializeTopic(item, occupation))
  const recordedTopics = gap.items
    .filter((item) => item.recorded)
    .sort(compareRecommendationItems)
    .map((item) => serializeTopic(item, occupation))

  let status = 'ready'
  if (gap.items.length === 0) {
    status = 'no-linked-skills'
  } else if (gap.recordedSkillCount === 0) {
    status = 'no-recorded-skills'
  } else if (topics.length === 0) {
    status = 'all-recorded'
  }

  return {
    occupation,
    recordedSkillCount: gap.recordedSkillCount,
    totals: gap.totals,
    status,
    topics,
    recordedTopics,
  }
}

export function userFacingLearningError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to view learning recommendations.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot view learning recommendations with this account.'
    }
    if (error.message === 'Invalid request' || error.message === 'Not found') {
      return error.message
    }
  }
  return LEARNING_UNAVAILABLE
}

export function learningSkillsPath(basePath) {
  return `${basePath}/skills`
}

export function learningCareerTargetPath(basePath) {
  return `${basePath}/career-target`
}

export function learningSkillGapPath(basePath) {
  return `${basePath}/skill-gap`
}

export async function fetchLearningRecommendations({ signal } = {}) {
  try {
    const occupation = await fetchCareerTarget({ signal })
    if (!occupation) {
      return EMPTY_LEARNING_RECOMMENDATIONS
    }
    const gap = await fetchSkillGap(occupation.id, { signal })
    return buildLearningRecommendations(gap)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(LEARNING_UNAVAILABLE, 500)
  }
}

export { SKILL_GAP_DISCLAIMER }
