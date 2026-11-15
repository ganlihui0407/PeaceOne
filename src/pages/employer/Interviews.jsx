import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  EMPLOYER_INTERVIEWS_EMPTY,
  INTERVIEW_LIST_LIMIT,
  INTERVIEW_STATUS_OPTIONS,
  employerInterviewCreatePath,
  employerInterviewPath,
  fetchEmployerInterviewStats,
  fetchEmployerInterviews,
  formatInterviewStatus,
  formatInterviewType,
  formatInterviewWhen,
  interviewStatusTone,
  isAbortError,
  userFacingInterviewError,
} from '../../api/interviews.js'

const TAB_FILTERS = [
  { value: '', label: 'All' },
  { value: 'CONFIRMED', label: 'Upcoming' },
  { value: 'PROPOSED', label: 'Pending responses' },
  { value: 'RESCHEDULE_REQUESTED', label: 'Reschedule requests' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function EmployerInterviews() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = (searchParams.get('status') || '').trim()
  const [statusInput, setStatusInput] = useState(initialStatus)
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState(null)
  const [result, setResult] = useState({ items: [], page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([
      fetchEmployerInterviewStats({ signal: controller.signal }),
      fetchEmployerInterviews({
        status: statusInput,
        page,
        limit: INTERVIEW_LIST_LIMIT,
        signal: controller.signal,
      }),
    ])
      .then(([nextStats, nextResult]) => {
        if (controller.signal.aborted) {
          return
        }
        setStats(nextStats)
        setResult(nextResult)
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setError(userFacingInterviewError(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [statusInput, page, retryNonce])

  function applyStatus(nextStatus) {
    setStatusInput(nextStatus)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    if (nextStatus) {
      next.set('status', nextStatus)
    } else {
      next.delete('status')
    }
    setSearchParams(next, { replace: true })
  }

  const byStatus = stats?.byStatus || {}

  return (
    <PageContent
      title="Interview Management"
      description="Schedule and track interview invitations using stored company records."
      actions={<Button to={employerInterviewCreatePath()}>Schedule Interview</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total interviews" value={String(stats?.total ?? 0)} />
        <StatCard label="Pending responses" value={String(byStatus.PROPOSED ?? 0)} />
        <StatCard label="Reschedule requests" value={String(byStatus.RESCHEDULE_REQUESTED ?? 0)} />
        <StatCard label="Upcoming confirmed" value={String(stats?.upcomingConfirmed ?? 0)} />
      </div>

      <Card className="mt-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TAB_FILTERS.map((tab) => (
              <Button
                key={tab.label}
                size="sm"
                variant={statusInput === tab.value ? 'primary' : 'secondary'}
                onClick={() => applyStatus(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <div className="w-full max-w-xs">
            <SelectInput
              id="interview-status-filter"
              label="Status"
              value={statusInput}
              onChange={(event) => applyStatus(event.target.value)}
              options={INTERVIEW_STATUS_OPTIONS}
            />
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <QueryStatus
          loading={loading}
          error={error}
          loadingLabel="Loading interviews…"
          onRetry={() => setRetryNonce((current) => current + 1)}
        >
          <Table
            minWidthClass="min-w-[980px]"
            headers={['Candidate', 'Job', 'When', 'Type', 'Round', 'Status', 'Actions']}
            rows={result.items.map((item) => [
              item.candidate?.fullName || '—',
              item.job?.title || '—',
              formatInterviewWhen(item),
              formatInterviewType(item.interviewType),
              String(item.roundNumber),
              <Badge key={`${item.id}-status`} tone={interviewStatusTone(item.status)} className="normal-case">
                {formatInterviewStatus(item.status)}
              </Badge>,
              <Button key={`${item.id}-view`} size="sm" variant="secondary" to={employerInterviewPath(item.id)}>
                View
              </Button>,
            ])}
            emptyTitle={EMPLOYER_INTERVIEWS_EMPTY.title}
          />
          <div className="mt-4">
            <PaginationBar
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              noun="interviews"
              disabled={loading}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => current + 1)}
            />
          </div>
        </QueryStatus>
      </div>
    </PageContent>
  )
}

export default EmployerInterviews
