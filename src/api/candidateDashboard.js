import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { CAREER_TARGET_EMPTY } from './careerTarget.js'
import { ApiError } from './client.js'
import { isAbortError } from './esco.js'
import {
  EMPTY_LEARNING_RECOMMENDATIONS,
  LEARNING_ALL_RECORDED,
  LEARNING_NO_LINKED_SKILLS,
  LEARNING_NO_RECORDED,
  LEARNING_NO_TARGET,
  fetchLearningRecommendations,
} from './learningRecommendations.js'
import { fetchMeProfile } from './me.js'
import { SKILL_GAP_EMPTY_SKILLS } from './skillGap.js'
import { fetchSavedSkills } from './userSkills.js'

export const DASHBOARD_UNAVAILABLE = 'Dashboard data is unavailable right now.'
export const DASHBOARD_TOPIC_PREVIEW = 3
export const DASHBOARD_SKILL_PREVIEW = 6

export const DASHBOARD_JOBS_UNAVAILABLE = {
  title: 'Published jobs are listed on Explore Jobs.',
  description:
    'Open Explore Jobs or Find Jobs to browse published vacancies, filters and recorded-skill overlap. This dashboard does not invent recommended jobs.',
}

export const DASHBOARD_APPLICATIONS_UNAVAILABLE = {
  title: 'Applications are listed on My Applications.',
  description:
    'Open My Applications to review submitted jobs, status history and the stored resume copy. This dashboard does not invent application counts.',
}

export { DASHBOARD_INTERVIEWS_EMPTY as DASHBOARD_INTERVIEWS_UNAVAILABLE } from './interviews.js'
export { DASHBOARD_INTERVIEWS_EMPTY } from './interviews.js'

export const DASHBOARD_LEARNING_PROGRESS = {
  title: 'Course completion is listed on Learning Progress.',
  description:
    'Skill-development topics come from your saved career target and recorded ESCO skills. Enrolments, lesson completion and assessments are stored on Learning Progress.',
}

export const DASHBOARD_PROFILE_INCOMPLETE = {
  title: 'Your profile is still missing education or location.',
  description: 'Add those details on My Profile when you want them shown here. Empty fields stay empty.',
}

export function firstNameFromFullName(fullName) {
  if (typeof fullName !== 'string') {
    return ''
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return parts[0] || ''
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 12) {
    return 'Good morning'
  }
  if (hour < 18) {
    return 'Good afternoon'
  }
  return 'Good evening'
}

export function profileHighlights(profile) {
  return [profile.educationLevel, profile.institution, profile.location].filter(
    (value) => typeof value === 'string' && value.length > 0,
  )
}

export function userFacingDashboardError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to view your dashboard.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot view this dashboard with this account.'
    }
    if (error.message === 'Invalid request' || error.message === 'Not found') {
      return error.message
    }
  }
  return DASHBOARD_UNAVAILABLE
}

export function buildCandidateDashboard({ profile, skills, recommendations }) {
  const occupation = recommendations.occupation ?? null
  const totals = recommendations.totals
  const recordedForTarget = totals ? totals.essential.recorded + totals.optional.recorded : null
  const notRecordedForTarget = totals ? totals.essential.notRecorded + totals.optional.notRecorded : null
  const recordedTopics = recommendations.recordedTopics ?? []
  const topics = recommendations.topics ?? []
  const unmatchedRecordedSkills = recommendations.unmatchedRecordedSkills ?? []

  return {
    fullName: profile.fullName,
    firstName: firstNameFromFullName(profile.fullName),
    email: profile.email,
    profileHighlights: profileHighlights(profile),
    recordedSkillCount: skills.length,
    occupation,
    learningStatus: recommendations.status,
    recordedForTarget,
    notRecordedForTarget,
    linkedSkillCount: totals?.relations ?? null,
    coverageExplanation: recommendations.coverageExplanation ?? '',
    unmatchedRecordedLabels: unmatchedRecordedSkills.map((item) => item.skill.preferredLabel),
    recordedLabels: recordedTopics.map((topic) => topic.skill.preferredLabel),
    notRecordedLabels: topics.map((topic) => topic.skill.preferredLabel),
    topics: topics.slice(0, DASHBOARD_TOPIC_PREVIEW),
    topicTotal: topics.length,
    stats: [
      { label: 'Recorded skills', value: String(skills.length) },
      { label: 'Career target', value: occupation ? 'Set' : 'Not set' },
      {
        label: 'Occupation-linked',
        value: occupation && totals ? `${recordedForTarget} of ${totals.relations}` : '—',
      },
      {
        label: 'Topics to develop',
        value: occupation ? String(topics.length) : '—',
      },
    ],
  }
}

export async function fetchCandidateDashboard({ signal } = {}) {
  try {
    const [profile, skills, recommendations] = await Promise.all([
      fetchMeProfile({ signal }),
      fetchSavedSkills({ signal }),
      fetchLearningRecommendations({ signal }),
    ])
    return buildCandidateDashboard({
      profile,
      skills,
      recommendations: recommendations ?? EMPTY_LEARNING_RECOMMENDATIONS,
    })
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(DASHBOARD_UNAVAILABLE, 500)
  }
}

export {
  CAREER_TARGET_EMPTY,
  LEARNING_ALL_RECORDED,
  LEARNING_NO_LINKED_SKILLS,
  LEARNING_NO_RECORDED,
  LEARNING_NO_TARGET,
  SKILL_GAP_EMPTY_SKILLS,
}
