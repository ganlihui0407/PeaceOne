import { useMemo, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import {
  MASCO_LIST_LIMIT,
  MASCO_MAPPING_STATUSES,
  fetchMascoCrosswalks,
  formatMascoStatusLabel,
  isMascoOccupationCode,
  mappingStatusTone,
  mascoOccupationPath,
  reviewDecisionTone,
} from '../../api/masco.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

const mappingStatusOptions = [
  { value: '', label: 'All' },
  ...MASCO_MAPPING_STATUSES.map((value) => ({
    value,
    label: formatMascoStatusLabel(value),
  })),
]

function MascoCrosswalks() {
  const [historicalInput, setHistoricalInput] = useState('')
  const [currentInput, setCurrentInput] = useState('')
  const [statusInput, setStatusInput] = useState('')
  const [appliedHistorical, setAppliedHistorical] = useState('')
  const [appliedCurrent, setAppliedCurrent] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const [filterError, setFilterError] = useState('')

  const extraParams = useMemo(
    () => ({
      ...(appliedHistorical ? { historicalCode: appliedHistorical } : {}),
      ...(appliedCurrent ? { currentCode: appliedCurrent } : {}),
      ...(appliedStatus ? { mappingStatus: appliedStatus } : {}),
    }),
    [appliedCurrent, appliedHistorical, appliedStatus],
  )

  const list = useEscoPagedSearch(fetchMascoCrosswalks, {
    limit: MASCO_LIST_LIMIT,
    extraParams,
  })

  const hasFilters =
    historicalInput !== '' ||
    currentInput !== '' ||
    statusInput !== '' ||
    appliedHistorical !== '' ||
    appliedCurrent !== '' ||
    appliedStatus !== ''

  function applyFilters(event) {
    event.preventDefault()
    const nextHistorical = historicalInput.trim()
    const nextCurrent = currentInput.trim()
    if (nextHistorical && !isMascoOccupationCode(nextHistorical)) {
      setFilterError('Enter a MASCO occupation code like 1219-01, or leave the historical code blank.')
      return
    }
    if (nextCurrent && !isMascoOccupationCode(nextCurrent)) {
      setFilterError('Enter a MASCO occupation code like 1324-06, or leave the current code blank.')
      return
    }
    setFilterError('')
    setHistoricalInput(nextHistorical)
    setCurrentInput(nextCurrent)
    setAppliedHistorical(nextHistorical)
    setAppliedCurrent(nextCurrent)
    setAppliedStatus(statusInput)
    list.search(event)
  }

  function clearFilters() {
    setFilterError('')
    setHistoricalInput('')
    setCurrentInput('')
    setStatusInput('')
    setAppliedHistorical('')
    setAppliedCurrent('')
    setAppliedStatus('')
    list.resetSearch()
  }

  return (
    <PageContent
      title="MASCO Crosswalks"
      description="Official MASCO 2013 to 2020 historical occupation mappings. This catalogue is admin-only and is not used for Career Target, Skill Gap or saved skills."
    >
      <Card>
        <form className="grid gap-4 lg:grid-cols-12" onSubmit={applyFilters}>
          <div className="lg:col-span-3">
            <TextInput
              id="masco-historical-code"
              label="Historical code (2013)"
              value={historicalInput}
              placeholder="1219-01"
              autoComplete="off"
              maxLength={7}
              helperText="Optional MASCO 2013 occupation code."
              onChange={(event) => {
                setHistoricalInput(event.target.value)
                if (filterError) {
                  setFilterError('')
                }
              }}
            />
          </div>
          <div className="lg:col-span-3">
            <TextInput
              id="masco-current-code"
              label="Current code (2020)"
              value={currentInput}
              placeholder="1324-06"
              autoComplete="off"
              maxLength={7}
              helperText="Optional MASCO 2020 occupation code."
              onChange={(event) => {
                setCurrentInput(event.target.value)
                if (filterError) {
                  setFilterError('')
                }
              }}
            />
          </div>
          <div className="lg:col-span-4">
            <SelectInput
              id="masco-mapping-status"
              label="Mapping status"
              value={statusInput}
              options={mappingStatusOptions}
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
        {filterError ? <p className="po-secondary mt-4 text-danger">{filterError}</p> : null}
      </Card>

      <section className="mt-6">
        <QueryStatus
          loading={list.loading}
          error={list.error}
          empty={list.items.length === 0}
          loadingLabel="Loading MASCO crosswalks…"
          emptyTitle="No historical mappings match these filters."
          emptyDescription="Try a different 2013 or 2020 occupation code, or choose All for mapping status."
          onRetry={list.retry}
        >
          <Table
            minWidthClass="min-w-[980px]"
            emptyTitle="No historical mappings match these filters."
            headers={[
              'Historical Code (2013)',
              'Current Code (2020)',
              'Mapping Status',
              'Review Decision',
              'View Current Occupation',
            ]}
            rows={list.items.map((item) => [
              item.historicalCode,
              item.currentCode,
              <Badge
                key={`${item.historicalCode}-${item.currentCode}-status`}
                tone={mappingStatusTone(item.mappingStatus)}
                className="normal-case"
              >
                {formatMascoStatusLabel(item.mappingStatus)}
              </Badge>,
              <Badge
                key={`${item.historicalCode}-${item.currentCode}-review`}
                tone={reviewDecisionTone(item.reviewDecision)}
                className="normal-case"
              >
                {formatMascoStatusLabel(item.reviewDecision)}
              </Badge>,
              <Button
                key={`${item.historicalCode}-${item.currentCode}-view`}
                size="sm"
                variant="secondary"
                to={mascoOccupationPath(item.currentCode)}
              >
                View Current Occupation
              </Button>,
            ])}
          />
          <PaginationBar
            page={list.meta.page}
            totalPages={list.meta.totalPages}
            total={list.meta.total}
            noun="mappings"
            disabled={list.loading}
            onPrevious={() => list.goToPage(list.page - 1)}
            onNext={() => list.goToPage(list.page + 1)}
          />
        </QueryStatus>
      </section>
    </PageContent>
  )
}

export default MascoCrosswalks
