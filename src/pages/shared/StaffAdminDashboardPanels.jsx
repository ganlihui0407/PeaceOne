import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
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
} from '../../api/staffAdminDashboard.js'
import {
  INTERVIEW_STATUS_OPTIONS,
  employerInterviewPath,
  formatInterviewStatus,
  formatInterviewWhen,
  interviewStatusTone,
} from '../../api/interviews.js'

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

export function StaffJobsUnavailableSection() {
  return (
    <section className="po-section-block">
      <SectionHeader
        title="Active job postings"
        action={
          <Button to="/employer/jobs" size="sm" variant="ghost">
            View All Jobs
          </Button>
        }
      />
      <Card>
        <EmptyState title={STAFF_JOBS_UNAVAILABLE.title} description={STAFF_JOBS_UNAVAILABLE.description} />
      </Card>
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
          <p className="po-helper mt-0">Total applications</p>
          <p className="po-page-title mt-1">{total}</p>
        </Card>
        {statusItems.slice(0, 3).map((option) => (
          <Card key={option.value} padding="sm">
            <p className="po-helper mt-0">{option.label}</p>
            <p className="po-card-title mt-1">{byStatus[option.value] ?? 0}</p>
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
