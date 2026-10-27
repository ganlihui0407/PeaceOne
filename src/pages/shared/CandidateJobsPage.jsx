import { useMemo, useState } from 'react'
import Button from '../../components/common/Button.jsx'
import Badge from '../../components/common/Badge.jsx'
import Card from '../../components/cards/Card.jsx'
import JobCard from '../../components/cards/JobCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  candidateEmploymentTypes,
  candidateExperienceLevels,
  jobIndustries,
  jobSeekerJobs,
  postedDateFilters,
  salaryRanges,
  studentJobs,
} from '../../data/candidateJobs.js'
import { cn } from '../../utils/cn.js'

function matchesSalary(job, range) {
  if (range === 'All') return true
  if (range === 'Below RM 4,000') return job.salaryMax < 4000
  if (range === 'RM 4,000 – 5,000') return job.salaryMin <= 5000 && job.salaryMax >= 4000
  if (range === 'Above RM 5,000') return job.salaryMax > 5000
  return true
}

function matchesPosted(job, posted) {
  if (posted === 'All') return true
  if (posted === 'Last 3 days') return job.postedDays <= 3
  if (posted === 'Last week') return job.postedDays <= 7
  return true
}

function CandidateJobsPage({ basePath, variant = 'student' }) {
  const isJobSeeker = variant === 'jobseeker'
  const source = isJobSeeker ? jobSeekerJobs : studentJobs
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const [employmentType, setEmploymentType] = useState('All')
  const [experienceLevel, setExperienceLevel] = useState('All')
  const [industry, setIndustry] = useState('All')
  const [salaryRange, setSalaryRange] = useState('All')
  const [posted, setPosted] = useState('All')
  const [applied, setApplied] = useState({ keyword: '', location: '' })
  const [selectedId, setSelectedId] = useState(source[0]?.id)

  const results = useMemo(() => {
    return source.filter((job) => {
      const haystack = `${job.jobTitle} ${job.company}`.toLowerCase()
      const keywordOk = !applied.keyword || haystack.includes(applied.keyword.trim().toLowerCase())
      const locationOk =
        !applied.location || job.location.toLowerCase().includes(applied.location.trim().toLowerCase())
      const typeOk = employmentType === 'All' || job.employmentType === employmentType
      const levelOk = experienceLevel === 'All' || job.experienceLevel === experienceLevel
      const industryOk = industry === 'All' || job.industry === industry
      const salaryOk = !isJobSeeker || matchesSalary(job, salaryRange)
      const postedOk = !isJobSeeker || matchesPosted(job, posted)
      return keywordOk && locationOk && typeOk && levelOk && industryOk && salaryOk && postedOk
    })
  }, [
    applied,
    employmentType,
    experienceLevel,
    industry,
    isJobSeeker,
    posted,
    salaryRange,
    source,
  ])

  const selected = results.find((job) => job.id === selectedId) || results[0]

  function handleSearch(event) {
    event.preventDefault()
    setApplied({ keyword, location })
  }

  return (
    <PageContent
      width="wide"
      title={isJobSeeker ? 'Find Jobs' : 'Explore Jobs'}
      description={
        isJobSeeker
          ? 'Search roles that match your skills and career direction.'
          : 'Discover opportunities related to your career target and developing skills.'
      }
    >
      <form
        className="grid gap-4 rounded-xl border border-line bg-surface p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
        onSubmit={handleSearch}
      >
        <SearchInput
          id={`${variant}-job-keyword`}
          label={isJobSeeker ? 'Keyword / Job Title' : 'Job Title / Keyword'}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Data analyst"
        />
        <TextInput
          id={`${variant}-job-location`}
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

      <div className={cn('mt-4 grid gap-4', isJobSeeker ? 'md:grid-cols-2 xl:grid-cols-5' : 'md:grid-cols-3')}>
        <SelectInput
          id={`${variant}-employment`}
          label="Employment Type"
          value={employmentType}
          onChange={(event) => setEmploymentType(event.target.value)}
          options={candidateEmploymentTypes.map((value) => ({ value, label: value }))}
        />
        <SelectInput
          id={`${variant}-experience`}
          label="Experience Level"
          value={experienceLevel}
          onChange={(event) => setExperienceLevel(event.target.value)}
          options={candidateExperienceLevels.map((value) => ({ value, label: value }))}
        />
        <SelectInput
          id={`${variant}-industry`}
          label="Industry"
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          options={jobIndustries.map((value) => ({ value, label: value }))}
        />
        {isJobSeeker ? (
          <>
            <SelectInput
              id="js-salary"
              label="Salary Range"
              value={salaryRange}
              onChange={(event) => setSalaryRange(event.target.value)}
              options={salaryRanges.map((value) => ({ value, label: value }))}
            />
            <SelectInput
              id="js-posted"
              label="Posted Date"
              value={posted}
              onChange={(event) => setPosted(event.target.value)}
              options={postedDateFilters.map((value) => ({ value, label: value }))}
            />
          </>
        ) : null}
      </div>

      {isJobSeeker ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            {results.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedId(job.id)}
                className={cn(
                  'w-full rounded-xl border bg-surface p-4 text-left transition-colors duration-150',
                  selected?.id === job.id ? 'border-primary bg-soft/60' : 'border-line hover:bg-page',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="po-card-title">{job.jobTitle}</p>
                    <p className="po-secondary mt-1">
                      {job.company} · {job.location}
                    </p>
                  </div>
                  <Badge tone={job.match >= 80 ? 'success' : 'primary'}>{job.match}% Match</Badge>
                </div>
                <p className="po-helper mt-2">
                  {job.employmentType} · {job.salary}
                </p>
              </button>
            ))}
          </div>
          {selected ? (
            <Card>
              <Badge tone="primary">{selected.employmentType}</Badge>
              <h2 className="po-section-title mt-3">{selected.jobTitle}</h2>
              <p className="po-secondary mt-1">
                {selected.company} · {selected.location} · {selected.salary}
              </p>
              <p className="mt-3 text-sm font-medium text-ink">{selected.match}% Match</p>
              <p className="po-body mt-4">{selected.jobDescription}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.skills.map((skill) => (
                  <Badge key={skill} tone="default">
                    {skill}
                  </Badge>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button to={`${basePath}/jobs/${selected.id}`}>View Details</Button>
                <Button variant="secondary" to={`${basePath}/jobs/${selected.id}/apply`}>
                  Apply Now
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="po-secondary">No roles match these filters yet.</p>
            </Card>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {results.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              actions={[
                { label: 'View Details', to: `${basePath}/jobs/${job.id}`, variant: 'secondary' },
                { label: 'Apply', to: `${basePath}/jobs/${job.id}/apply` },
              ]}
            />
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <p className="po-secondary mt-8">No roles match these filters yet.</p>
      ) : null}
    </PageContent>
  )
}

export default CandidateJobsPage
