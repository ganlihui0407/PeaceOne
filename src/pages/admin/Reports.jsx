import { useState } from 'react'
import Button from '../../components/common/Button.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import {
  adminReportSummary,
  jobPostingBars,
  learningActivity,
  mostRecommendedSkills,
  recruitmentFunnel,
  topCareerTargets,
  userActivityBars,
} from '../../data/adminReports.js'

function BarChart({ title, items }) {
  return (
    <Card>
      <h2 className="po-section-title">{title}</h2>
      <p className="po-helper">Activity across PeaceOne over recent months.</p>
      <div className="mt-6 flex h-44 items-end gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <p className="text-xs font-medium text-ink">{item.value}</p>
            <div className="flex h-32 w-full items-end rounded-md bg-page">
              <div className="w-full rounded-md bg-primary" style={{ height: item.height }} />
            </div>
            <p className="text-xs text-muted">{item.label}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function FunnelList({ title, items }) {
  return (
    <Card>
      <h2 className="po-section-title">{title}</h2>
      <p className="po-helper">Current volumes across this PeaceOne workspace.</p>
      <ul className="mt-5 space-y-4">
        {items.map((item) => (
          <li key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">{item.label}</p>
              <p className="text-sm font-semibold text-ink">{item.value}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-page">
              <div className="h-full rounded-full bg-primary" style={{ width: item.width }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Reports() {
  const [toast, setToast] = useState('')

  return (
    <PageContent
      title="Reports & Analysis"
      description="Review platform activity and recruitment performance indicators."
      actions={
        <Button
          onClick={() => {
            setToast('Report export is not available yet.')
            window.setTimeout(() => setToast(''), 2500)
          }}
        >
          Export Report
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {adminReportSummary.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <BarChart title="User Activity" items={userActivityBars} />
        <BarChart title="Job Posting Activity" items={jobPostingBars} />
        <FunnelList title="Recruitment Funnel" items={recruitmentFunnel} />
        <FunnelList title="Learning Activity" items={learningActivity} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Top Career Targets" />
          <Table
            minWidthClass="min-w-[360px]"
            headers={['Career Target', 'Learners']}
            rows={topCareerTargets.map((item) => [item.career, item.learners])}
          />
        </div>
        <div>
          <SectionHeader title="Most Recommended Skills" />
          <Table
            minWidthClass="min-w-[360px]"
            headers={['Skill', 'Recommendations']}
            rows={mostRecommendedSkills.map((item) => [item.skill, item.recommendations])}
          />
        </div>
      </div>
      <Toast message={toast} />
    </PageContent>
  )
}

export default Reports
