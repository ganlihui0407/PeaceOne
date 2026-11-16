import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Badge from '../../components/common/Badge.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import {
  CANDIDATE_EMPLOYMENT_TYPE_OPTIONS,
  JOB_LIST_LIMIT,
  candidateJobPath,
  fetchPublishedJobs,
  formatEmploymentType,
  formatJobDate,
  formatSalaryRange,
  userFacingPublishedJobError,
} from '../../api/jobs.js'
import {
  canComputeJobSkillOverlap,
  compareJobSkillOverlap,
  formatRecordedSkillOverlap,
} from '../../api/jobSkillMatch.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'
import { useRecordedSkills } from '../../hooks/useRecordedSkills.js'
import { compactSearchParams, parsePositivePage } from '../../lib/listSearchParams.js'

function PublishedJobCard({ job, to, overlapLabel }) {
  return (
    <Card className="h-full">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="po-card-title">{job.title}</h2>
          <p className="po-secondary mt-1">
            {job.company.companyName}
            {job.company.industry ? ` · ${job.company.industry}` : ''}
          </p>
        </div>
        <Badge tone="primary">{formatEmploymentType(job.employmentType)}</Badge>
      </div>
      <dl className="po-secondary mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="po-helper mt-0">Location</dt>
          <dd className="mt-1 font-medium text-ink">{job.location}</dd>
        </div>
        <div>
          <dt className="po-helper mt-0">Salary</dt>
          <dd className="mt-1 font-medium text-ink">{formatSalaryRange(job)}</dd>
        </div>
        <div>
          <dt className="po-helper mt-0">Published</dt>
          <dd className="mt-1 font-medium text-ink">{formatJobDate(job.publishedAt)}</dd>
        </div>
        <div>
          <dt className="po-helper mt-0">Closing date</dt>
          <dd className="mt-1 font-medium text-ink">{formatJobDate(job.closesAt)}</dd>
        </div>
      </dl>
      {overlapLabel ? <p className="po-helper mt-4">{overlapLabel}</p> : null}
      <div className="mt-5">
        <Button to={to} variant="secondary">
          View Details
        </Button>
      </div>
    </Card>
  )
}

function overlapLabelForJob(job, candidateSkills) {
  if (!canComputeJobSkillOverlap(candidateSkills) || !job.requiredSkills?.length) {
    return null
  }
  const comparison = compareJobSkillOverlap(job.requiredSkills, candidateSkills)
  return formatRecordedSkillOverlap(comparison.overlapPercent)
}

function CandidateJobsPage({ basePath, variant = 'student' }) {
  const isJobSeeker = variant === 'jobseeker'
  const recordedSkills = useRecordedSkills()
  const [searchParams, setSearchParams] = useSearchParams()
  const appliedQuery = searchParams.get('q') || ''
  const appliedCompany = searchParams.get('company') || ''
  const appliedLocation = searchParams.get('location') || ''
  const appliedIndustry = searchParams.get('industry') || ''
  const appliedEmploymentType = searchParams.get('employmentType') || ''
  const appliedPage = parsePositivePage(searchParams.get('page'))
  const [companyInput, setCompanyInput] = useState(appliedCompany)
  const [locationInput, setLocationInput] = useState(appliedLocation)
  const [industryInput, setIndustryInput] = useState(appliedIndustry)
  const [employmentTypeInput, setEmploymentTypeInput] = useState(appliedEmploymentType)

  useEffect(() => {
    setCompanyInput(appliedCompany)
    setLocationInput(appliedLocation)
    setIndustryInput(appliedIndustry)
    setEmploymentTypeInput(appliedEmploymentType)
  }, [appliedCompany, appliedEmploymentType, appliedIndustry, appliedLocation])

  const extraParams = useMemo(() => {
    const extra = {}
    if (appliedCompany) extra.company = appliedCompany
    if (appliedLocation) extra.location = appliedLocation
    if (appliedIndustry) extra.industry = appliedIndustry
    if (appliedEmploymentType) extra.employmentType = appliedEmploymentType
    return extra
  }, [appliedCompany, appliedEmploymentType, appliedIndustry, appliedLocation])

  const list = useEscoPagedSearch(fetchPublishedJobs, {
    limit: JOB_LIST_LIMIT,
    extraParams,
    formatError: userFacingPublishedJobError,
    appliedQuery,
    appliedPage,
  })

  function writeParams(values) {
    setSearchParams(compactSearchParams(values))
  }

  const hasFilters = Boolean(
    list.input
      || list.query
      || companyInput
      || appliedCompany
      || locationInput
      || appliedLocation
      || industryInput
      || appliedIndustry
      || employmentTypeInput
      || appliedEmploymentType,
  )
  const hasActiveSearch = Boolean(
    list.query || appliedCompany || appliedLocation || appliedIndustry || appliedEmploymentType,
  )

  function applyFilters(event) {
    event.preventDefault()
    writeParams({
      q: list.input.trim(),
      company: companyInput.trim(),
      location: locationInput.trim(),
      industry: industryInput.trim(),
      employmentType: employmentTypeInput,
      page: 1,
    })
  }

  function clearFilters() {
    setCompanyInput('')
    setLocationInput('')
    setIndustryInput('')
    setEmploymentTypeInput('')
    setSearchParams({})
  }

  return (
    <PageContent
      width="wide"
      title={isJobSeeker ? 'Find Jobs' : 'Explore Jobs'}
      description="Browse published vacancies from companies on PeaceOne."
    >
      <Card>
        <form className="grid gap-4 lg:grid-cols-12" onSubmit={applyFilters}>
          <div className="lg:col-span-4">
            <SearchInput
              id={`${variant}-job-keyword`}
              label="Keyword / Job title"
              value={list.input}
              placeholder="Data analyst"
              onChange={(event) => list.setInput(event.target.value)}
            />
          </div>
          <div className="lg:col-span-4">
            <TextInput
              id={`${variant}-job-company`}
              label="Company"
              value={companyInput}
              placeholder="TechCorp"
              onChange={(event) => setCompanyInput(event.target.value)}
            />
          </div>
          <div className="lg:col-span-4">
            <TextInput
              id={`${variant}-job-location`}
              label="Location"
              value={locationInput}
              placeholder="Kuala Lumpur"
              onChange={(event) => setLocationInput(event.target.value)}
            />
          </div>
          <div className="lg:col-span-4">
            <TextInput
              id={`${variant}-job-industry`}
              label="Industry"
              value={industryInput}
              placeholder="Software"
              onChange={(event) => setIndustryInput(event.target.value)}
            />
          </div>
          <div className="lg:col-span-4">
            <SelectInput
              id={`${variant}-job-employment`}
              label="Employment type"
              value={employmentTypeInput}
              options={CANDIDATE_EMPLOYMENT_TYPE_OPTIONS}
              onChange={(event) => setEmploymentTypeInput(event.target.value)}
            />
          </div>
          <div className="flex flex-col justify-end gap-2 sm:flex-row lg:col-span-8">
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
      </Card>

      <section className="mt-6">
        <QueryStatus
          loading={list.loading}
          error={list.error}
          empty={list.items.length === 0}
          loadingLabel="Loading published jobs…"
          emptyTitle={hasActiveSearch ? 'No jobs match these filters.' : 'No jobs are currently available.'}
          emptyDescription={
            hasActiveSearch
              ? 'Try a different title, location, employment type or industry.'
              : 'Published vacancies appear here after employers publish them.'
          }
          onRetry={list.retry}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {list.items.map((job) => (
              <PublishedJobCard
                key={job.id}
                job={job}
                to={candidateJobPath(basePath, job.id)}
                overlapLabel={overlapLabelForJob(job, recordedSkills.items)}
              />
            ))}
          </div>
          <PaginationBar
            page={list.meta.page}
            totalPages={list.meta.totalPages}
            total={list.meta.total}
            noun="jobs"
            disabled={list.loading}
            onPrevious={() => writeParams({
              q: appliedQuery,
              company: appliedCompany,
              location: appliedLocation,
              industry: appliedIndustry,
              employmentType: appliedEmploymentType,
              page: Math.max(1, appliedPage - 1),
            })}
            onNext={() => writeParams({
              q: appliedQuery,
              company: appliedCompany,
              location: appliedLocation,
              industry: appliedIndustry,
              employmentType: appliedEmploymentType,
              page: appliedPage + 1,
            })}
          />
        </QueryStatus>
      </section>
    </PageContent>
  )
}

export default CandidateJobsPage
