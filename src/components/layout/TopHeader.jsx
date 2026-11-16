import { Menu } from 'lucide-react'
import Avatar from '../common/Avatar.jsx'
import NotificationBell from '../notifications/NotificationBell.jsx'

function TopHeader({
  title = 'Dashboard',
  onMenuClick,
  userName = 'Alex Tan',
  userRole,
  notificationTo,
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 min-w-0 items-center gap-3 border-b border-line bg-surface px-4 lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink transition-colors duration-150 hover:bg-page focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
      </div>

      <NotificationBell centreTo={notificationTo} />

      <div className="flex items-center gap-2">
        <Avatar name={userName} size="sm" />
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-medium text-ink">{userName}</p>
          {userRole ? <p className="truncate text-xs text-muted">{userRole}</p> : null}
        </div>
      </div>
    </header>
  )
}

export default TopHeader
