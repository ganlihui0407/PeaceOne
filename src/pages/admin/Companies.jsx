import { useMemo, useState } from 'react'
import Button from '../../components/common/Button.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import { fetchAdminCompanies, userFacingCompanyError } from '../../api/company.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

function Companies() {
  const extraParams = useMemo(() => ({}), [])
  const list = useEscoPagedSearch(fetchAdminCompanies, {
    limit: 20,
    extraParams,
    formatError: userFacingCompanyError,
  })
  const [submitted, setSubmitted] = useState(false)

  function applySearch(event) {
    setSubmitted(true)
    list.search(event)
  }

  return (
    <PageContent
      title="Companies"
      description="Registered employer companies stored in PostgreSQL. PeaceOne does not use a separate company status enum; job counts show current posting activity."
    >
      <form className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]" onSubmit={applySearch}>
        <SearchInput
          id="admin-company-search"
          label="Search companies"
          value={list.input}
          placeholder="Search by company name"
          onChange={(event) => list.setInput(event.target.value)}
        />
        <div className="flex items-end">
          <Button type="submit" disabled={list.loading}>Search</Button>
        </div>
      </form>
      {submitted && list.query ? (
        <p className="po-secondary mb-4">Showing matches for “{list.query}”.</p>
      ) : null}

      <QueryStatus
        loading={list.loading}
        error={list.error}
        empty={!list.loading && !list.error && list.items.length === 0}
        loadingLabel="Loading companies…"
        emptyTitle="No companies match this search."
        onRetry={list.retry}
      >
        <Table
          minWidthClass="min-w-[960px]"
          headers={[
            'Company',
            'Registration no.',
            'Staff',
            'Jobs',
            'Published',
            'Draft',
            'Actions',
          ]}
          emptyTitle="No companies to display."
          rows={list.items.map((company) => [
            company.companyName,
            company.registrationNumber || '—',
            String(company.staffCount ?? 0),
            String(company.jobCount ?? 0),
            String(company.publishedJobCount ?? 0),
            String(company.draftJobCount ?? 0),
            <Button key={`${company.id}-view`} size="sm" variant="secondary" to={`/admin/companies/${company.id}`}>
              View
            </Button>,
          ])}
        />
        <PaginationBar
          page={list.meta.page}
          totalPages={list.meta.totalPages}
          total={list.meta.total}
          noun="companies"
          disabled={list.loading}
          onPrevious={() => list.goToPage(list.page - 1)}
          onNext={() => list.goToPage(list.page + 1)}
        />
      </QueryStatus>
    </PageContent>
  )
}

export default Companies
