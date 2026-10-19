import Button from '../../../components/common/Button.jsx'
import MediaImage from '../../../components/common/MediaImage.jsx'
import { images } from '../../../data/images.js'

const audiences = ['Students', 'Job Seekers', 'Company Staff', 'Administrators']

function HeroSection() {
  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="min-w-0">
          <p className="po-label mb-3 text-primary">AI-Powered Career Development Platform</p>
          <h1 className="po-display">Build the skills. Find the opportunity. Shape your career.</h1>
          <p className="po-body mt-5 max-w-xl text-muted">
            PeaceOne brings skills, learning, job opportunities and applications into one
            professional workspace for students, job seekers, company staff and administrators.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {audiences.map((item) => (
              <li
                key={item}
                className="rounded-md bg-soft px-2.5 py-1 text-xs font-medium text-primary-dark"
              >
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button to="/register" size="lg" className="w-full sm:w-auto">
              Get Started
            </Button>
            <Button to="/jobs" variant="secondary" size="lg" className="w-full sm:w-auto">
              Explore Jobs
            </Button>
          </div>
        </div>
        <MediaImage src={images.hero.src} alt={images.hero.alt} aspect="4/3" className="min-w-0" />
      </div>
    </section>
  )
}

export default HeroSection
