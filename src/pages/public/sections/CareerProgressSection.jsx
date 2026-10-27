import MediaImage from '../../../components/common/MediaImage.jsx'
import Section from '../../../components/layout/Section.jsx'
import { images } from '../../../data/images.js'

function CareerProgressSection() {
  return (
    <Section>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <MediaImage
          src={images.careerProgress.src}
          alt={images.careerProgress.alt}
          aspect="4/3"
          className="min-w-0"
        />
        <div className="min-w-0">
          <p className="po-secondary">Career progress</p>
          <h2 className="po-page-title mt-2">Keep skills, learning and opportunities in view</h2>
          <p className="po-body mt-4 text-muted">
            PeaceOne is designed as a structured career workspace. Students and job seekers can
            see their skills, career target, learning and applications together, while company
            staff and administrators use related recruitment and platform screens.
          </p>
          <p className="po-secondary mt-4">
            The prototype presents these steps in a consistent interface so the career journey is
            easier to understand and continue.
          </p>
        </div>
      </div>
    </Section>
  )
}

export default CareerProgressSection
