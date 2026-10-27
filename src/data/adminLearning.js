import { learningContents } from './learningContent.js'

const adminStatusById = {
  'advanced-sql': 'Active',
  'data-viz': 'Active',
  'intro-ml': 'Draft',
  'professional-data-communication': 'Active',
  'python-data': 'Active',
  'sql-fundamentals': 'Active',
  'excel-business': 'Archived',
  'career-interviews': 'Draft',
}

export const adminContentTypes = ['Course', 'Video', 'Article', 'Notes', 'Learning Material']

export const adminContentStatuses = ['Draft', 'Active', 'Archived']

export const adminLearningDifficulties = ['Beginner', 'Intermediate', 'Advanced']

export const adminLearningContents = learningContents.map((item) => ({
  id: item.id,
  title: item.title,
  contentType: item.contentType === 'Video Course' ? 'Video' : item.contentType,
  description: item.description,
  resourceUrl: item.resourceUrl,
  difficultyLevel: item.difficulty,
  contentStatus: adminStatusById[item.id] || 'Active',
  skill: item.skill,
  skillsCovered: [{ id: `${item.id}-skill`, skill: item.skill, targetLevel: item.difficulty }],
}))

export const adminLearningSummary = [
  { label: 'Total Content', value: '92' },
  { label: 'Active', value: '80' },
  { label: 'Draft', value: '7' },
  { label: 'Archived', value: '5' },
]

export const adminLearningSkills = ['All', ...Array.from(new Set(adminLearningContents.map((item) => item.skill)))]

export function getAdminLearningContent(contentId) {
  return adminLearningContents.find((item) => item.id === contentId)
}
