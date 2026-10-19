const nexaSkills = {
  analyst: [
    { id: 'da-python', skillName: 'Python', requiredLevel: 'Advanced', importanceWeight: '5' },
    { id: 'da-sql', skillName: 'SQL', requiredLevel: 'Advanced', importanceWeight: '5' },
    { id: 'da-stats', skillName: 'Statistics', requiredLevel: 'Intermediate', importanceWeight: '3' },
  ],
  developer: [
    { id: 'jsd-js', skillName: 'JavaScript', requiredLevel: 'Intermediate', importanceWeight: '5' },
    { id: 'jsd-sql', skillName: 'SQL', requiredLevel: 'Beginner', importanceWeight: '3' },
    { id: 'jsd-ps', skillName: 'Problem Solving', requiredLevel: 'Intermediate', importanceWeight: '4' },
  ],
  ba: [
    { id: 'ba-excel', skillName: 'Excel', requiredLevel: 'Advanced', importanceWeight: '5' },
    { id: 'ba-comm', skillName: 'Communication', requiredLevel: 'Advanced', importanceWeight: '4' },
    { id: 'ba-sql', skillName: 'SQL', requiredLevel: 'Intermediate', importanceWeight: '3' },
  ],
  design: [
    { id: 'ux-comm', skillName: 'Communication', requiredLevel: 'Intermediate', importanceWeight: '4' },
    { id: 'ux-ps', skillName: 'Problem Solving', requiredLevel: 'Intermediate', importanceWeight: '5' },
    { id: 'ux-viz', skillName: 'Data Visualization', requiredLevel: 'Beginner', importanceWeight: '2' },
  ],
}

export const employmentTypes = ['Full-Time', 'Part-Time', 'Contract', 'Internship']

export const jobStatuses = ['Draft', 'Active', 'Closed']

export const requiredLevels = ['Beginner', 'Intermediate', 'Advanced']

export const importanceWeights = ['1', '2', '3', '4', '5']

export const emptyRequiredSkill = {
  skillName: '',
  requiredLevel: 'Beginner',
  importanceWeight: '3',
}

export const defaultCreateSkills = [
  { id: 'new-python', skillName: 'Python', requiredLevel: 'Advanced', importanceWeight: '5' },
  { id: 'new-sql', skillName: 'SQL', requiredLevel: 'Advanced', importanceWeight: '5' },
  { id: 'new-stats', skillName: 'Statistics', requiredLevel: 'Intermediate', importanceWeight: '3' },
]

export const employerJobs = [
  {
    id: 'data-analyst',
    companyName: 'Nexa Digital',
    jobTitle: 'Data Analyst',
    jobDescription:
      'Support weekly reporting, clean datasets and prepare stakeholder summaries. The role works closely with product and operations teams on recurring analysis tasks.',
    qualificationRequired: "Bachelor's Degree in Data Analytics, Information Systems or a related field",
    experienceRequired: '1–2 years',
    employmentType: 'Full-Time',
    location: 'Kuala Lumpur',
    salaryMin: '4000',
    salaryMax: '6500',
    jobStatus: 'Active',
    postedDate: '2026-08-10',
    postedDateLabel: '10 Aug 2026',
    closingDate: '2026-08-31',
    closingDateLabel: '31 Aug 2026',
    applicants: 18,
    requiredSkills: nexaSkills.analyst,
  },
  {
    id: 'junior-software-developer',
    companyName: 'Nexa Digital',
    jobTitle: 'Junior Software Developer',
    jobDescription:
      'Build and maintain internal web features used by reporting and operations teams. The role includes code reviews, documentation and support for existing product work.',
    qualificationRequired: "Diploma or Bachelor's Degree in Computer Science or a related field",
    experienceRequired: '0–1 years',
    employmentType: 'Full-Time',
    location: 'Kuala Lumpur',
    salaryMin: '3800',
    salaryMax: '5200',
    jobStatus: 'Active',
    postedDate: '2026-08-12',
    postedDateLabel: '12 Aug 2026',
    closingDate: '2026-09-05',
    closingDateLabel: '5 Sep 2026',
    applicants: 11,
    requiredSkills: nexaSkills.developer,
  },
  {
    id: 'business-analyst',
    companyName: 'Nexa Digital',
    jobTitle: 'Business Analyst',
    jobDescription:
      'Document process notes, gather reporting requirements and help teams translate business questions into clear analysis tasks.',
    qualificationRequired: "Bachelor's Degree in Business, Information Systems or a related field",
    experienceRequired: '2–3 years',
    employmentType: 'Contract',
    location: 'Petaling Jaya',
    salaryMin: '4500',
    salaryMax: '6200',
    jobStatus: 'Draft',
    postedDate: '2026-08-15',
    postedDateLabel: '15 Aug 2026',
    closingDate: '2026-09-10',
    closingDateLabel: '10 Sep 2026',
    applicants: 0,
    requiredSkills: nexaSkills.ba,
  },
  {
    id: 'uiux-designer',
    companyName: 'Nexa Digital',
    jobTitle: 'UI/UX Designer',
    jobDescription:
      'Design clear screens for internal reporting tools. The role covers wireframes, usability notes and collaboration with product and engineering.',
    qualificationRequired: "Diploma or Bachelor's Degree in Design, HCI or a related field",
    experienceRequired: '1–2 years',
    employmentType: 'Full-Time',
    location: 'Kuala Lumpur',
    salaryMin: '4200',
    salaryMax: '6000',
    jobStatus: 'Active',
    postedDate: '2026-08-08',
    postedDateLabel: '8 Aug 2026',
    closingDate: '2026-09-02',
    closingDateLabel: '2 Sep 2026',
    applicants: 7,
    requiredSkills: nexaSkills.design,
  },
]

export function getEmployerJob(jobId) {
  return employerJobs.find((job) => job.id === jobId)
}

export function formatSalaryRange(job) {
  if (!job?.salaryMin && !job?.salaryMax) {
    return 'Not specified'
  }

  return `RM ${job.salaryMin} – RM ${job.salaryMax}`
}
