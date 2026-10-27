import { useMemo, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Table from '../../components/common/Table.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  applicantJobFilters,
  applicationStatuses,
  employerApplicants,
} from '../../data/applicants.js'

function Applicants() {
  const [jobFilter, setJobFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    return employerApplicants.filter((item) => {
      const matchesJob = jobFilter === 'All' || item.jobTitle === jobFilter
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter
      const matchesQuery = item.fullName.toLowerCase().includes(query.trim().toLowerCase())
      return matchesJob && matchesStatus && matchesQuery
    })
  }, [jobFilter, statusFilter, query])

  return (
    <PageContent
      title="Applicants"
      description="Review candidates who have applied to your job postings."
    >
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SelectInput
          id="applicant-job-filter"
          label="Job Posting"
          value={jobFilter}
          onChange={(event) => setJobFilter(event.target.value)}
          options={applicantJobFilters}
        />
        <SelectInput
          id="applicant-status-filter"
          label="Application Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={['All', ...applicationStatuses]}
        />
        <SearchInput
          id="applicant-search"
          label="Search Candidate"
          value={query}
          placeholder="Search by name"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <Table
        minWidthClass="min-w-[880px]"
        headers={['Candidate', 'Applied Job', 'Applied Date', 'Compatibility', 'Status', 'Actions']}
        rows={rows.map((item) => [
          item.fullName,
          item.jobTitle,
          item.appliedDate,
          `${item.compatibility}%`,
          <Badge key={`${item.id}-status`} status={item.status.toLowerCase()} className="normal-case">
            {item.status}
          </Badge>,
          <Button key={`${item.id}-view`} size="sm" variant="secondary" to={`/employer/applicants/${item.id}`}>
            View
          </Button>,
        ])}
      />
    </PageContent>
  )
}

export default Applicants
