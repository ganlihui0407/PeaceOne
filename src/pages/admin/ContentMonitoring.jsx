import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { adminContentMonitoring } from '../../data/adminContentMonitoring.js'

function ContentMonitoring() {
  const [statusById, setStatusById] = useState({})
  const [hiddenIds, setHiddenIds] = useState([])
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  const rows = adminContentMonitoring
    .filter((item) => !hiddenIds.includes(item.id))
    .map((item) => ({
      ...item,
      status: statusById[item.id] || item.status,
    }))

  function keepItem(item) {
    setStatusById((current) => ({ ...current, [item.id]: 'Approved' }))
    setSelected(null)
    showToast('Content kept.')
  }

  function removeItem(item) {
    setHiddenIds((current) => (current.includes(item.id) ? current : [...current, item.id]))
    setSelected(null)
    showToast('Content removed from the current list.')
  }

  return (
    <PageContent
      title="Content Monitoring"
      description="Review flagged job postings and learning resources."
    >
      <Table
        minWidthClass="min-w-[960px]"
        headers={['Content', 'Content Type', 'Submitted By', 'Reason', 'Status', 'Date', 'Actions']}
        rows={rows.map((item) => [
          item.content,
          item.contentType,
          item.submittedBy,
          item.reason,
          <Badge key={`${item.id}-status`} status={item.status.toLowerCase()} className="normal-case">
            {item.status}
          </Badge>,
          item.date,
          <div key={`${item.id}-actions`} className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelected(item)}>
              Review
            </Button>
            <Button size="sm" variant="ghost" onClick={() => keepItem(item)}>
              Keep
            </Button>
            <Button size="sm" variant="ghost" onClick={() => removeItem(item)}>
              Remove
            </Button>
          </div>,
        ])}
      />

      <Modal
        open={Boolean(selected)}
        title={selected ? selected.content : 'Content review'}
        size="lg"
        onClose={() => setSelected(null)}
        footer={
          selected ? (
            <>
              <Button variant="secondary" onClick={() => keepItem(selected)}>
                Keep
              </Button>
              <Button variant="danger" onClick={() => removeItem(selected)}>
                Remove
              </Button>
            </>
          ) : null
        }
      >
        {selected ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="po-helper">Content Type</dt>
              <dd className="font-medium text-ink">{selected.contentType}</dd>
            </div>
            <div>
              <dt className="po-helper">Submitted By</dt>
              <dd className="font-medium text-ink">{selected.submittedBy}</dd>
            </div>
            <div>
              <dt className="po-helper">Date</dt>
              <dd className="font-medium text-ink">{selected.date}</dd>
            </div>
            <div>
              <dt className="po-helper">Status</dt>
              <dd>
                <Badge status={selected.status.toLowerCase()} className="normal-case">
                  {selected.status}
                </Badge>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="po-helper">Reason</dt>
              <dd className="po-body mt-1">{selected.reason}</dd>
            </div>
          </dl>
        ) : null}
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default ContentMonitoring
