import Card from '../../components/cards/Card.jsx'
import MediaImage from '../../components/common/MediaImage.jsx'
import Section from '../../components/layout/Section.jsx'
import { images } from '../../data/images.js'

const roles = [
  {
    title: 'Student / Job Seeker',
    text: 'Build a skill profile, follow relevant learning, and prepare for internships or graduate pathways. Current Position can be Student or Job Seeker.',
  },
  {
    title: 'Company Staff',
    text: 'Share openings, review applicants and organise interviews from a recruitment workspace.',
  },
  {
    title: 'Admin',
    text: 'Oversee users, job postings, learning content and platform reports.',
  },
]

function About() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div className="min-w-0">
            <p className="po-secondary">About PeaceOne</p>
            <h1 className="po-page-title mt-2">Skills → Learning → Career Opportunities</h1>
            <p className="po-body mt-4 text-muted">
              PeaceOne is an AI-Powered Career Development Platform designed to help students and
              job seekers understand their capabilities, follow related learning, and move toward
              suitable employment opportunities. Company staff and administrators use the same
              platform to organise recruitment and content.
            </p>
          </div>
          <MediaImage src={images.about.src} alt={images.about.alt} aspect="4/3" className="min-w-0" />
        </div>
      </section>

      <Section>
        <h2 className="po-page-title">Why PeaceOne</h2>
        <p className="po-body mt-3 max-w-3xl text-muted">
          Career planning often splits across separate tools for CVs, courses and job boards.
          PeaceOne brings those steps into one professional workspace so progress is easier to
          see and easier to continue.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.title} className="h-full">
              <h3 className="po-card-title">{role.title}</h3>
              <p className="po-secondary mt-2">{role.text}</p>
            </Card>
          ))}
        </div>
      </Section>
    </>
  )
}

export default About
