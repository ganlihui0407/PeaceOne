import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import { fetchAdminCompany, userFacingCompanyError } from '../../api/company.js'
import { formatAdminDate, formatProfileAccountStatus, formatProfileRole } from '../../api/adminUsers.js'
import { profileAccountStatusBadge } from '../../api/meForm.js'

function CompanyDetails() {
  const { companyId } = useParams()
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    fetchAdminCompany(companyId)
      .then(setPayload)
      .catch((loadError) => {
        setPayload(null)
        setError(userFacingCompanyError(loadError))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const company = payload?.company

  return (
    <PageContent
      title={company?.companyName || 'Company details'}
      description="Company record stored in PostgreSQL, including associated staff and job counts."
      actions={
        <Button variant="secondary" to="/admin/companies">
          Back to companies
        </Button>
      }
    >
      <QueryStatus
        loading={loading}
        error={error}
        empty={!loading && !error && !company}
        loadingLabel="Loading company…"
        emptyTitle="Company not found"
        onRetry={load}
      >
        {company ? (
          <div className="space-y-6">
            <Card>
              <h2 className="po-section-title">Company information</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Company name" value={company.companyName} />
                <DetailItem label="Registration number" value={company.registrationNumber || '—'} />
                <DetailItem label="Industry" value={company.industry || '—'} />
                <DetailItem label="Location" value={company.location || '—'} />
                <DetailItem label="Website" value={company.website || '—'} />
                <DetailItem label="Email" value={company.email || '—'} />
                <DetailItem label="Registered" value={formatAdminDate(company.createdAt)} />
                <div className="sm:col-span-2">
                  <dt className="po-helper mt-0">Description</dt>
                  <dd className="po-body mt-1">{company.description || '—'}</dd>
                </div>
              </dl>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card padding="sm">
                <p className="po-secondary">Staff</p>
                <p className="po-card-title mt-2">{company.staffCount}</p>
              </Card>
              <Card padding="sm">
                <p className="po-secondary">Jobs</p>
                <p className="po-card-title mt-2">{company.jobCount}</p>
              </Card>
              <Card padding="sm">
                <p className="po-secondary">Published jobs</p>
                <p className="po-card-title mt-2">{company.publishedJobCount}</p>
              </Card>
              <Card padding="sm">
                <p className="po-secondary">Draft jobs</p>
                <p className="po-card-title mt-2">{company.draftJobCount}</p>
              </Card>
            </div>
            <Card>
              <h2 className="po-section-title">Associated staff</h2>
              <Table
                className="mt-4"
                headers={['Name', 'Email', 'Role', 'Status', 'Position']}
                emptyTitle="No staff are associated with this company."
                rows={(payload.staff || []).map((member) => [
                  member.fullName,
                  member.email,
                  formatProfileRole(member.role),
                  <Badge key={`${member.id}-status`} status={profileAccountStatusBadge(member.accountStatus)} className="normal-case">
                    {formatProfileAccountStatus(member.accountStatus)}
                  </Badge>,
                  member.jobTitle || '—',
                ])}
              />
            </Card>
          </div>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default CompanyDetails
