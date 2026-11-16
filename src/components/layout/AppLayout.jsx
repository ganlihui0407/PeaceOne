import { useState } from 'react'
import Sidebar from './Sidebar.jsx'
import SkipLink from './SkipLink.jsx'
import TopHeader from './TopHeader.jsx'

function AppLayout({
  title,
  userName = 'Alex Tan',
  userRole,
  navItems,
  settingsTo,
  notificationTo,
  brandTo = '/',
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-page">
      <SkipLink />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userName={userName}
        userRole={userRole}
        items={navItems}
        settingsTo={settingsTo}
        brandTo={brandTo}
      />

      <div className="min-w-0 lg:pl-[260px]">
        <TopHeader
          title={title}
          userName={userName}
          userRole={userRole}
          notificationTo={notificationTo}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main id="main-content" tabIndex={-1} className="min-w-0">{children}</main>
      </div>
    </div>
  )
}

export default AppLayout
