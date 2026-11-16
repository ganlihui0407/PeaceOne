import { useEffect, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import {
  APPLICATION_STATUS_OPTIONS,
  applicationStatusTone,
  employerApplicantsPath,
  formatApplicationStatus,
} from '../../api/applications.js'
import { formatJobStatus, jobStatusTone } from '../../api/jobs.js'
import {
  ADMIN_ACTIVITY_UNAVAILABLE,
  ADMIN_JOBS_UNAVAILABLE,
  ADMIN_LEARNING_UNAVAILABLE,
  ADMIN_SHORTCUTS,
  ADMIN_USERS_UNAVAILABLE,
  STAFF_APPLICATIONS_EMPTY,
  STAFF_COMPANY_EMPTY,
  STAFF_INTERVIEWS_EMPTY,
  STAFF_JOBS_UNAVAILABLE,
  STAFF_PROFILE_INCOMPLETE,
  staffJobCountsFromApplicationStats,
} from '../../api/staffAdminDashboard.js'
import {
  INTERVIEW_STATUS_OPTIONS,
  employerInterviewPath,
  formatInterviewStatus,
  formatInterviewWhen,
  interviewStatusTone,
} from '../../api/interviews.js'
import { fetchAdminRecentActivity, userFacingAdminPlatformError } from '../../api/adminPlatform.js'
import { isAbortError } from '../../api/esco.js'
import { formatNotificationTime } from '../../api/notifications.js'

export function StaffProfileHighlights({ highlights, profileTo }) {
  if (highlights.length === 0) {
    return (
      <p className="po-secondary mt-2">
        {STAFF_PROFILE_INCOMPLETE.description}{' '}
        <Button to={profileTo} variant="ghost" size="sm" className="align-baseline px-0">
          Open My Profile
        </Button>
      </p>
    )
  }
  return (
    <p className="po-secondary mt-2">
      {highlights.join(' · ')}{' '}
      <Button to={profileTo} variant="ghost" size="sm" className="align-baseline px-0">
        Open My Profile
      </Button>
    </p>
  )
}

export function StaffCompanySection({ company, companyTo }) {
  return (
    <section className="po-section-block">
      <SectionHeader
        title="Company information"
        action={
          <Button to={companyTo} size="sm" variant="ghost">
            Open Company Profile
          </Button>
        }
      />
      {company ? (
        <Card>
          <h3 className="po-card-title">{company.companyName}</h3>
          <p className="po-secondary mt-2">
            {[company.industry, company.location].filter(Boolean).join(' · ') ||
              'No extra company details saved yet.'}
          </p>
        </Card>
      ) : (
        <Card>
          <EmptyState title={STAFF_COMPANY_EMPTY.title} description={STAFF_COMPANY_EMPTY.description} />
        </Card>
      )}
    </section>
  )
}

export function StaffJobCountsSection({ stats }) {
  const counts = staffJobCountsFromApplicationStats(stats)
  const byStatus = stats?.byStatus || {}
  return (
    <section className="po-section-block">
      <SectionHeader
        title="Job postings"
        action={
          <Button to="/employer/jobs" size="sm" variant="ghost">
            View All Jobs
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card padding="sm">
          <p className="po-helper mt-0">Published jobs</p>
          <p className="po-page-title mt-1">{counts.published}</p>
        </Card>
        <Card padding="sm">
          <p className="po-helper mt-0">Draft jobs</p>
          <p className="po-page-title mt-1">{counts.draft}</p>
        </Card>
        <Card padding="sm">
          <p className="po-helper mt-0">Total jobs</p>
          <p className="po-page-title mt-1">{counts.total}</p>
        </Card>
        <Card padding="sm">
          <p className="po-helper mt-0">New applications</p>
          <p className="po-page-title mt-1">{byStatus.SUBMITTED ?? 0}</p>
        </Card>
      </div>
      {counts.total === 0 ? (
        <Card className="mt-4">
          <EmptyState title={STAFF_JOBS_UNAVAILABLE.title} description={STAFF_JOBS_UNAVAILABLE.description} />
        </Card>
      ) : null}
    </section>
  )
}

export function StaffApplicationStatsSection({ stats }) {
  const total = stats?.total ?? 0
  const byStatus = stats?.byStatus || {}
  const jobs = stats?.jobs || []
  const statusItems = APPLICATION_STATUS_OPTIONS.filter((option) => option.value)

  return (
    <section className="po-section-block">
      <SectionHeader
        title="Applications"
        action={
          <Button to={employerApplicantsPath()} size="sm" variant="ghost">
            View Applicants
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card padding="sm">
          <p className="po-helper mt-0">Total applicants</p>
          <p className="po-page-title mt-1">{total}</p>
        </Card>
        {['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFERED'].map((status) => (
          <Card key={status} padding="sm">
            <p className="po-helper mt-0">{formatApplicationStatus(status)}</p>
            <p className="po-card-title mt-1">{byStatus[status] ?? 0}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <h3 className="po-section-title">Applications by status</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {statusItems.map((option) => (
            <Badge key={option.value} tone={applicationStatusTone(option.value)} className="normal-case">
              {formatApplicationStatus(option.value)}: {byStatus[option.value] ?? 0}
            </Badge>
          ))}
        </div>
      </Card>
      <Card className="mt-4">
        {jobs.length === 0 && total === 0 ? (
          <EmptyState title={STAFF_APPLICATIONS_EMPTY.title} description={STAFF_APPLICATIONS_EMPTY.description} />
        ) : (
          <Table
            minWidthClass="min-w-[640px]"
            headers={['Job title', 'Job status', 'Applications', 'Actions']}
            rows={jobs.map((job) => [
              job.title,
              <Badge key={`${job.id}-status`} tone={jobStatusTone(job.status)} className="normal-case">
                {formatJobStatus(job.status)}
              </Badge>,
              String(job.applicationCount),
              <Button
                key={`${job.id}-view`}
                size="sm"
                variant="secondary"
                to={employerApplicantsPath({ jobId: job.id })}
              >
                View Applicants
              </Button>,
            ])}
            emptyTitle={STAFF_APPLICATIONS_EMPTY.title}
          />
        )}
      </Card>
    </section>
  )
}

export function AdminApplicationStatsSection({ stats }) {
  const total = stats?.total ?? 0
  const byStatus = stats?.byStatus || {}
  const companiesWithApplications = stats?.companiesWithApplications ?? 0
  const statusItems = APPLICATION_STATUS_OPTIONS.filter((option) => option.value)

  return (
    <section className="po-section-block">
      <SectionHeader title="Application totals" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card padding="sm">
          <p className="po-helper mt-0">Total applications</p>
          <p className="po-page-title mt-1">{total}</p>
        </Card>
        <Card padding="sm">
          <p className="po-helper mt-0">Companies with applications</p>
          <p className="po-page-title mt-1">{companiesWithApplications}</p>
        </Card>
      </div>
      <Card className="mt-4">
        <h3 className="po-section-title">Applications by status</h3>
        <p className="po-secondary mt-2">
          These are platform-wide counts. Candidate names and resume files are not shown here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {statusItems.map((option) => (
            <Badge key={option.value} tone={applicationStatusTone(option.value)} className="normal-case">
              {formatApplicationStatus(option.value)}: {byStatus[option.value] ?? 0}
            </Badge>
          ))}
        </div>
      </Card>
    </section>
  )
}

export function StaffUpcomingInterviewsSection({ stats, interviews = [] }) {
  const upcomingConfirmed = stats?.upcomingConfirmed ?? 0
  const pending = stats?.byStatus?.PROPOSED ?? 0
  const reschedule = stats?.byStatus?.RESCHEDULE_REQUESTED ?? 0

  return (
    <section className="po-section-block">
      <SectionHeader
        title="Upcoming interviews"
        action={<Button to="/employer/interviews">Manage Interviews</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="sm">
          <p className="po-helper mt-0">Confirmed upcoming</p>
          <p className="po-page-title mt-1">{upcomingConfirmed}</p>
        </Card>
        <Card padding="sm">
          <p className="po-helper mt-0">Pending responses</p>
          <p className="po-page-title mt-1">{pending}</p>
        </Card>
        <Card padding="sm">
          <p className="po-helper mt-0">Reschedule requests</p>
          <p className="po-page-title mt-1">{reschedule}</p>
        </Card>
      </div>
      <Card className="mt-4">
        {interviews.length === 0 ? (
          <EmptyState title={STAFF_INTERVIEWS_EMPTY.title} description={STAFF_INTERVIEWS_EMPTY.description} />
        ) : (
          <Table
            minWidthClass="min-w-[640px]"
            headers={['Candidate', 'Job', 'When', 'Status', 'Actions']}
            rows={interviews.map((item) => [
              item.candidate?.fullName || '—',
              item.job?.title || '—',
              formatInterviewWhen(item),
              <Badge key={`${item.id}-status`} tone={interviewStatusTone(item.status)} className="normal-case">
                {formatInterviewStatus(item.status)}
              </Badge>,
              <Button key={`${item.id}-view`} size="sm" variant="secondary" to={employerInterviewPath(item.id)}>
                View
              </Button>,
            ])}
          />
        )}
      </Card>
    </section>
  )
}

export function AdminInterviewStatsSection({ stats }) {
  const total = stats?.total ?? 0
  const byStatus = stats?.byStatus || {}
  const companiesWithInterviews = stats?.companiesWithInterviews ?? 0
  const statusItems = INTERVIEW_STATUS_OPTIONS.filter((option) => option.value)

  return (
    <section className="po-section-block">
      <SectionHeader title="Interview totals" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card padding="sm">
          <p className="po-helper mt-0">Total interviews</p>
          <p className="po-page-title mt-1">{total}</p>
        </Card>
        <Card padding="sm">
          <p className="po-helper mt-0">Companies with interviews</p>
          <p className="po-page-title mt-1">{companiesWithInterviews}</p>
        </Card>
      </div>
      <Card className="mt-4">
        <h3 className="po-section-title">Interviews by status</h3>
        <p className="po-secondary mt-2">
          These are platform-wide counts. Candidate names, notes and meeting links are not shown here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {statusItems.map((option) => (
            <Badge key={option.value} tone={interviewStatusTone(option.value)} className="normal-case">
              {formatInterviewStatus(option.value)}: {byStatus[option.value] ?? 0}
            </Badge>
          ))}
        </div>
      </Card>
    </section>
  )
}

export function AdminUnavailableOverview() {
  const items = [ADMIN_USERS_UNAVAILABLE, ADMIN_JOBS_UNAVAILABLE, ADMIN_LEARNING_UNAVAILABLE]
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.title} padding="sm">
          <EmptyState title={item.title} description={item.description} />
        </Card>
      ))}
    </div>
  )
}

export function AdminPlatformStatsSection({ stats }) {
  const users = stats?.users || {}
  const jobs = stats?.jobs || {}
  const learning = stats?.learning || {}
  const items = [
    { label: 'Total users', value: users.total ?? 0, to: '/admin/users' },
    { label: 'Candidates', value: (users.students ?? 0) + (users.jobSeekers ?? 0), to: '/admin/users' },
    { label: 'Students', value: users.students ?? 0, to: '/admin/users' },
    { label: 'Job seekers', value: users.jobSeekers ?? 0, to: '/admin/users' },
    { label: 'Company staff', value: users.companyStaff ?? 0, to: '/admin/users' },
    { label: 'Registered companies', value: stats?.companies?.total ?? 0, to: '/admin/companies' },
    { label: 'Total jobs', value: jobs.total ?? 0, to: '/admin/jobs' },
    { label: 'Published jobs', value: jobs.published ?? 0, to: '/admin/jobs' },
    { label: 'Draft jobs', value: jobs.draft ?? 0, to: '/admin/jobs' },
    { label: 'Total applications', value: stats?.applications?.total ?? 0, to: '/admin/reports' },
    { label: 'Interviews', value: stats?.interviews?.total ?? 0, to: '/admin/reports' },
    { label: 'Offers issued', value: stats?.applications?.byStatus?.OFFERED ?? 0, to: '/admin/reports' },
    { label: 'Published courses', value: learning.publishedCourses ?? 0, to: '/admin/learning' },
    { label: 'Learning enrolments', value: learning.enrollments ?? 0, to: '/admin/learning' },
    { label: 'Completed courses', value: learning.completed ?? 0, to: '/admin/learning' },
  ]
  return (
    <section className="po-section-block">
      <SectionHeader title="Platform totals" />
      <p className="po-secondary mb-4">
        These counts are calculated from PostgreSQL. They are not hardcoded demonstration numbers.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <Card key={item.label} padding="sm">
            <p className="po-helper mt-0">{item.label}</p>
            <p className="po-page-title mt-1">{item.value}</p>
            <div className="mt-3">
              <Button to={item.to} size="sm" variant="ghost" className="px-0">
                Open
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

export function AdminShortcutsSection() {
  return (
    <section className="po-section-block">
      <SectionHeader title="Quick management" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_SHORTCUTS.map((item) => (
          <Card key={item.label}>
            <h3 className="po-card-title">{item.label}</h3>
            <div className="mt-4">
              <Button to={item.to} variant="secondary" className="w-full">
                {item.label}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

export function AdminActivityUnavailableSection() {
  return (
    <section className="po-section-block">
      <SectionHeader title="Recent activity" />
      <Card>
        <EmptyState title={ADMIN_ACTIVITY_UNAVAILABLE.title} description={ADMIN_ACTIVITY_UNAVAILABLE.description} />
      </Card>
    </section>
  )
}

export function AdminRecentActivitySection({ activity: initialActivity }) {
  const [activity, setActivity] = useState(initialActivity)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setActivity(initialActivity)
    setError('')
  }, [initialActivity])

  async function loadPage(nextPage) {
    setLoading(true)
    setError('')
    try {
      const next = await fetchAdminRecentActivity({ page: nextPage, limit: 10 })
      setActivity(next)
    } catch (loadError) {
      if (!isAbortError(loadError)) {
        setError(userFacingAdminPlatformError(loadError))
      }
    } finally {
      setLoading(false)
    }
  }

  const items = Array.isArray(activity?.items) ? activity.items : []
  return (
    <section className="po-section-block">
      <SectionHeader title="Recent activity" />
      <Card>
        <QueryStatus
          loading={loading && items.length === 0}
          error={error}
          empty={!loading && !error && items.length === 0}
          loadingLabel="Loading recent activity…"
          emptyTitle={ADMIN_ACTIVITY_UNAVAILABLE.title}
          emptyDescription={ADMIN_ACTIVITY_UNAVAILABLE.description}
          onRetry={() => loadPage(activity?.page || 1)}
        >
          <Table
            minWidthClass="min-w-[640px]"
            headers={['When', 'Activity', 'Details']}
            rows={items.map((item) => [
              formatNotificationTime(item.occurredAt),
              item.title,
              item.description,
            ])}
            emptyTitle={ADMIN_ACTIVITY_UNAVAILABLE.title}
          />
          <PaginationBar
            page={activity?.page || 1}
            totalPages={activity?.totalPages || 0}
            total={activity?.total || 0}
            noun="events"
            disabled={loading}
            onPrevious={() => loadPage(Math.max(1, (activity?.page || 1) - 1))}
            onNext={() => loadPage((activity?.page || 1) + 1)}
          />
        </QueryStatus>
      </Card>
    </section>
  )
}
