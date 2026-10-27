import Button from '../../../components/common/Button.jsx'
import Section from '../../../components/layout/Section.jsx'

function FinalCtaSection() {
  return (
    <Section>
      <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center shadow-[var(--shadow-card)] sm:px-10">
        <h2 className="po-page-title">Your next career step starts here.</h2>
        <p className="po-secondary mx-auto mt-3 max-w-xl">
          Create a PeaceOne account to start organising your skills, learning and opportunities
          in one place.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button to="/register" size="lg" className="w-full sm:w-auto">
            Create an Account
          </Button>
          <Button to="/jobs" variant="secondary" size="lg" className="w-full sm:w-auto">
            Explore Opportunities
          </Button>
        </div>
      </div>
    </Section>
  )
}

export default FinalCtaSection
