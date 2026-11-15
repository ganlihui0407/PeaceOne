import { useMemo, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  JOB_LIST_LIMIT,
  JOB_STATUS_OPTIONS,
  canCloseStaffJob,
  canDeleteJob,
  canEditJob,
  canPublishJob,
  closeStaffJob,
  deleteStaffJob,
  fetchStaffJobs,
  formatEmploymentType,
  formatJobDate,
  formatJobStatus,
  formatSalaryRange,
  jobStatusTone,
  publishStaffJob,
  staffJobCreatePath,
  staffJobEditPath,
  staffJobPath,
  userFacingJobError,
} from '../../api/jobs.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

function ManageJobs() {
  const [statusInput, setStatusInput] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const [busyId, setBusyId] = useState('')
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')
  const [publishTarget, setPublishTarget] = useState(null)
  const [closeTarget, setCloseTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const extraParams = useMemo(
    () => (appliedStatus ? { status: appliedStatus } : {}),
    [appliedStatus],
  )
  const list = useEscoPagedSearch(fetchStaffJobs, {
    limit: JOB_LIST_LIMIT,
    extraParams,
    formatError: userFacingJobError,
  })

  const companyMissing = list.error.includes('company profile')
  const hasFilters = list.input !== '' || list.query !== '' || statusInput !== '' || appliedStatus !== ''

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

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

  async function runAction(jobId, action, successMessage) {
    setBusyId(jobId)
    setActionError('')
    try {
      await action()
      showToast(successMessage)
      list.retry()
    } catch (error) {
      setActionError(userFacingJobError(error))
    } finally {
      setBusyId('')
      setPublishTarget(null)
      setCloseTarget(null)
      setDeleteTarget(null)
    }
  }

  return (
    <PageContent
      title="Manage Job Postings"
      description="Create, review and maintain your company vacancies."
      actions={<Button to={staffJobCreatePath()}>Create Job Posting</Button>}
    >
      {companyMissing ? (
        <Card className="mb-6">
          <p className="po-body">{list.error}</p>
          <div className="mt-4">
            <Button to="/employer/company">Open Company Profile</Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <form className="grid gap-4 lg:grid-cols-12" onSubmit={applyFilters}>
          <div className="lg:col-span-6">
            <SearchInput
              id="job-search"
              label="Search jobs"
              value={list.input}
              placeholder="Search by title or location"
              onChange={(event) => list.setInput(event.target.value)}
            />
          </div>
          <div className="lg:col-span-4">
            <SelectInput
              id="job-status-filter"
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

      {actionError ? <p className="po-helper mt-4 text-danger">{actionError}</p> : null}

      <section className="mt-6">
        {companyMissing ? null : (
        <QueryStatus
          loading={list.loading}
          error={list.error}
          empty={list.items.length === 0}
          loadingLabel="Loading job postings…"
          emptyTitle="No job postings match these filters."
          emptyDescription="Create a job posting to save a draft. Published jobs appear to students and job seekers immediately."
          emptyAction={<Button to={staffJobCreatePath()}>Create Job Posting</Button>}
          onRetry={list.retry}
        >
          <Table
            minWidthClass="min-w-[1080px]"
            headers={[
              'Job title',
              'Employment type',
              'Location',
              'Salary',
              'Status',
              'Created',
              'Published',
              'Closing date',
              'Actions',
            ]}
            rows={list.items.map((job) => [
              job.title,
              formatEmploymentType(job.employmentType),
              job.location,
              formatSalaryRange(job),
              <Badge key={`${job.id}-status`} tone={jobStatusTone(job.status)} className="normal-case">
                {formatJobStatus(job.status)}
              </Badge>,
              formatJobDate(job.createdAt),
              formatJobDate(job.publishedAt),
              formatJobDate(job.closesAt),
              <div key={`${job.id}-actions`} className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" to={staffJobPath(job.id)}>
                  View
                </Button>
                {canEditJob(job) ? (
                  <Button size="sm" variant="secondary" to={staffJobEditPath(job.id)}>
                    Edit
                  </Button>
                ) : null}
                {canPublishJob(job) ? (
                  <Button
                    size="sm"
                    disabled={Boolean(busyId)}
                    onClick={() => setPublishTarget(job)}
                  >
                    Publish
                  </Button>
                ) : null}
                {canCloseStaffJob(job) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={Boolean(busyId)}
                    onClick={() => setCloseTarget(job)}
                  >
                    Close
                  </Button>
                ) : null}
                {canDeleteJob(job) ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={Boolean(busyId)}
                    onClick={() => setDeleteTarget(job)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>,
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
        )}
      </section>

      <Modal
        open={Boolean(publishTarget)}
        title="Publish job posting"
        onClose={() => setPublishTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={Boolean(busyId)}
              onClick={() =>
                runAction(publishTarget.id, () => publishStaffJob(publishTarget.id), 'Job posting published.')
              }
            >
              Publish
            </Button>
          </>
        }
      >
        <p className="po-body">
          Publishing makes this vacancy visible to students and job seekers immediately. You can close it later if the
          role is filled.
        </p>
      </Modal>

      <Modal
        open={Boolean(closeTarget)}
        title="Close job posting"
        onClose={() => setCloseTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={Boolean(busyId)}
              onClick={() => runAction(closeTarget.id, () => closeStaffJob(closeTarget.id), 'Job posting closed.')}
            >
              Close vacancy
            </Button>
          </>
        }
      >
        <p className="po-body">Closed jobs are hidden from candidate search. This cannot be undone from this screen.</p>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete draft job"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={Boolean(busyId)}
              onClick={() =>
                runAction(
                  deleteTarget.id,
                  () => deleteStaffJob(deleteTarget.id),
                  'Draft job posting deleted.',
                )
              }
            >
              Delete draft
            </Button>
          </>
        }
      >
        <p className="po-body">Only draft jobs can be deleted. Published job history is kept.</p>
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default ManageJobs
