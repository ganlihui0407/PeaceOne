import { useEffect, useState } from 'react'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { fetchAdminReports, userFacingAdminPlatformError } from '../../api/adminPlatform.js'
import { formatProfileRole } from '../../api/adminUsers.js'
import { formatApplicationStatus } from '../../api/applications.js'
import { formatJobStatus } from '../../api/jobs.js'
import { formatCourseStatus, formatEnrollmentStatus } from '../../api/learning.js'
import { formatInterviewStatus } from '../../api/interviews.js'

function DistributionTable({ title, rows, emptyTitle }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <Card>
      <h2 className="po-section-title">{title}</h2>
      {rows.length === 0 ? (
        <p className="po-secondary mt-4">{emptyTitle}</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {rows.map((item) => (
            <li key={item.label}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">{item.label}</p>
                <p className="text-sm font-semibold text-ink">{item.value}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-page">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((item.value / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function toRows(map, labelFn) {
  if (!map || typeof map !== 'object') {
    return []
  }
  return Object.entries(map).map(([key, value]) => ({
    label: labelFn(key),
    value: typeof value === 'number' ? value : 0,
  }))
}

function Reports() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    fetchAdminReports()
      .then(setPayload)
      .catch((loadError) => {
        setPayload(null)
        setError(userFacingAdminPlatformError(loadError))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const totals = payload?.totals || {}

  return (
    <PageContent
      title="Reports & Analysis"
      description="Live PostgreSQL aggregates. PeaceOne does not store a historical analytics warehouse, so monthly activity charts are not shown."
    >
      <QueryStatus
        loading={loading}
        error={error}
        loadingLabel="Loading reports…"
        onRetry={load}
      >
        {payload ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Users" value={String(totals.users ?? 0)} />
              <StatCard label="Candidates" value={String(totals.candidates ?? 0)} />
              <StatCard label="Companies" value={String(totals.companies ?? 0)} />
              <StatCard label="Jobs" value={String(totals.jobs ?? 0)} />
              <StatCard label="Published jobs" value={String(totals.publishedJobs ?? 0)} />
              <StatCard label="Applications" value={String(totals.applications ?? 0)} />
              <StatCard label="Offers" value={String(totals.offers ?? 0)} />
              <StatCard label="Interviews" value={String(totals.interviews ?? 0)} />
              <StatCard label="Learning enrolments" value={String(totals.enrollments ?? 0)} />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <DistributionTable
                title="Users by role"
                rows={toRows(payload.usersByRole, formatProfileRole)}
                emptyTitle="No users recorded."
              />
              <DistributionTable
                title="Jobs by status"
                rows={toRows(payload.jobsByStatus, formatJobStatus)}
                emptyTitle="No jobs recorded."
              />
              <DistributionTable
                title="Applications by status"
                rows={toRows(payload.applicationsByStatus, formatApplicationStatus)}
                emptyTitle="No applications recorded."
              />
              <DistributionTable
                title="Interviews by status"
                rows={toRows(payload.interviews?.byStatus, formatInterviewStatus)}
                emptyTitle="No interviews recorded."
              />
              <DistributionTable
                title="Learning enrolments by status"
                rows={toRows(payload.learning?.enrollmentsByStatus, formatEnrollmentStatus)}
                emptyTitle="No enrolments recorded."
              />
              <DistributionTable
                title="Courses by publication status"
                rows={toRows(payload.learning?.coursesByStatus, formatCourseStatus)}
                emptyTitle="No courses recorded."
              />
            </div>

            <div className="mt-8">
              <Table
                headers={['Learning measure', 'Count']}
                rows={[
                  ['Published courses', payload.learning?.publishedCourses ?? 0],
                  ['Total enrolments', payload.learning?.enrollments ?? 0],
                  ['Completed courses', payload.learning?.completed ?? 0],
                ]}
              />
            </div>
          </>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default Reports
