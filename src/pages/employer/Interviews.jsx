import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { employerInterviews, employerInterviewSummary } from '../../data/employerInterviews.js'

function EmployerInterviews() {
  const [selected, setSelected] = useState(null)
  const [cancelledIds, setCancelledIds] = useState([])
  const [toast, setToast] = useState('')

  const rows = employerInterviews.map((item) =>
    cancelledIds.includes(item.id) ? { ...item, interviewStatus: 'Cancelled' } : item,
  )

  function cancelInterview(item) {
    setCancelledIds((current) => (current.includes(item.id) ? current : [...current, item.id]))
    setSelected(null)
    setToast('Interview cancelled.')
    window.setTimeout(() => setToast(''), 2500)
  }

  return (
    <PageContent
      title="Interview Management"
      description="Manage interview arrangements for shortlisted candidates."
      actions={<Button to="/employer/interviews/create">Schedule Interview</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {employerInterviewSummary.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="mt-8">
        <Table
          minWidthClass="min-w-[980px]"
          headers={['Candidate', 'Job', 'Date & Time', 'Method', 'Location / Link', 'Status', 'Actions']}
          rows={rows.map((item) => [
            item.candidate,
            item.jobTitle,
            `${item.interviewDateLabel}, ${item.interviewTimeLabel}`,
            item.method,
            item.locationOrLink,
            <Badge
              key={`${item.id}-status`}
              status={item.interviewStatus.toLowerCase()}
              className="normal-case"
            >
              {item.interviewStatus}
            </Badge>,
            <div key={`${item.id}-actions`} className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSelected(item)}>
                View
              </Button>
              <Button size="sm" variant="secondary" to={`/employer/interviews/${item.id}/edit`}>
                Edit
              </Button>
              {item.interviewStatus !== 'Cancelled' ? (
                <Button size="sm" variant="ghost" onClick={() => cancelInterview(item)}>
                  Cancel
                </Button>
              ) : null}
            </div>,
          ])}
        />
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected ? `${selected.candidate} · ${selected.jobTitle}` : 'Interview'}
        size="lg"
        onClose={() => setSelected(null)}
        footer={
          <>
            {selected && selected.interviewStatus !== 'Cancelled' ? (
              <Button variant="danger" onClick={() => cancelInterview(selected)}>
                Cancel Interview
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
          </>
        }
      >
        {selected ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="po-helper">Candidate</dt>
              <dd className="font-medium text-ink">{selected.candidate}</dd>
            </div>
            <div>
              <dt className="po-helper">Job</dt>
              <dd className="font-medium text-ink">{selected.jobTitle}</dd>
            </div>
            <div>
              <dt className="po-helper">Date & Time</dt>
              <dd className="font-medium text-ink">
                {selected.interviewDateLabel}, {selected.interviewTimeLabel}
              </dd>
            </div>
            <div>
              <dt className="po-helper">Method</dt>
              <dd className="font-medium text-ink">{selected.method}</dd>
            </div>
            <div>
              <dt className="po-helper">Location / Link</dt>
              <dd className="font-medium text-ink">{selected.locationOrLink}</dd>
            </div>
            <div>
              <dt className="po-helper">Status</dt>
              <dd>
                <Badge status={selected.interviewStatus.toLowerCase()} className="normal-case">
                  {selected.interviewStatus}
                </Badge>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="po-helper">Notes</dt>
              <dd className="po-body mt-1">{selected.notes || '—'}</dd>
            </div>
          </dl>
        ) : null}
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default EmployerInterviews
