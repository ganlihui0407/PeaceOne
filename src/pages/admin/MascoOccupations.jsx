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
import TextInput from '../../components/forms/TextInput.jsx'
import {
  MASCO_LIST_LIMIT,
  fetchMascoOccupations,
  formatRecordScope,
  isMascoUnitGroupCode,
  mascoOccupationPath,
  recordScopeTone,
} from '../../api/masco.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

const scopeOptions = [
  { value: '', label: 'All' },
  { value: 'V4_EXAMPLE', label: 'V4 Example' },
  { value: 'SUPPLEMENTAL_INDEX', label: 'Supplemental Index' },
]

function MascoOccupations() {
  const [scopeInput, setScopeInput] = useState('')
  const [unitGroupInput, setUnitGroupInput] = useState('')
  const [appliedScope, setAppliedScope] = useState('')
  const [appliedUnitGroup, setAppliedUnitGroup] = useState('')
  const [filterError, setFilterError] = useState('')

  const extraParams = useMemo(
    () => ({
      ...(appliedScope ? { scope: appliedScope } : {}),
      ...(appliedUnitGroup ? { unitGroup: appliedUnitGroup } : {}),
    }),
    [appliedScope, appliedUnitGroup],
  )

  const list = useEscoPagedSearch(fetchMascoOccupations, {
    limit: MASCO_LIST_LIMIT,
    extraParams,
  })

  const hasFilters =
    list.input !== '' ||
    list.query !== '' ||
    scopeInput !== '' ||
    unitGroupInput !== '' ||
    appliedScope !== '' ||
    appliedUnitGroup !== ''

  function applyFilters(event) {
    event.preventDefault()
    const nextUnitGroup = unitGroupInput.trim()
    if (nextUnitGroup && !isMascoUnitGroupCode(nextUnitGroup)) {
      setFilterError('Enter a 4-digit unit group code, or leave this blank.')
      return
    }
    setFilterError('')
    setUnitGroupInput(nextUnitGroup)
    setAppliedScope(scopeInput)
    setAppliedUnitGroup(nextUnitGroup)
    list.search(event)
  }

  function clearFilters() {
    setFilterError('')
    setScopeInput('')
    setUnitGroupInput('')
    setAppliedScope('')
    setAppliedUnitGroup('')
    list.resetSearch()
  }

  return (
    <PageContent
      title="MASCO Occupations"
      description="Browse official MASCO 2020 occupation records. This catalogue is separate from ESCO and is not used for Career Target, Skill Gap or saved skills."
    >
      <Card>
        <form className="grid gap-4 lg:grid-cols-12" onSubmit={applyFilters}>
          <div className="lg:col-span-4">
            <SearchInput
              id="masco-occupation-search"
              label="Search MASCO occupations"
              value={list.input}
              placeholder="Title or occupation code"
              onChange={(event) => list.setInput(event.target.value)}
            />
          </div>
          <div className="lg:col-span-3">
            <TextInput
              id="masco-unit-group"
              label="Unit group code"
              value={unitGroupInput}
              placeholder="2411"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              error={filterError}
              helperText={filterError ? undefined : 'Optional 4-digit MASCO unit group code.'}
              onChange={(event) => {
                setUnitGroupInput(event.target.value)
                if (filterError) {
                  setFilterError('')
                }
              }}
            />
          </div>
          <div className="lg:col-span-3">
            <SelectInput
              id="masco-record-scope"
              label="Record scope"
              value={scopeInput}
              options={scopeOptions}
              onChange={(event) => setScopeInput(event.target.value)}
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
          loadingLabel="Loading MASCO occupations…"
          emptyTitle="No MASCO occupations match these filters."
          emptyDescription="Try a different title or code, clear the unit group filter, or choose All for record scope."
          onRetry={list.retry}
        >
          <Table
            minWidthClass="min-w-[980px]"
            emptyTitle="No MASCO occupations match these filters."
            headers={[
              'Occupation Code',
              'Occupation Title',
              'Unit Group Code',
              'Unit Group Title',
              'Record Scope',
              'View Details',
            ]}
            rows={list.items.map((item) => [
              item.code,
              item.title,
              item.unitGroup.code,
              item.unitGroup.title,
              <Badge
                key={`${item.code}-scope`}
                tone={recordScopeTone(item.recordScope)}
                className="normal-case"
              >
                {formatRecordScope(item.recordScope)}
              </Badge>,
              <Button
                key={`${item.code}-view`}
                size="sm"
                variant="secondary"
                to={mascoOccupationPath(item.code)}
              >
                View Details
              </Button>,
            ])}
          />
          <PaginationBar
            page={list.meta.page}
            totalPages={list.meta.totalPages}
            total={list.meta.total}
            noun="occupations"
            disabled={list.loading}
            onPrevious={() => list.goToPage(list.page - 1)}
            onNext={() => list.goToPage(list.page + 1)}
          />
        </QueryStatus>
      </section>
    </PageContent>
  )
}

export default MascoOccupations
