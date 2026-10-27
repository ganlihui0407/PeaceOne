import { useMemo, useState } from 'react'
import Button from '../../components/common/Button.jsx'
import CourseCard from '../../components/cards/CourseCard.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import { cn } from '../../utils/cn.js'
import { courseCategories, courses } from '../../data/courses.js'

function Learning() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [appliedQuery, setAppliedQuery] = useState('')

  const results = useMemo(() => {
    return courses.filter((course) => {
      const categoryOk = category === 'All' || course.category === category
      const queryOk =
        !appliedQuery ||
        `${course.title} ${course.description}`.toLowerCase().includes(appliedQuery.trim().toLowerCase())

      return categoryOk && queryOk
    })
  }, [appliedQuery, category])

  function handleSearch(event) {
    event.preventDefault()
    setAppliedQuery(query)
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="po-page-title">Explore Learning</h1>
      <p className="po-secondary mt-2 max-w-2xl">
        Browse learning content related to skills, communication and career preparation.
      </p>

      <form
        className="mt-8 grid gap-4 rounded-xl border border-line bg-surface p-5 md:grid-cols-[1fr_auto]"
        onSubmit={handleSearch}
      >
        <SearchInput
          id="learning-search"
          label="Search learning"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Python, communication, interviews"
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full shrink-0 md:w-auto">
            Search
          </Button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {courseCategories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={cn(
              'h-9 rounded-md px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
              category === item
                ? 'bg-primary text-white'
                : 'border border-line bg-surface text-ink hover:bg-page',
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {results.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="No learning resources match this search yet."
          description="Try another keyword or choose a different category."
        />
      ) : null}
    </section>
  )
}

export default Learning
