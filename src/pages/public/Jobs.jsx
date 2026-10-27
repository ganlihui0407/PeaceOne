import { useMemo, useState } from 'react'
import Button from '../../components/common/Button.jsx'
import JobCard from '../../components/cards/JobCard.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import { employmentTypes, experienceLevels, jobs } from '../../data/jobs.js'

function Jobs() {
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const [employmentType, setEmploymentType] = useState('All')
  const [experienceLevel, setExperienceLevel] = useState('All')
  const [applied, setApplied] = useState({
    keyword: '',
    location: '',
  })

  const results = useMemo(() => {
    return jobs.filter((job) => {
      const haystack = `${job.title} ${job.company}`.toLowerCase()
      const keywordOk =
        !applied.keyword || haystack.includes(applied.keyword.trim().toLowerCase())
      const locationOk =
        !applied.location || job.location.toLowerCase().includes(applied.location.trim().toLowerCase())
      const typeOk = employmentType === 'All' || job.employmentType === employmentType
      const levelOk = experienceLevel === 'All' || job.experienceLevel === experienceLevel

      return keywordOk && locationOk && typeOk && levelOk
    })
  }, [applied, employmentType, experienceLevel])

  function handleSearch(event) {
    event.preventDefault()
    setApplied({ keyword, location })
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="po-page-title">Explore Opportunities</h1>
      <p className="po-secondary mt-2 max-w-2xl">
        Browse current roles on PeaceOne and find opportunities that match your direction.
      </p>

      <form
        className="mt-8 grid gap-4 rounded-xl border border-line bg-surface p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
        onSubmit={handleSearch}
      >
        <SearchInput
          id="job-keyword"
          label="Job title / keyword"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Software developer"
        />
        <TextInput
          id="job-location"
          label="Location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Kuala Lumpur"
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full shrink-0 md:w-auto">
            Search
          </Button>
        </div>
      </form>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <SelectInput
          id="employment-type"
          label="Employment Type"
          value={employmentType}
          onChange={(event) => setEmploymentType(event.target.value)}
          options={employmentTypes.map((value) => ({ value, label: value }))}
        />
        <SelectInput
          id="experience-level"
          label="Experience Level"
          value={experienceLevel}
          onChange={(event) => setExperienceLevel(event.target.value)}
          options={experienceLevels.map((value) => ({ value, label: value }))}
        />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {results.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="No roles match these search details yet."
          description="Try a different keyword, location or filter."
        />
      ) : null}
    </section>
  )
}

export default Jobs
