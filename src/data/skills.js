export const proficiencyLevels = ['Beginner', 'Intermediate', 'Advanced']

export const sourceTypes = ['Self-Claim', 'Resume', 'Certification', 'Project', 'Learning']

export const addSkillSourceTypes = ['Self-Claim', 'Certification', 'Project', 'Learning']

export const skillCategories = [
  'Programming',
  'Data & Analytics',
  'Communication',
  'Business',
  'Design',
  'Professional Skill',
]

export const skillCatalogue = [
  { skillName: 'Python', skillCategory: 'Programming', description: 'Write scripts and analyse datasets used in reporting work.', status: 'Active' },
  { skillName: 'SQL', skillCategory: 'Data & Analytics', description: 'Query and summarise structured data for analysis tasks.', status: 'Active' },
  { skillName: 'Communication', skillCategory: 'Communication', description: 'Explain findings clearly to teammates and stakeholders.', status: 'Active' },
  { skillName: 'Statistics', skillCategory: 'Data & Analytics', description: 'Use core statistical methods to interpret data.', status: 'Active' },
  { skillName: 'Data Visualization', skillCategory: 'Data & Analytics', description: 'Present data in charts that support decisions.', status: 'Active' },
  { skillName: 'Excel', skillCategory: 'Business', description: 'Organise, clean and report data in spreadsheets.', status: 'Active' },
  { skillName: 'JavaScript', skillCategory: 'Programming', description: 'Build interactive web features for software roles.', status: 'Active' },
  { skillName: 'Problem Solving', skillCategory: 'Professional Skill', description: 'Break down workplace problems and propose practical steps.', status: 'Active' },
  { skillName: 'Machine Learning', skillCategory: 'Data & Analytics', description: 'Apply introductory models to structured datasets.', status: 'Active' },
  { skillName: 'Data Analysis', skillCategory: 'Data & Analytics', description: 'Turn raw information into useful reports and insights.', status: 'Active' },
]

export const initialUserSkills = [
  { id: 'python', skillName: 'Python', skillCategory: 'Programming', proficiencyLevel: 'Advanced', sourceType: 'Certification', verificationStatus: 'Verified' },
  { id: 'sql', skillName: 'SQL', skillCategory: 'Data & Analytics', proficiencyLevel: 'Intermediate', sourceType: 'Project', verificationStatus: 'Verified' },
  { id: 'communication', skillName: 'Communication', skillCategory: 'Communication', proficiencyLevel: 'Intermediate', sourceType: 'Self-Claim', verificationStatus: 'Pending' },
  { id: 'statistics', skillName: 'Statistics', skillCategory: 'Data & Analytics', proficiencyLevel: 'Intermediate', sourceType: 'Learning', verificationStatus: 'Verified' },
  { id: 'data-visualization', skillName: 'Data Visualization', skillCategory: 'Data & Analytics', proficiencyLevel: 'Beginner', sourceType: 'Learning', verificationStatus: 'Verified' },
  { id: 'excel', skillName: 'Excel', skillCategory: 'Business', proficiencyLevel: 'Intermediate', sourceType: 'Resume', verificationStatus: 'Verified' },
  { id: 'javascript', skillName: 'JavaScript', skillCategory: 'Programming', proficiencyLevel: 'Beginner', sourceType: 'Resume', verificationStatus: 'Pending' },
  { id: 'problem-solving', skillName: 'Problem Solving', skillCategory: 'Professional Skill', proficiencyLevel: 'Intermediate', sourceType: 'Resume', verificationStatus: 'Verified' },
]

export const skillsSummary = {
  totalSkills: 8,
  verifiedSkills: 6,
  pendingVerification: 2,
  resumeExtracted: 3,
}
