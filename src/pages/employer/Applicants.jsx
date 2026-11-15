import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  APPLICATION_LIST_LIMIT,
  APPLICATION_STATUS_OPTIONS,
  EMPLOYER_APPLICATIONS_EMPTY,
  applicationStatusTone,
  employerApplicantPath,
  fetchEmployerApplications,
  formatApplicationStatus,
  formatJobDate,
  isAbortError,
  userFacingApplicationError,
} from '../../api/applications.js'
import { fetchStaffJobs, isJobId, userFacingJobError } from '../../api/jobs.js'

function Applicants() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = (searchParams.get('q') || '').trim()
  const initialStatus = (searchParams.get('status') || '').trim()
  const initialJobId = isJobId(searchParams.get('jobId') || '') ? searchParams.get('jobId') : ''
  const [queryInput, setQueryInput] = useState(initialQuery)
  const [statusInput, setStatusInput] = useState(initialStatus)
  const [jobInput, setJobInput] = useState(initialJobId)
  const [appliedQuery, setAppliedQuery] = useState(initialQuery)
  const [appliedStatus, setAppliedStatus] = useState(initialStatus)
  const [appliedJobId, setAppliedJobId] = useState(initialJobId)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ items: [], page: 1, totalPages: 1, total: 0 })
  const [jobOptions, setJobOptions] = useState([{ value: '', label: 'All jobs' }])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchStaffJobs({ page: 1, limit: 50, signal: controller.signal })
      .then((jobs) => {
        if (controller.signal.aborted) {
          return
        }
        setJobOptions([
          { value: '', label: 'All jobs' },
          ...jobs.items.map((job) => ({
            value: job.id,
            label: job.title,
          })),
        ])
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setJobOptions([{ value: '', label: 'All jobs' }])
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchEmployerApplications({
      q: appliedQuery,
      status: appliedStatus,
      jobId: appliedJobId,
      page,
      limit: APPLICATION_LIST_LIMIT,
      signal: controller.signal,
    })
      .then((next) => {
        if (!controller.signal.aborted) {
          setResult(next)
        }
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setResult({ items: [], page: 1, totalPages: 1, total: 0 })
        setError(userFacingApplicationError(loadError) || userFacingJobError(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [appliedQuery, appliedStatus, appliedJobId, page, retryNonce])

  function syncParams(nextQuery, nextStatus, nextJobId) {
    const params = new URLSearchParams()
    if (nextQuery) params.set('q', nextQuery)
    if (nextStatus) params.set('status', nextStatus)
    if (nextJobId) params.set('jobId', nextJobId)
    setSearchParams(params, { replace: true })
  }

  function handleSearch(event) {
    event.preventDefault()
    const nextQuery = queryInput.trim()
    const nextStatus = statusInput
    const nextJobId = isJobId(jobInput) ? jobInput : ''
    setAppliedQuery(nextQuery)
    setAppliedStatus(nextStatus)
    setAppliedJobId(nextJobId)
    setPage(1)
    syncParams(nextQuery, nextStatus, nextJobId)
  }

  function clearFilters() {
    setQueryInput('')
    setStatusInput('')
    setJobInput('')
    setAppliedQuery('')
    setAppliedStatus('')
    setAppliedJobId('')
    setPage(1)
    setSearchParams({}, { replace: true })
  }

  const hasFilters = Boolean(
    queryInput || statusInput || jobInput || appliedQuery || appliedStatus || appliedJobId,
  )
  const hasActiveSearch = Boolean(appliedQuery || appliedStatus || appliedJobId)

  return (
    <PageContent
      title="Applicants"
      description="Review candidates who have applied to your company’s jobs."
    >
      <Card>
        <form onSubmit={handleSearch} className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <TextInput
              id="applicant-search"
              label="Search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Candidate name, email or job title"
            />
          </div>
          <div className="lg:col-span-3">
            <SelectInput
              id="applicant-job"
              label="Job posting"
              value={jobInput}
              onChange={(event) => setJobInput(event.target.value)}
              options={jobOptions}
            />
          </div>
          <div className="lg:col-span-3">
            <SelectInput
              id="applicant-status"
              label="Application status"
              value={statusInput}
              onChange={(event) => setStatusInput(event.target.value)}
              options={APPLICATION_STATUS_OPTIONS}
            />
          </div>
          <div className="flex flex-col justify-end gap-2 sm:flex-row lg:col-span-2">
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              Search
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={loading || !hasFilters}
              onClick={clearFilters}
            >
              Clear
            </Button>
          </div>
        </form>
      </Card>

      <section className="mt-6">
        <QueryStatus
          loading={loading}
          error={error}
          empty={result.items.length === 0}
          loadingLabel="Loading applications…"
          emptyTitle={hasActiveSearch ? 'No applications match these filters.' : EMPLOYER_APPLICATIONS_EMPTY.title}
          emptyDescription={
            hasActiveSearch
              ? 'Try a different candidate, job title or status.'
              : EMPLOYER_APPLICATIONS_EMPTY.description
          }
          onRetry={() => setRetryNonce((current) => current + 1)}
        >
          <Table
            minWidthClass="min-w-[880px]"
            headers={['Candidate', 'Email', 'Applied job', 'Applied date', 'Status', 'Actions']}
            rows={result.items.map((application) => [
              application.applicant?.fullName || 'Unavailable candidate',
              application.applicant?.email || '—',
              application.job?.title || 'Unavailable job',
              formatJobDate(application.appliedAt),
              <Badge
                key={`${application.id}-status`}
                tone={applicationStatusTone(application.status)}
                className="normal-case"
              >
                {formatApplicationStatus(application.status)}
              </Badge>,
              <Button
                key={`${application.id}-view`}
                size="sm"
                variant="secondary"
                to={employerApplicantPath(application.id, {
                  q: appliedQuery,
                  status: appliedStatus,
                  jobId: appliedJobId,
                })}
              >
                View Details
              </Button>,
            ])}
          />
          <div className="mt-4">
            <PaginationBar
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              noun="applications"
              disabled={loading}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => current + 1)}
            />
          </div>
        </QueryStatus>
      </section>
    </PageContent>
  )
}

export default Applicants
