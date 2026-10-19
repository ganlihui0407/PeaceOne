import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { jobSeekerApplications, studentApplications } from '../../data/applications.js'

function ApplicationsPage({ variant = 'student' }) {
  const isJobSeeker = variant === 'jobseeker'
  const data = isJobSeeker ? jobSeekerApplications : studentApplications
  const [selected, setSelected] = useState(null)

  return (
    <PageContent
      title="My Applications"
      description="Track the status of your job applications."
    >
      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${isJobSeeker ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        {data.summary.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="mt-8">
        <Table
          minWidthClass="min-w-[760px]"
          headers={
            isJobSeeker
              ? ['Job', 'Company', 'Applied Date', 'Status', 'Compatibility', 'Actions']
              : ['Job', 'Company', 'Applied Date', 'Status', 'Career Fit', 'Actions']
          }
          rows={data.items.map((item) => [
            item.job,
            item.company,
            item.appliedDate,
            <Badge key={`${item.id}-status`} status={item.status.toLowerCase()} className="normal-case">
              {item.status}
            </Badge>,
            isJobSeeker ? item.compatibility : item.careerFit,
            <Button key={`${item.id}-view`} size="sm" variant="secondary" onClick={() => setSelected(item)}>
              View Details
            </Button>,
          ])}
        />
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected ? selected.job : 'Application'}
        size="lg"
        onClose={() => setSelected(null)}
        footer={
          <Button variant="secondary" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="po-helper">Job</dt>
                <dd className="font-medium text-ink">{selected.job}</dd>
              </div>
              <div>
                <dt className="po-helper">Company</dt>
                <dd className="font-medium text-ink">{selected.company}</dd>
              </div>
              <div>
                <dt className="po-helper">Resume submitted</dt>
                <dd className="font-medium text-ink">{selected.resume}</dd>
              </div>
              <div>
                <dt className="po-helper">Applied date</dt>
                <dd className="font-medium text-ink">{selected.appliedDate}</dd>
              </div>
              <div>
                <dt className="po-helper">Status</dt>
                <dd>
                  <Badge status={selected.status.toLowerCase()} className="normal-case">
                    {selected.status}
                  </Badge>
                </dd>
              </div>
            </dl>
            <div>
              <h3 className="po-card-title">Application timeline</h3>
              <ol className="mt-3 space-y-3">
                {selected.timeline.map((event) => (
                  <li key={`${event.date}-${event.label}`} className="flex gap-3">
                    <span className="w-16 shrink-0 text-sm font-medium text-ink">{event.date}</span>
                    <span className="po-secondary">{event.label}</span>
                  </li>
                ))}
              </ol>
            </div>
            {selected.status === 'Interview' ? (
              <Card padding="sm">
                <p className="text-sm font-medium text-ink">Interview arrangement</p>
                <p className="po-secondary mt-1">
                  28 August 2026, 10:30 AM · Online · Microsoft Teams. Full interview details are shown on the
                  Interviews page for Job Seekers.
                </p>
              </Card>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </PageContent>
  )
}

export default ApplicationsPage
