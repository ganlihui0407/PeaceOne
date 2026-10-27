import { Link } from 'react-router-dom'
import BrandMark from '../common/BrandMark.jsx'

const exploreLinks = [
  { label: 'Home', to: '/' },
  { label: 'Jobs', to: '/jobs' },
  { label: 'Learning', to: '/learning' },
  { label: 'About', to: '/about' },
]

const accountLinks = [
  { label: 'Login', to: '/login' },
  { label: 'Register', to: '/register' },
]

function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="min-w-0 md:col-span-2 lg:col-span-1">
          <BrandMark />
          <p className="po-secondary mt-3 max-w-sm">
            PeaceOne is an AI-Powered Career Development Platform that helps students, job seekers,
            company staff and administrators organise skills, learning and employment opportunities
            in one workspace.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Explore</p>
          <ul className="mt-3 space-y-2">
            {exploreLinks.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="po-secondary hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Account</p>
          <ul className="mt-3 space-y-2">
            {accountLinks.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="po-secondary hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Legal</p>
          <ul className="mt-3 space-y-2">
            <li>
              <a href="#privacy" className="po-secondary hover:text-ink">
                Privacy
              </a>
            </li>
            <li>
              <a href="#terms" className="po-secondary hover:text-ink">
                Terms
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-muted sm:px-6">
          © {new Date().getFullYear()} PeaceOne. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer
