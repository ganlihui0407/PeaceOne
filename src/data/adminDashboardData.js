export const adminDashboard = {
  heading: 'Platform Overview',
  support: 'Monitor users, job postings, learning content and activity across PeaceOne.',
  stats: [
    { label: 'Total Users', value: '1,248' },
    { label: 'Company Staff', value: '86' },
    { label: 'Active Job Postings', value: '174' },
    { label: 'Learning Content', value: '92' },
  ],
  reviewStats: [
    { label: 'Pending User Reviews', value: '6' },
    { label: 'Jobs Requiring Review', value: '4' },
    { label: 'Content Requiring Review', value: '3' },
  ],
  activity: [
    {
      id: 'act-1',
      activity: 'New Company Staff account registered',
      actor: 'Nexa Digital',
      time: 'Today, 9:18 AM',
      type: 'Registration',
    },
    {
      id: 'act-2',
      activity: 'New Data Analyst job posted by Nexa Digital',
      actor: 'Nexa Digital',
      time: 'Today, 8:42 AM',
      type: 'Job Posting',
    },
    {
      id: 'act-3',
      activity: 'Learning content updated',
      actor: 'PeaceOne Library',
      time: 'Yesterday, 4:15 PM',
      type: 'Learning',
    },
    {
      id: 'act-4',
      activity: 'User position-change request submitted',
      actor: 'Emily Tan',
      time: '20 Aug 2026, 2:05 PM',
      type: 'Pending Review',
    },
  ],
  shortcuts: [
    { label: 'Manage Users', to: '/admin/users' },
    { label: 'Review Jobs', to: '/admin/jobs' },
    { label: 'Manage Learning Content', to: '/admin/learning' },
    { label: 'View Reports', to: '/admin/reports' },
  ],
}
