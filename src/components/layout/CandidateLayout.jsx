import { Outlet, useLocation } from 'react-router-dom'
import AppLayout from './AppLayout.jsx'
import { studentProfile, jobSeekerProfile } from '../../data/candidateData.js'
import { jobSeekerNav, studentNav } from '../../data/navigation.js'

const pageTitles = {
  dashboard: 'Dashboard',
  profile: 'My Profile',
  skills: 'My Skills',
  'career-target': 'Career Target',
  'skill-gap': 'Skill Gap Analysis',
  learning: 'Learning',
  progress: 'Learning Progress',
  jobs: 'Jobs',
  applications: 'Applications',
  interviews: 'Interviews',
  notifications: 'Notifications',
  settings: 'Settings',
  resume: 'My Resume',
  apply: 'Apply',
}

function getPageTitle(pathname) {
  if (pathname.includes('/learning/progress')) return 'Learning Progress'
  if (/\/learning\/[^/]+$/.test(pathname)) return 'Learning'
  if (pathname.endsWith('/apply')) return 'Apply'
  if (/\/jobs\/[^/]+$/.test(pathname)) return 'Job Details'
  const segment = pathname.split('/').filter(Boolean).pop()
  return pageTitles[segment] || 'PeaceOne'
}

function CandidateLayout({ role }) {
  const { pathname } = useLocation()
  const isStudent = role === 'student'
  const profile = isStudent ? studentProfile : jobSeekerProfile
  const base = isStudent ? '/student' : '/jobseeker'

  return (
    <AppLayout
      title={getPageTitle(pathname)}
      userName={profile.fullName}
      userRole={profile.currentPosition}
      navItems={isStudent ? studentNav : jobSeekerNav}
      settingsTo={`${base}/settings`}
      notificationTo={`${base}/notifications`}
      brandTo={`${base}/dashboard`}
    >
      <Outlet />
    </AppLayout>
  )
}

export default CandidateLayout
