import { NavLink } from 'react-router-dom'
import { LayoutDashboard, User, FolderKanban, Settings } from 'lucide-react'
import BrandMark from '../common/BrandMark.jsx'
import Avatar from '../common/Avatar.jsx'
import { cn } from '../../utils/cn.js'

const placeholderNav = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Profile', icon: User, active: false },
  { label: 'Example Section', icon: FolderKanban, active: false },
  { label: 'Settings', icon: Settings, active: false },
]

function navClass(isActive) {
  return cn(
    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors duration-150 no-underline',
    'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
    isActive ? 'bg-soft font-medium text-primary-dark' : 'text-muted hover:bg-page hover:text-ink',
  )
}

function Sidebar({
  open,
  onClose,
  userName = 'Alex Tan',
  userRole = 'Preview user',
  items = placeholderNav,
  settingsTo,
  brandTo = '/',
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={cn(
          'fixed inset-0 z-30 bg-ink/25 transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-line bg-surface transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center px-5">
          <BrandMark to={brandTo} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon

              return (
                <li key={item.label}>
                  {item.to ? (
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) => navClass(isActive)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  ) : (
                    <button
                      type="button"
                      className={navClass(item.active)}
                      aria-current={item.active ? 'page' : undefined}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {item.label}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-line px-3 py-3">
          {settingsTo ? (
            <NavLink to={settingsTo} onClick={onClose} className={({ isActive }) => navClass(isActive)}>
              <Settings size={18} aria-hidden="true" />
              Settings
            </NavLink>
          ) : null}

          <div className="mt-3 flex items-center gap-3 px-1 py-1">
            <Avatar name={userName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{userName}</p>
              <p className="truncate text-xs text-muted">{userRole}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
