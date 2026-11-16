import { useMemo, useState } from 'react'
import Button from '../../components/common/Button.jsx'
import JobCard from '../../components/cards/JobCard.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  CANDIDATE_EMPLOYMENT_TYPE_OPTIONS,
  JOB_LIST_LIMIT,
  fetchPublishedJobs,
  toPublicJobCard,
  userFacingPublishedJobError,
} from '../../api/jobs.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

function Jobs() {
  const [companyInput, setCompanyInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [employmentTypeInput, setEmploymentTypeInput] = useState('')
  const [appliedCompany, setAppliedCompany] = useState('')
  const [appliedLocation, setAppliedLocation] = useState('')
  const [appliedEmploymentType, setAppliedEmploymentType] = useState('')
  const extraParams = useMemo(
    () => ({
      company: appliedCompany || undefined,
      location: appliedLocation || undefined,
      employmentType: appliedEmploymentType || undefined,
    }),
    [appliedCompany, appliedEmploymentType, appliedLocation],
  )
  const list = useEscoPagedSearch(fetchPublishedJobs, {
    limit: JOB_LIST_LIMIT,
    extraParams,
    formatError: userFacingPublishedJobError,
  })

  const hasFilters = Boolean(
    list.input
      || list.query
      || companyInput
      || appliedCompany
      || locationInput
      || appliedLocation
      || employmentTypeInput
      || appliedEmploymentType,
  )

  function handleSearch(event) {
    event.preventDefault()
    setAppliedCompany(companyInput.trim())
    setAppliedLocation(locationInput.trim())
    setAppliedEmploymentType(employmentTypeInput)
    list.search(event)
  }

  function clearFilters() {
    setCompanyInput('')
    setLocationInput('')
    setEmploymentTypeInput('')
    setAppliedCompany('')
    setAppliedLocation('')
    setAppliedEmploymentType('')
    list.resetSearch()
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="po-page-title">Explore Opportunities</h1>
      <p className="po-secondary mt-2 max-w-2xl">
        Browse published PeaceOne vacancies from employer accounts. Unpublished, suspended and closed jobs are not listed.
      </p>

      <form
        className="mt-8 grid gap-4 rounded-xl border border-line bg-surface p-5 md:grid-cols-2 xl:grid-cols-12"
        onSubmit={handleSearch}
      >
        <div className="xl:col-span-3">
          <SearchInput
            id="job-keyword"
            label="Job title"
            value={list.input}
            onChange={(event) => list.setInput(event.target.value)}
            placeholder="Software developer"
          />
        </div>
        <div className="xl:col-span-3">
          <TextInput
            id="job-company"
            label="Company"
            value={companyInput}
            onChange={(event) => setCompanyInput(event.target.value)}
            placeholder="TechCorp"
          />
        </div>
        <div className="xl:col-span-3">
          <TextInput
            id="job-location"
            label="Location"
            value={locationInput}
            onChange={(event) => setLocationInput(event.target.value)}
            placeholder="Kuala Lumpur"
          />
        </div>
        <div className="xl:col-span-3">
          <SelectInput
            id="employment-type"
            label="Employment type"
            value={employmentTypeInput}
            onChange={(event) => setEmploymentTypeInput(event.target.value)}
            options={CANDIDATE_EMPLOYMENT_TYPE_OPTIONS}
          />
        </div>
        <div className="flex flex-col justify-end gap-2 sm:flex-row md:col-span-2 xl:col-span-12">
          <Button type="submit" className="w-full sm:w-auto" disabled={list.loading}>
            Search
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={list.loading || !hasFilters}
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        </div>
      </form>

      <div className="mt-8">
        <QueryStatus
          loading={list.loading}
          error={list.error}
          empty={!list.loading && !list.error && list.items.length === 0}
          loadingLabel="Loading published jobs…"
          emptyTitle="No published jobs match these search details yet."
          emptyDescription="Try a different keyword, location or employment type. Draft, suspended and closed vacancies stay hidden."
          onRetry={list.retry}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            {list.items.map((job) => (
              <JobCard key={job.id} job={toPublicJobCard(job)} to={`/jobs/${job.id}`} />
            ))}
          </div>
          <PaginationBar
            page={list.meta.page}
            totalPages={list.meta.totalPages}
            total={list.meta.total}
            noun="jobs"
            disabled={list.loading}
            onPrevious={() => list.goToPage(list.page - 1)}
            onNext={() => list.goToPage(list.page + 1)}
          />
        </QueryStatus>
      </div>
    </section>
  )
}

export default Jobs
