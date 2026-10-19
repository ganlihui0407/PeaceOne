import { Outlet, useLocation } from 'react-router-dom'
import AppLayout from './AppLayout.jsx'
import { employerStaff } from '../../data/employerStaff.js'
import { employerNav } from '../../data/navigation.js'

function getPageTitle(pathname) {
  if (pathname.endsWith('/jobs/create')) return 'Create Job Posting'
  if (pathname.includes('/jobs/') && pathname.endsWith('/edit')) return 'Edit Job Posting'
  if (pathname.endsWith('/interviews/create')) return 'Schedule Interview'
  if (pathname.includes('/interviews/') && pathname.endsWith('/edit')) return 'Edit Interview'
  if (/\/applicants\/[^/]+$/.test(pathname)) return 'Applicant Details'
  if (/\/jobs\/[^/]+$/.test(pathname)) return 'Job Posting'

  const titles = {
    dashboard: 'Dashboard',
    company: 'Company Profile',
    profile: 'My Profile',
    jobs: 'Manage Job Postings',
    applicants: 'Applicants',
    interviews: 'Interview Management',
    notifications: 'Notifications',
    settings: 'Settings',
  }

  const segment = pathname.split('/').filter(Boolean).pop()
  return titles[segment] || 'PeaceOne'
}

function EmployerLayout() {
  const { pathname } = useLocation()

  return (
    <AppLayout
      title={getPageTitle(pathname)}
      userName={employerStaff.fullName}
      userRole={employerStaff.position}
      navItems={employerNav}
      settingsTo="/employer/settings"
      notificationTo="/employer/notifications"
      brandTo="/employer/dashboard"
    >
      <Outlet />
    </AppLayout>
  )
}

export default EmployerLayout
