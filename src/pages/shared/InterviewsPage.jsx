import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import { interviewHistory, interviewSummary, upcomingInterview } from '../../data/interviews.js'

function InterviewsPage() {
  const [toast, setToast] = useState('')

  return (
    <PageContent
      title="Interviews"
      description="View your upcoming and previous interview arrangements."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {interviewSummary.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <Card className="mt-8">
        <p className="po-secondary">Upcoming interview</p>
        <h2 className="po-section-title mt-1">{upcomingInterview.title}</h2>
        <dl className="po-secondary mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="po-helper">Company</dt>
            <dd className="font-medium text-ink">{upcomingInterview.company}</dd>
          </div>
          <div>
            <dt className="po-helper">Date</dt>
            <dd className="font-medium text-ink">{upcomingInterview.date}</dd>
          </div>
          <div>
            <dt className="po-helper">Time</dt>
            <dd className="font-medium text-ink">{upcomingInterview.time}</dd>
          </div>
          <div>
            <dt className="po-helper">Method</dt>
            <dd className="font-medium text-ink">{upcomingInterview.method}</dd>
          </div>
          <div>
            <dt className="po-helper">Location / Link</dt>
            <dd className="font-medium text-ink">{upcomingInterview.locationOrLink}</dd>
          </div>
          <div>
            <dt className="po-helper">Status</dt>
            <dd>
              <Badge status="scheduled" className="normal-case">
                {upcomingInterview.status}
              </Badge>
            </dd>
          </div>
        </dl>
        <div className="mt-5">
          <p className="po-helper">Notes</p>
          <p className="po-body mt-1">{upcomingInterview.notes}</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="secondary" to="/jobseeker/applications">
            View Details
          </Button>
          <Button
            onClick={() => {
              setToast('The interview link is not available yet.')
              window.setTimeout(() => setToast(''), 2500)
            }}
          >
            Join Interview
          </Button>
        </div>
      </Card>

      <section className="po-section-block">
        <SectionHeader title="Interview history" />
        <Table
          minWidthClass="min-w-[640px]"
          headers={['Job', 'Company', 'Date', 'Method', 'Status']}
          rows={interviewHistory.map((item) => [
            item.job,
            item.company,
            item.date,
            item.method,
            <Badge key={`${item.job}-status`} status={item.status.toLowerCase()} className="normal-case">
              {item.status}
            </Badge>,
          ])}
        />
      </section>

      <Toast message={toast} />
    </PageContent>
  )
}

export default InterviewsPage
