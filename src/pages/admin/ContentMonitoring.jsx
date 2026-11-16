import { useEffect, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import {
  fetchAdminContentMonitoring,
  userFacingAdminPlatformError,
} from '../../api/adminPlatform.js'
import { formatAdminDate } from '../../api/adminUsers.js'
import { formatJobStatus, jobStatusTone } from '../../api/jobs.js'
import { formatCourseStatus } from '../../api/learning.js'

function ContentMonitoring() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    fetchAdminContentMonitoring()
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

  return (
    <PageContent
      title="Content Monitoring"
      description="Live published and suspended jobs, published and archived courses, and recent job status changes."
    >
      <QueryStatus
        loading={loading}
        error={error}
        loadingLabel="Loading monitoring data…"
        onRetry={load}
      >
        {payload ? (
          <div className="space-y-8">
            <Card>
              <h2 className="po-section-title">Moderation queue</h2>
              <p className="po-body mt-3">{payload.moderationNote}</p>
              <p className="po-secondary mt-2">
                Flagged Keep/Remove actions are not available because PeaceOne does not store a moderation queue.
                Suspend or close jobs on Job Monitoring. Publish or archive courses on Learning Content.
              </p>
            </Card>

            <section>
              <h2 className="po-section-title mb-3">Published jobs</h2>
              <Table
                minWidthClass="min-w-[720px]"
                headers={['Job', 'Company', 'Status', 'Updated', 'Actions']}
                emptyTitle="No published jobs."
                rows={(payload.publishedJobs || []).map((job) => [
                  job.title,
                  job.companyName || '—',
                  <Badge key={`${job.id}-st`} tone={jobStatusTone(job.status)} className="normal-case">
                    {formatJobStatus(job.status)}
                  </Badge>,
                  formatAdminDate(job.updatedAt),
                  <Button key={`${job.id}-view`} size="sm" variant="secondary" to={`/admin/jobs/${job.id}`}>
                    Open
                  </Button>,
                ])}
              />
            </section>

            <section>
              <h2 className="po-section-title mb-3">Suspended jobs</h2>
              <Table
                minWidthClass="min-w-[720px]"
                headers={['Job', 'Company', 'Status', 'Updated', 'Actions']}
                emptyTitle="No suspended jobs."
                rows={(payload.suspendedJobs || []).map((job) => [
                  job.title,
                  job.companyName || '—',
                  <Badge key={`${job.id}-st`} tone={jobStatusTone(job.status)} className="normal-case">
                    {formatJobStatus(job.status)}
                  </Badge>,
                  formatAdminDate(job.updatedAt),
                  <Button key={`${job.id}-view`} size="sm" variant="secondary" to={`/admin/jobs/${job.id}`}>
                    Open
                  </Button>,
                ])}
              />
            </section>

            <section>
              <h2 className="po-section-title mb-3">Published courses</h2>
              <Table
                minWidthClass="min-w-[640px]"
                headers={['Course', 'Status', 'Updated', 'Actions']}
                emptyTitle="No published courses."
                rows={(payload.publishedCourses || []).map((course) => [
                  course.title,
                  formatCourseStatus(course.status),
                  formatAdminDate(course.updatedAt),
                  <Button key={`${course.id}-edit`} size="sm" variant="secondary" to={`/admin/learning/${course.id}/edit`}>
                    Open
                  </Button>,
                ])}
              />
            </section>

            <section>
              <h2 className="po-section-title mb-3">Archived courses</h2>
              <Table
                minWidthClass="min-w-[640px]"
                headers={['Course', 'Status', 'Updated', 'Actions']}
                emptyTitle="No archived courses."
                rows={(payload.archivedCourses || []).map((course) => [
                  course.title,
                  formatCourseStatus(course.status),
                  formatAdminDate(course.updatedAt),
                  <Button key={`${course.id}-edit`} size="sm" variant="secondary" to={`/admin/learning/${course.id}/edit`}>
                    Open
                  </Button>,
                ])}
              />
            </section>

            <section>
              <h2 className="po-section-title mb-3">Recent job status changes</h2>
              <Table
                minWidthClass="min-w-[880px]"
                headers={['Job', 'Company', 'From', 'To', 'Actor', 'Date']}
                emptyTitle="No job status events yet."
                rows={(payload.recentJobStatusEvents || []).map((event) => [
                  event.job?.title || '—',
                  event.job?.companyName || '—',
                  event.fromStatus || '—',
                  event.toStatus,
                  event.actor?.fullName || '—',
                  formatAdminDate(event.createdAt),
                ])}
              />
            </section>
          </div>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default ContentMonitoring
