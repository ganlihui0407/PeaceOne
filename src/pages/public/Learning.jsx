import { useMemo, useState } from 'react'
import Button from '../../components/common/Button.jsx'
import CourseCard from '../../components/cards/CourseCard.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import { cn } from '../../utils/cn.js'
import {
  LEARNING_CATEGORIES,
  LEARNING_LIST_LIMIT,
  fetchPublishedCourseCatalog,
  toPublicCourseCard,
  userFacingLearningError,
} from '../../api/learning.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

function Learning() {
  const [category, setCategory] = useState('')
  const extraParams = useMemo(
    () => (category ? { category } : {}),
    [category],
  )
  const list = useEscoPagedSearch(fetchPublishedCourseCatalog, {
    limit: LEARNING_LIST_LIMIT,
    extraParams,
    formatError: userFacingLearningError,
  })

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="po-page-title">Explore Learning</h1>
      <p className="po-secondary mt-2 max-w-2xl">
        Browse published PeaceOne demonstration courses. Sign in as a student or job seeker to enrol and save progress.
      </p>

      <form
        className="mt-8 grid gap-4 rounded-xl border border-line bg-surface p-5 md:grid-cols-[1fr_auto]"
        onSubmit={list.search}
      >
        <SearchInput
          id="learning-search"
          label="Search learning"
          value={list.input}
          onChange={(event) => list.setInput(event.target.value)}
          placeholder="SQL, React, cybersecurity"
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full shrink-0 md:w-auto" disabled={list.loading}>
            Search
          </Button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {LEARNING_CATEGORIES.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setCategory(item.value)}
            className={cn(
              'h-9 rounded-md px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
              category === item.value
                ? 'bg-primary text-white'
                : 'border border-line bg-surface text-ink hover:bg-page',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <QueryStatus
          loading={list.loading}
          error={list.error}
          empty={!list.loading && !list.error && list.items.length === 0}
          loadingLabel="Loading published courses…"
          emptyTitle="No published courses match this search yet."
          emptyDescription="Try another keyword or category. Draft and archived courses stay hidden."
          onRetry={list.retry}
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {list.items.map((course) => (
              <CourseCard
                key={course.id}
                course={toPublicCourseCard(course)}
                to={`/learning/${course.id}`}
              />
            ))}
          </div>
          <PaginationBar
            page={list.meta.page}
            totalPages={list.meta.totalPages}
            total={list.meta.total}
            noun="courses"
            disabled={list.loading}
            onPrevious={() => list.goToPage(list.page - 1)}
            onNext={() => list.goToPage(list.page + 1)}
          />
        </QueryStatus>
      </div>
    </section>
  )
}

export default Learning
