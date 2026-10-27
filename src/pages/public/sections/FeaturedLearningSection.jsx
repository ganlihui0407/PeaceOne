import Button from '../../../components/common/Button.jsx'
import CourseCard from '../../../components/cards/CourseCard.jsx'
import Section from '../../../components/layout/Section.jsx'
import { courses } from '../../../data/courses.js'

function FeaturedLearningSection() {
  return (
    <Section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="po-secondary">Learning</p>
          <h2 className="po-page-title mt-2">Learn the skills that support your next role</h2>
        </div>
        <Button to="/learning" variant="secondary" className="shrink-0">
          Explore Learning
        </Button>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {courses.slice(0, 4).map((course) => (
          <CourseCard key={course.id} course={course} to="/learning" />
        ))}
      </div>
    </Section>
  )
}

export default FeaturedLearningSection
