import { useMemo, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import { adminJobCompanies, adminJobs, adminJobSummary, jobReviewStatuses } from '../../data/adminJobs.js'
import { jobStatuses } from '../../data/employerJobs.js'

function JobMonitoring() {
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState('All')
  const [jobStatus, setJobStatus] = useState('All')
  const [reviewStatus, setReviewStatus] = useState('All')
  const [reviewById, setReviewById] = useState({})
  const [hiddenIds, setHiddenIds] = useState([])
  const [removeTarget, setRemoveTarget] = useState(null)
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  const rows = useMemo(() => {
    return adminJobs
      .filter((job) => !hiddenIds.includes(job.id))
      .map((job) => ({
        ...job,
        reviewStatus: reviewById[job.id] || job.reviewStatus,
      }))
      .filter((job) => {
        const matchesCompany = company === 'All' || job.companyName === company
        const matchesStatus = jobStatus === 'All' || job.jobStatus === jobStatus
        const matchesReview = reviewStatus === 'All' || job.reviewStatus === reviewStatus
        const haystack = `${job.jobTitle} ${job.companyName}`.toLowerCase()
        return matchesCompany && matchesStatus && matchesReview && haystack.includes(query.trim().toLowerCase())
      })
  }, [query, company, jobStatus, reviewStatus, reviewById, hiddenIds])

  function setReview(jobId, nextStatus, message) {
    setReviewById((current) => ({ ...current, [jobId]: nextStatus }))
    showToast(message)
  }

  function confirmRemove() {
    if (!removeTarget) return
    setHiddenIds((current) => (current.includes(removeTarget.id) ? current : [...current, removeTarget.id]))
    setRemoveTarget(null)
    showToast('Job posting removed from the current list.')
  }

  return (
    <PageContent
      title="Job Monitoring"
      description="Review job postings and maintain platform content quality."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {adminJobSummary.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="mt-8 mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          id="admin-job-search"
          label="Search Job"
          value={query}
          placeholder="Search by title or company"
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectInput
          id="admin-job-company"
          label="Company"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          options={adminJobCompanies}
        />
        <SelectInput
          id="admin-job-status"
          label="Job Status"
          value={jobStatus}
          onChange={(event) => setJobStatus(event.target.value)}
          options={['All', ...jobStatuses]}
        />
        <SelectInput
          id="admin-job-review"
          label="Review Status"
          value={reviewStatus}
          onChange={(event) => setReviewStatus(event.target.value)}
          options={jobReviewStatuses}
        />
      </div>

      <Table
        minWidthClass="min-w-[980px]"
        headers={['Job Title', 'Company', 'Posted Date', 'Job Status', 'Review Status', 'Applicants', 'Actions']}
        rows={rows.map((job) => [
          job.jobTitle,
          job.companyName,
          job.postedDateLabel,
          <Badge key={`${job.id}-job`} status={job.jobStatus.toLowerCase()} className="normal-case">
            {job.jobStatus}
          </Badge>,
          <Badge key={`${job.id}-review`} status={job.reviewStatus.toLowerCase()} className="normal-case">
            {job.reviewStatus}
          </Badge>,
          String(job.applicants),
          <div key={`${job.id}-actions`} className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" to={`/admin/jobs/${job.id}`}>
              View
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReview(job.id, 'Approved', 'Job posting approved.')}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReview(job.id, 'Flagged', 'Job posting flagged.')}>
              Flag
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(job)}>
              Remove
            </Button>
          </div>,
        ])}
      />

      <Modal
        open={Boolean(removeTarget)}
        title="Remove job posting"
        onClose={() => setRemoveTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoveTarget(null)}>
              Close
            </Button>
            <Button variant="danger" onClick={confirmRemove}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="po-body">Are you sure you want to remove this job posting?</p>
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default JobMonitoring
