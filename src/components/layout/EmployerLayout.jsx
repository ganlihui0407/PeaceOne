import { Outlet, useLocation } from 'react-router-dom'
import AppLayout from './AppLayout.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { roleLabels } from '../../auth/rolePaths.js'
import { employerNav } from '../../data/navigation.js'

function getPageTitle(pathname) {
  if (pathname.endsWith('/jobs/create')) return 'Create Job Posting'
  if (pathname.includes('/jobs/') && pathname.endsWith('/edit')) return 'Edit Job Posting'
  if (pathname.endsWith('/interviews/create')) return 'Schedule Interview'
  if (pathname.includes('/interviews/') && pathname.endsWith('/edit')) return 'Update Interview'
  if (/\/interviews\/[^/]+$/.test(pathname)) return 'Interview details'
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
  const { user } = useAuth()

  return (
    <AppLayout
      title={getPageTitle(pathname)}
      userName={user?.fullName || 'PeaceOne user'}
      userRole={roleLabels[user?.role] || 'Company Staff'}
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
