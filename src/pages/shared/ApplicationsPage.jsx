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
  APPLICATION_EMPTY,
  APPLICATION_LIST_LIMIT,
  APPLICATION_STATUS_OPTIONS,
  applicationStatusTone,
  candidateApplicationPath,
  fetchMyApplications,
  formatApplicationStatus,
  formatEmploymentType,
  formatJobDate,
  isAbortError,
  userFacingApplicationError,
} from '../../api/applications.js'
import { candidateJobsPath } from '../../api/jobs.js'

function ApplicationsPage({ basePath }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = (searchParams.get('q') || '').trim()
  const initialStatus = (searchParams.get('status') || '').trim()
  const [queryInput, setQueryInput] = useState(initialQuery)
  const [statusInput, setStatusInput] = useState(initialStatus)
  const [appliedQuery, setAppliedQuery] = useState(initialQuery)
  const [appliedStatus, setAppliedStatus] = useState(initialStatus)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ items: [], page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchMyApplications({
      q: appliedQuery,
      status: appliedStatus,
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
        setError(userFacingApplicationError(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [appliedQuery, appliedStatus, page, retryNonce])

  function handleSearch(event) {
    event.preventDefault()
    const nextQuery = queryInput.trim()
    const nextStatus = statusInput
    setAppliedQuery(nextQuery)
    setAppliedStatus(nextStatus)
    setPage(1)
    const params = new URLSearchParams()
    if (nextQuery) params.set('q', nextQuery)
    if (nextStatus) params.set('status', nextStatus)
    setSearchParams(params, { replace: true })
  }

  function clearFilters() {
    setQueryInput('')
    setStatusInput('')
    setAppliedQuery('')
    setAppliedStatus('')
    setPage(1)
    setSearchParams({}, { replace: true })
  }

  const hasFilters = Boolean(queryInput || statusInput || appliedQuery || appliedStatus)
  const hasActiveSearch = Boolean(appliedQuery || appliedStatus)

  return (
    <PageContent
      title="My Applications"
      description="Review applications you submitted for published jobs."
    >
      <Card>
        <form onSubmit={handleSearch} className="grid gap-4 lg:grid-cols-8">
          <div className="lg:col-span-4">
            <TextInput
              id="application-search"
              label="Search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Job title or company"
            />
          </div>
          <div className="lg:col-span-2">
            <SelectInput
              id="application-status"
              label="Status"
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
          emptyTitle={hasActiveSearch ? 'No applications match these filters.' : APPLICATION_EMPTY.title}
          emptyDescription={
            hasActiveSearch
              ? 'Try a different job title, company or status.'
              : APPLICATION_EMPTY.description
          }
          emptyAction={
            hasActiveSearch ? null : <Button to={candidateJobsPath(basePath)}>Browse jobs</Button>
          }
          onRetry={() => setRetryNonce((current) => current + 1)}
        >
          <Table
            minWidthClass="min-w-[760px]"
            headers={['Job title', 'Company', 'Employment type', 'Location', 'Applied', 'Status', 'Actions']}
            rows={result.items.map((application) => [
              application.job?.title || 'Unavailable job',
              application.job?.company?.companyName || '—',
              formatEmploymentType(application.job?.employmentType),
              application.job?.location || '—',
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
                to={candidateApplicationPath(basePath, application.id)}
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

export default ApplicationsPage
