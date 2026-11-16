import { useEffect, useState } from 'react'
import Button from '../../../components/common/Button.jsx'
import CourseCard from '../../../components/cards/CourseCard.jsx'
import QueryStatus from '../../../components/common/QueryStatus.jsx'
import Section from '../../../components/layout/Section.jsx'
import {
  fetchPublishedCourses,
  toPublicCourseCard,
  userFacingLearningError,
} from '../../../api/learning.js'

function FeaturedLearningSection() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    fetchPublishedCourses({ page: 1, limit: 4 })
      .then((payload) => setCourses(payload.courses ?? []))
      .catch((loadError) => {
        setCourses([])
        setError(userFacingLearningError(loadError))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

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
      <div className="mt-10">
        <QueryStatus
          loading={loading}
          error={error}
          empty={!loading && !error && courses.length === 0}
          loadingLabel="Loading published courses…"
          emptyTitle="No published courses yet."
          emptyDescription="When PeaceOne courses are published, they will appear here and on the Learning page."
          onRetry={load}
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={toPublicCourseCard(course)}
                to={`/learning/${course.id}`}
              />
            ))}
          </div>
        </QueryStatus>
      </div>
    </Section>
  )
}

export default FeaturedLearningSection
