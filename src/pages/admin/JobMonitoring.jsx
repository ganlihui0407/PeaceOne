import { useMemo, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  JOB_LIST_LIMIT,
  JOB_STATUS_OPTIONS,
  adminJobPath,
  fetchAdminJobs,
  formatEmploymentType,
  formatJobDate,
  formatJobStatus,
  jobStatusTone,
  userFacingJobError,
} from '../../api/jobs.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

function JobMonitoring() {
  const [statusInput, setStatusInput] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const extraParams = useMemo(
    () => (appliedStatus ? { status: appliedStatus } : {}),
    [appliedStatus],
  )
  const list = useEscoPagedSearch(fetchAdminJobs, {
    limit: JOB_LIST_LIMIT,
    extraParams,
    formatError: userFacingJobError,
  })
  const hasFilters = list.input !== '' || list.query !== '' || statusInput !== '' || appliedStatus !== ''

  function applyFilters(event) {
    event.preventDefault()
    setAppliedStatus(statusInput)
    list.search(event)
  }

  function clearFilters() {
    setStatusInput('')
    setAppliedStatus('')
    list.resetSearch()
  }

  return (
    <PageContent
      title="Job Monitoring"
      description="Review stored job postings. Suspend or close listings that do not meet platform policy."
    >
      <Card>
        <form className="grid gap-4 lg:grid-cols-12" onSubmit={applyFilters}>
          <div className="lg:col-span-6">
            <SearchInput
              id="admin-job-search"
              label="Search jobs"
              value={list.input}
              placeholder="Search by title or company"
              onChange={(event) => list.setInput(event.target.value)}
            />
          </div>
          <div className="lg:col-span-4">
            <SelectInput
              id="admin-job-status"
              label="Status"
              value={statusInput}
              options={JOB_STATUS_OPTIONS}
              onChange={(event) => setStatusInput(event.target.value)}
            />
          </div>
          <div className="flex flex-col justify-end gap-2 sm:flex-row lg:col-span-2">
            <Button type="submit" className="w-full" disabled={list.loading}>
              Search
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={list.loading || !hasFilters}
              onClick={clearFilters}
            >
              Clear
            </Button>
          </div>
        </form>
      </Card>

      <section className="mt-6">
        <QueryStatus
          loading={list.loading}
          error={list.error}
          empty={list.items.length === 0}
          loadingLabel="Loading job postings…"
          emptyTitle="No job postings match these filters."
          emptyDescription="Employer vacancies appear here after they are saved. Try a different title, company or status."
          onRetry={list.retry}
        >
          <Table
            minWidthClass="min-w-[1080px]"
            headers={[
              'Job title',
              'Company',
              'Location',
              'Employment type',
              'Employer',
              'Created',
              'Published',
              'Status',
              'Actions',
            ]}
            rows={list.items.map((job) => [
              job.title,
              job.company.companyName,
              job.location,
              formatEmploymentType(job.employmentType),
              job.createdBy?.fullName || '—',
              formatJobDate(job.createdAt),
              formatJobDate(job.publishedAt),
              <Badge key={`${job.id}-status`} tone={jobStatusTone(job.status)} className="normal-case">
                {formatJobStatus(job.status)}
              </Badge>,
              <Button key={`${job.id}-view`} size="sm" variant="secondary" to={adminJobPath(job.id)}>
                View
              </Button>,
            ])}
          />
          <PaginationBar
            page={list.meta.page}
            totalPages={list.meta.totalPages}
            total={list.meta.total}
            noun="jobs"
            disabled={list.loading}
            onPrevious={() => list.goToPage(list.page - 1)}
            onNext={() => list.goToPage(list.page + 1)}
          />
        </QueryStatus>
      </section>
    </PageContent>
  )
}

export default JobMonitoring
