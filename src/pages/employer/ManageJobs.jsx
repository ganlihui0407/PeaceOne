import { useMemo, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import Table from '../../components/common/Table.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import { employerJobs, jobStatuses } from '../../data/employerJobs.js'

function ManageJobs() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [closedIds, setClosedIds] = useState([])
  const [toast, setToast] = useState('')

  const rows = useMemo(() => {
    return employerJobs
      .map((job) => ({
        ...job,
        jobStatus: closedIds.includes(job.id) ? 'Closed' : job.jobStatus,
      }))
      .filter((job) => {
        const matchesStatus = status === 'All' || job.jobStatus === status
        const haystack = `${job.jobTitle} ${job.location} ${job.employmentType}`.toLowerCase()
        const matchesQuery = haystack.includes(query.trim().toLowerCase())
        return matchesStatus && matchesQuery
      })
  }, [query, status, closedIds])

  function closeJob(jobId) {
    setClosedIds((current) => (current.includes(jobId) ? current : [...current, jobId]))
    setToast('Job posting closed.')
    window.setTimeout(() => setToast(''), 2500)
  }

  return (
    <PageContent
      title="Manage Job Postings"
      description="Create, review and maintain your company vacancies."
      actions={<Button to="/employer/jobs/create">Create Job Posting</Button>}
    >
      <div className="mb-6 grid gap-4 md:grid-cols-[1.4fr_220px]">
        <SearchInput
          id="job-search"
          label="Search Jobs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title or location"
        />
        <SelectInput
          id="job-status-filter"
          label="Status Filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={['All', ...jobStatuses]}
        />
      </div>

      <Table
        minWidthClass="min-w-[960px]"
        headers={[
          'Job Title',
          'Employment Type',
          'Location',
          'Posted Date',
          'Closing Date',
          'Status',
          'Applicants',
          'Actions',
        ]}
        rows={rows.map((job) => [
          job.jobTitle === 'Junior Software Developer' ? 'Junior Developer' : job.jobTitle,
          job.employmentType,
          job.location,
          job.postedDateLabel,
          job.closingDateLabel,
          <Badge key={`${job.id}-status`} status={job.jobStatus.toLowerCase()} className="normal-case">
            {job.jobStatus}
          </Badge>,
          String(job.applicants),
          <div key={`${job.id}-actions`} className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" to={`/employer/jobs/${job.id}`}>
              View
            </Button>
            <Button size="sm" variant="secondary" to={`/employer/jobs/${job.id}/edit`}>
              Edit
            </Button>
            {job.jobStatus !== 'Closed' ? (
              <Button size="sm" variant="ghost" onClick={() => closeJob(job.id)}>
                Close
              </Button>
            ) : null}
          </div>,
        ])}
      />
      <Toast message={toast} />
    </PageContent>
  )
}

export default ManageJobs
