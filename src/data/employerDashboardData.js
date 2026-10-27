import { recentEmployerApplications } from './applicants.js'
import { employerJobs } from './employerJobs.js'
import { upcomingEmployerInterviews } from './employerInterviews.js'

export const employerDashboard = {
  heading: 'Recruitment Overview',
  support: 'Manage your vacancies, candidates and upcoming interviews from one place.',
  stats: [
    { label: 'Active Job Postings', value: '8' },
    { label: 'Total Applicants', value: '42' },
    { label: 'Shortlisted', value: '9' },
    { label: 'Upcoming Interviews', value: '4' },
  ],
  activeJobs: employerJobs.filter((job) => job.jobStatus === 'Active'),
  recentApplications: recentEmployerApplications,
  upcomingInterviews: upcomingEmployerInterviews.slice(0, 4),
}
