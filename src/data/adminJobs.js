import { employerJobs, formatSalaryRange } from './employerJobs.js'
import { getCandidateJob } from './candidateJobs.js'

function fromEmployerJob(job, reviewStatus, reviewNotes = '') {
  return {
    ...job,
    reviewStatus,
    reviewNotes,
  }
}

function fromCandidateJob(job, extras) {
  return {
    id: job.id,
    companyName: job.company,
    jobTitle: job.jobTitle,
    jobDescription: job.jobDescription,
    qualificationRequired: job.qualificationRequired,
    experienceRequired: job.experienceRequired,
    employmentType: job.employmentType,
    location: job.location,
    salaryMin: String(job.salaryMin ?? ''),
    salaryMax: String(job.salaryMax ?? ''),
    jobStatus: extras.jobStatus,
    postedDateLabel: extras.postedDateLabel,
    closingDateLabel: job.closingDate,
    applicants: extras.applicants,
    requiredSkills: job.requiredSkills,
    reviewStatus: extras.reviewStatus,
    reviewNotes: extras.reviewNotes || '',
  }
}

const juniorAnalyst = getCandidateJob('junior-data-analyst')
const biIntern = getCandidateJob('bi-intern')
const graduateBa = getCandidateJob('graduate-ba')

export const jobReviewStatuses = ['All', 'Approved', 'Pending Review', 'Flagged']

export const adminJobs = [
  fromEmployerJob(employerJobs[0], 'Approved', 'Posting matches the approved job information.'),
  fromEmployerJob(employerJobs[1], 'Approved', 'Junior developer vacancy reviewed and kept active.'),
  fromEmployerJob(employerJobs[2], 'Pending Review', 'Draft posting has not been reviewed yet.'),
  fromEmployerJob(employerJobs[3], 'Flagged', 'Review the salary range and role description before keeping this live.'),
  juniorAnalyst
    ? fromCandidateJob(juniorAnalyst, {
        jobStatus: 'Active',
        postedDateLabel: '19 Aug 2026',
        applicants: 9,
        reviewStatus: 'Pending Review',
        reviewNotes: 'New posting waiting for a platform quality check.',
      })
    : null,
  biIntern
    ? fromCandidateJob(biIntern, {
        jobStatus: 'Active',
        postedDateLabel: '17 Aug 2026',
        applicants: 5,
        reviewStatus: 'Flagged',
        reviewNotes: 'Internship allowance wording may need a clearer review.',
      })
    : null,
  graduateBa
    ? fromCandidateJob(graduateBa, {
        jobStatus: 'Closed',
        postedDateLabel: '16 Aug 2026',
        applicants: 14,
        reviewStatus: 'Approved',
        reviewNotes: 'Closed posting previously approved.',
      })
    : null,
].filter(Boolean)

export const adminJobSummary = [
  { label: 'Total Job Postings', value: '238' },
  { label: 'Active', value: '174' },
  { label: 'Draft', value: '42' },
  { label: 'Closed', value: '18' },
  { label: 'Requiring Review', value: '4' },
]

export const adminJobCompanies = ['All', ...Array.from(new Set(adminJobs.map((job) => job.companyName)))]

export function getAdminJob(jobId) {
  return adminJobs.find((job) => job.id === jobId)
}

export { formatSalaryRange }
