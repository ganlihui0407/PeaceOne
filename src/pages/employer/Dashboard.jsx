import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import { employerDashboard } from '../../data/employerDashboardData.js'

function EmployerDashboard() {
  const { heading, support, stats, activeJobs, recentApplications, upcomingInterviews } =
    employerDashboard

  return (
    <PageContent
      title={heading}
      description={support}
      actions={<Button to="/employer/jobs/create">Create Job Posting</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <section className="po-section-block">
        <SectionHeader
          title="Active job postings"
          action={
            <Button to="/employer/jobs" size="sm" variant="ghost">
              View All Jobs
            </Button>
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {activeJobs.map((job) => (
            <Card key={job.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="po-card-title">{job.jobTitle}</h3>
                  <p className="po-helper mt-1">
                    Posted {job.postedDateLabel} · Closes {job.closingDateLabel}
                  </p>
                </div>
                <Badge status={job.jobStatus.toLowerCase()} className="normal-case">
                  {job.jobStatus}
                </Badge>
              </div>
              <p className="po-secondary mt-4">{job.applicants} applicants</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" to={`/employer/jobs/${job.id}`}>
                  View
                </Button>
                <Button size="sm" to={`/employer/jobs/${job.id}/edit`}>
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="po-section-block">
        <SectionHeader title="Recent applications" />
        <Table
          minWidthClass="min-w-[720px]"
          headers={['Candidate', 'Job', 'Compatibility', 'Applied Date', 'Status']}
          rows={recentApplications.map((item) => [
            item.fullName,
            item.jobTitle === 'Junior Software Developer' ? 'Junior Developer' : item.jobTitle,
            `${item.compatibility}%`,
            item.appliedDate,
            <Badge key={`${item.id}-status`} status={item.status.toLowerCase()} className="normal-case">
              {item.status}
            </Badge>,
          ])}
        />
      </section>

      <section className="po-section-block">
        <SectionHeader
          title="Upcoming interviews"
          action={<Button to="/employer/interviews">Manage Interviews</Button>}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {upcomingInterviews.map((item) => (
            <Card key={item.id} padding="sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="po-card-title">{item.candidate}</h3>
                  <p className="po-helper mt-0">{item.jobTitle}</p>
                </div>
                <Badge status={item.interviewStatus.toLowerCase()} className="normal-case">
                  {item.interviewStatus}
                </Badge>
              </div>
              <dl className="po-secondary mt-4 grid gap-2 sm:grid-cols-2">
                <DetailItem label="Date" value={item.interviewDateLabel} />
                <DetailItem label="Time" value={item.interviewTimeLabel} />
                <DetailItem label="Method" value={item.method} />
                <DetailItem label="Status" value={item.interviewStatus} />
              </dl>
            </Card>
          ))}
        </div>
      </section>
    </PageContent>
  )
}

export default EmployerDashboard
