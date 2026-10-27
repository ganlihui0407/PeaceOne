import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import BrandMark from '../common/BrandMark.jsx'
import Button from '../common/Button.jsx'
import { cn } from '../../utils/cn.js'

const publicLinks = [
  { label: 'Home', to: '/', end: true },
  { label: 'Jobs', to: '/jobs' },
  { label: 'Learning', to: '/learning' },
  { label: 'About', to: '/about' },
]

function PublicHeader({ sticky = true }) {
  const [open, setOpen] = useState(false)

  return (
    <header className={cn(sticky && 'sticky top-0 z-30', 'border-b border-line bg-surface')}>
      <div className="mx-auto flex h-[72px] min-w-0 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandMark to="/" />

        <nav className="hidden min-w-0 items-center gap-6 md:flex lg:gap-8" aria-label="Public">
          {publicLinks.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'shrink-0 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
                  isActive ? 'text-primary' : 'text-muted hover:text-ink',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" to="/login">
            Login
          </Button>
          <Button variant="primary" size="sm" to="/register">
            Register
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink transition-colors duration-150 hover:bg-page focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div
        className={cn(
          'border-t border-line bg-surface px-4 py-4 sm:px-6 md:hidden',
          open ? 'block' : 'hidden',
        )}
      >
        <nav className="flex flex-col gap-1" aria-label="Public mobile">
          {publicLinks.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              end={link.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-2 py-2.5 text-sm font-medium',
                  isActive ? 'bg-soft text-primary' : 'text-ink hover:bg-page',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" to="/login" onClick={() => setOpen(false)}>
            Login
          </Button>
          <Button variant="primary" size="sm" className="flex-1" to="/register" onClick={() => setOpen(false)}>
            Register
          </Button>
        </div>
      </div>
    </header>
  )
}

export default PublicHeader
