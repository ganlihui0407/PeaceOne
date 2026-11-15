import { useEffect, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import {
  INTERVIEW_EMPTY,
  INTERVIEW_LIST_LIMIT,
  candidateInterviewPath,
  fetchMyInterviews,
  formatInterviewStatus,
  formatInterviewType,
  formatInterviewWhen,
  interviewStatusTone,
  isAbortError,
  userFacingInterviewError,
} from '../../api/interviews.js'

function countByStatus(items, status) {
  return items.filter((item) => item.status === status).length
}

function InterviewsPage({ basePath }) {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ items: [], page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchMyInterviews({ page, limit: INTERVIEW_LIST_LIMIT, signal: controller.signal })
      .then((next) => {
        if (!controller.signal.aborted) {
          setResult(next)
        }
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
  }, [page, retryNonce])

  const upcoming = result.items.find((item) => item.status === 'CONFIRMED' || item.status === 'PROPOSED')

  return (
    <PageContent
      title="My Interviews"
      description="Review invitations, confirmed times and interview history stored for this account."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={String(result.total)} />
        <StatCard label="Pending invitations" value={String(countByStatus(result.items, 'PROPOSED'))} />
        <StatCard label="Confirmed" value={String(countByStatus(result.items, 'CONFIRMED'))} />
      </div>

      {upcoming ? (
        <Card className="mt-8">
          <p className="po-secondary">Next interview</p>
          <h2 className="po-section-title mt-1">{upcoming.title}</h2>
          <dl className="po-secondary mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="po-helper">Company</dt>
              <dd className="font-medium text-ink">{upcoming.job?.company?.companyName || '—'}</dd>
            </div>
            <div>
              <dt className="po-helper">When</dt>
              <dd className="font-medium text-ink">{formatInterviewWhen(upcoming)}</dd>
            </div>
            <div>
              <dt className="po-helper">Type</dt>
              <dd className="font-medium text-ink">{formatInterviewType(upcoming.interviewType)}</dd>
            </div>
            <div>
              <dt className="po-helper">Status</dt>
              <dd>
                <Badge tone={interviewStatusTone(upcoming.status)} className="normal-case">
                  {formatInterviewStatus(upcoming.status)}
                </Badge>
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            <Button to={candidateInterviewPath(basePath, upcoming.id)}>View details</Button>
          </div>
        </Card>
      ) : null}

      <div className="mt-8">
        <QueryStatus
          loading={loading}
          error={error}
          loadingLabel="Loading interviews…"
          onRetry={() => setRetryNonce((current) => current + 1)}
        >
          <Table
            minWidthClass="min-w-[720px]"
            headers={['Job', 'Company', 'When', 'Type', 'Status', 'Actions']}
            rows={result.items.map((item) => [
              item.job?.title || item.title,
              item.job?.company?.companyName || '—',
              formatInterviewWhen(item),
              formatInterviewType(item.interviewType),
              <Badge key={`${item.id}-status`} tone={interviewStatusTone(item.status)} className="normal-case">
                {formatInterviewStatus(item.status)}
              </Badge>,
              <Button
                key={`${item.id}-view`}
                size="sm"
                variant="secondary"
                to={candidateInterviewPath(basePath, item.id)}
              >
                View
              </Button>,
            ])}
            emptyTitle={INTERVIEW_EMPTY.title}
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

export default InterviewsPage
