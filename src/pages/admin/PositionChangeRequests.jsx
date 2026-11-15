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
  POSITION_CHANGE_LIST_LIMIT,
  POSITION_CHANGE_STATUSES,
  fetchAdminPositionChangeRequests,
  formatPositionChangeStatus,
  formatRequestDate,
  positionChangeRequestPath,
  positionChangeStatusTone,
} from '../../api/positionChangeRequests.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...POSITION_CHANGE_STATUSES.map((value) => ({
    value,
    label: formatPositionChangeStatus(value),
  })),
]

function PositionChangeRequests() {
  const [statusInput, setStatusInput] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')

  const extraParams = useMemo(
    () => (appliedStatus ? { status: appliedStatus } : {}),
    [appliedStatus],
  )

  const list = useEscoPagedSearch(fetchAdminPositionChangeRequests, {
    limit: POSITION_CHANGE_LIST_LIMIT,
    extraParams,
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
      title="Position Change Requests"
      description="Review company staff position change requests. Approving a request updates that staff member's stored position."
    >
      <Card>
        <form className="grid gap-4 lg:grid-cols-12" onSubmit={applyFilters}>
          <div className="lg:col-span-6">
            <SearchInput
              id="position-request-search"
              label="Search staff"
              value={list.input}
              placeholder="Name or email"
              onChange={(event) => list.setInput(event.target.value)}
            />
          </div>
          <div className="lg:col-span-4">
            <SelectInput
              id="position-request-status"
              label="Status"
              value={statusInput}
              options={statusOptions}
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
              Clear filters
            </Button>
          </div>
        </form>
      </Card>

      <section className="mt-6">
        <QueryStatus
          loading={list.loading}
          error={list.error}
          empty={list.items.length === 0}
          loadingLabel="Loading position change requests…"
          emptyTitle="No position change requests match these filters."
          emptyDescription="Staff requests appear here after they are submitted. Try a different name, email or status."
          onRetry={list.retry}
        >
          <Table
            minWidthClass="min-w-[980px]"
            emptyTitle="No position change requests match these filters."
            headers={['Staff', 'Current position', 'Requested position', 'Status', 'Submitted', 'Review']}
            rows={list.items.map((item) => [
              <div key={`${item.id}-staff`}>
                <p className="font-medium text-ink">{item.user?.fullName ?? '—'}</p>
                <p className="po-helper mt-0">{item.user?.email ?? '—'}</p>
              </div>,
              item.currentPosition || 'Not set',
              item.requestedPosition,
              <Badge
                key={`${item.id}-status`}
                tone={positionChangeStatusTone(item.status)}
                className="normal-case"
              >
                {formatPositionChangeStatus(item.status)}
              </Badge>,
              formatRequestDate(item.createdAt),
              <Button
                key={`${item.id}-view`}
                size="sm"
                variant="secondary"
                to={positionChangeRequestPath(item.id)}
              >
                View
              </Button>,
            ])}
          />
          <PaginationBar
            page={list.meta.page}
            totalPages={list.meta.totalPages}
            total={list.meta.total}
            noun="requests"
            disabled={list.loading}
            onPrevious={() => list.goToPage(list.page - 1)}
            onNext={() => list.goToPage(list.page + 1)}
          />
        </QueryStatus>
      </section>
    </PageContent>
  )
}

export default PositionChangeRequests
