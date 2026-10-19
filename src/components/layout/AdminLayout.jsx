import { Outlet, useLocation } from 'react-router-dom'
import AppLayout from './AppLayout.jsx'
import { adminProfile } from '../../data/users.js'
import { adminNav } from '../../data/navigation.js'

function getPageTitle(pathname) {
  if (pathname.endsWith('/learning/create')) return 'Create Learning Content'
  if (pathname.includes('/learning/') && pathname.endsWith('/edit')) return 'Edit Learning Content'
  if (/\/users\/[^/]+$/.test(pathname)) return 'User Details'
  if (/\/jobs\/[^/]+$/.test(pathname)) return 'Job Moderation'

  const titles = {
    dashboard: 'Dashboard',
    users: 'User Management',
    jobs: 'Job Monitoring',
    learning: 'Learning Content',
    content: 'Content Monitoring',
    reports: 'Reports & Analysis',
    notifications: 'Notifications',
    profile: 'My Profile',
    settings: 'Settings',
  }

  const segment = pathname.split('/').filter(Boolean).pop()
  return titles[segment] || 'PeaceOne'
}

function AdminLayout() {
  const { pathname } = useLocation()

  return (
    <AppLayout
      title={getPageTitle(pathname)}
      userName={adminProfile.fullName}
      userRole={adminProfile.role}
      navItems={adminNav}
      settingsTo="/admin/settings"
      notificationTo="/admin/notifications"
      brandTo="/admin/dashboard"
    >
      <Outlet />
    </AppLayout>
  )
}

export default AdminLayout
