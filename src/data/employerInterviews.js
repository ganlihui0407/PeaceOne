export const interviewMethods = ['Online', 'On-site', 'Phone']

export const interviewStatuses = ['Scheduled', 'Completed', 'Cancelled']

export const employerInterviewSummary = [
  { label: 'Scheduled', value: '4' },
  { label: 'Completed', value: '8' },
  { label: 'Cancelled', value: '1' },
]

export const employerInterviews = [
  {
    id: 'iv-daniel-lee',
    candidate: 'Daniel Lee',
    applicationId: 'daniel-lee',
    jobTitle: 'Data Analyst',
    interviewDate: '2026-08-28',
    interviewDateLabel: '28 Aug 2026',
    interviewTime: '10:30',
    interviewTimeLabel: '10:30 AM',
    method: 'Online',
    locationOrLink: 'Microsoft Teams',
    interviewStatus: 'Scheduled',
    notes: 'Prepare examples of reporting work and SQL experience.',
  },
  {
    id: 'iv-nur-izzati',
    candidate: 'Nur Izzati',
    applicationId: 'nur-izzati',
    jobTitle: 'Data Analyst',
    interviewDate: '2026-08-29',
    interviewDateLabel: '29 Aug 2026',
    interviewTime: '14:00',
    interviewTimeLabel: '2:00 PM',
    method: 'On-site',
    locationOrLink: 'Meeting Room A',
    interviewStatus: 'Scheduled',
    notes: 'On-site discussion with the reporting team.',
  },
  {
    id: 'iv-aisha-rahman',
    candidate: 'Aisha Rahman',
    applicationId: 'aisha-rahman',
    jobTitle: 'Data Analyst',
    interviewDate: '2026-09-01',
    interviewDateLabel: '1 Sep 2026',
    interviewTime: '11:00',
    interviewTimeLabel: '11:00 AM',
    method: 'Online',
    locationOrLink: 'Google Meet',
    interviewStatus: 'Scheduled',
    notes: 'Follow-up conversation after application review.',
  },
  {
    id: 'iv-marcus-tan',
    candidate: 'Marcus Tan',
    applicationId: 'marcus-tan-developer',
    jobTitle: 'Junior Software Developer',
    interviewDate: '2026-09-02',
    interviewDateLabel: '2 Sep 2026',
    interviewTime: '15:30',
    interviewTimeLabel: '3:30 PM',
    method: 'Phone',
    locationOrLink: '013-220 8841',
    interviewStatus: 'Scheduled',
    notes: 'Short screening call before a technical conversation.',
  },
  {
    id: 'iv-completed',
    candidate: 'Wei Chen',
    applicationId: '',
    jobTitle: 'UI/UX Designer',
    interviewDate: '2026-08-12',
    interviewDateLabel: '12 Aug 2026',
    interviewTime: '09:30',
    interviewTimeLabel: '9:30 AM',
    method: 'Online',
    locationOrLink: 'Microsoft Teams',
    interviewStatus: 'Completed',
    notes: 'Completed introductory design conversation.',
  },
  {
    id: 'iv-cancelled',
    candidate: 'Hana Yusof',
    applicationId: '',
    jobTitle: 'Business Analyst',
    interviewDate: '2026-08-18',
    interviewDateLabel: '18 Aug 2026',
    interviewTime: '16:00',
    interviewTimeLabel: '4:00 PM',
    method: 'On-site',
    locationOrLink: 'Meeting Room B',
    interviewStatus: 'Cancelled',
    notes: 'Candidate requested to cancel before the session.',
  },
]

export const upcomingEmployerInterviews = employerInterviews.filter(
  (item) => item.interviewStatus === 'Scheduled',
)

export function getEmployerInterview(interviewId) {
  return employerInterviews.find((item) => item.id === interviewId)
}

export const interviewCandidateOptions = [
  'Daniel Lee',
  'Aisha Rahman',
  'Marcus Tan',
  'Nur Izzati',
]

export const interviewPositionOptions = [
  'Data Analyst',
  'Junior Software Developer',
  'Business Analyst',
  'UI/UX Designer',
]
