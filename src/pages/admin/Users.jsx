import { useEffect, useMemo, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  ADMIN_USER_LIST_LIMIT,
  ADMIN_USER_ROLE_OPTIONS,
  ADMIN_USER_STATUS_OPTIONS,
  fetchAdminUserStats,
  fetchAdminUsers,
  formatAdminDate,
  formatProfileAccountStatus,
  formatProfileRole,
  updateAdminUserStatus,
  userFacingAdminUserError,
} from '../../api/adminUsers.js'
import { profileAccountStatusBadge } from '../../api/meForm.js'
import { useAuth } from '../../auth/useAuth.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

function Users() {
  const { user: sessionUser } = useAuth()
  const [roleInput, setRoleInput] = useState('')
  const [statusInput, setStatusInput] = useState('')
  const [appliedRole, setAppliedRole] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const [stats, setStats] = useState(null)
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [toast, setToast] = useState('')
  const extraParams = useMemo(
    () => ({
      ...(appliedRole ? { role: appliedRole } : {}),
      ...(appliedStatus ? { accountStatus: appliedStatus } : {}),
    }),
    [appliedRole, appliedStatus],
  )
  const list = useEscoPagedSearch(fetchAdminUsers, {
    limit: ADMIN_USER_LIST_LIMIT,
    extraParams,
    formatError: userFacingAdminUserError,
  })

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  useEffect(() => {
    fetchAdminUserStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [list.meta.total])

  function applyFilters(event) {
    event.preventDefault()
    setAppliedRole(roleInput)
    setAppliedStatus(statusInput)
    list.search(event)
  }

  async function confirmSuspend() {
    if (!suspendTarget) {
      return
    }
    try {
      await updateAdminUserStatus(suspendTarget.id, 'SUSPENDED')
      setSuspendTarget(null)
      showToast('Account suspended.')
      list.retry()
    } catch (error) {
      setSuspendTarget(null)
      showToast(userFacingAdminUserError(error) || 'Unable to suspend this account.')
    }
  }

  async function reactivate(user) {
    try {
      await updateAdminUserStatus(user.id, 'ACTIVE')
      showToast('Account reactivated.')
      list.retry()
    } catch (error) {
      showToast(userFacingAdminUserError(error) || 'Unable to reactivate this account.')
    }
  }

  return (
    <PageContent
      title="User Management"
      description="Search and manage registered PeaceOne accounts stored in PostgreSQL. Accounts are not deleted so applications, interviews and learning history remain."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total users" value={String(stats?.total ?? '—')} />
        <StatCard label="Students" value={String(stats?.byRole?.STUDENT ?? '—')} />
        <StatCard label="Job seekers" value={String(stats?.byRole?.JOB_SEEKER ?? '—')} />
        <StatCard label="Company staff" value={String(stats?.byRole?.COMPANY_STAFF ?? '—')} />
        <StatCard label="Suspended" value={String(stats?.byStatus?.SUSPENDED ?? '—')} />
      </div>

      <form className="mt-8 mb-6 grid gap-4 md:grid-cols-4" onSubmit={applyFilters}>
        <SearchInput
          id="admin-user-search"
          label="Search User"
          value={list.input}
          placeholder="Search by name or email"
          onChange={(event) => list.setInput(event.target.value)}
        />
        <SelectInput
          id="admin-user-role"
          label="Role"
          value={roleInput}
          onChange={(event) => setRoleInput(event.target.value)}
          options={ADMIN_USER_ROLE_OPTIONS}
        />
        <SelectInput
          id="admin-user-status"
          label="Account Status"
          value={statusInput}
          onChange={(event) => setStatusInput(event.target.value)}
          options={ADMIN_USER_STATUS_OPTIONS}
        />
        <div className="flex items-end">
          <Button type="submit" disabled={list.loading}>Search</Button>
        </div>
      </form>

      <QueryStatus
        loading={list.loading}
        error={list.error}
        empty={!list.loading && !list.error && list.items.length === 0}
        loadingLabel="Loading users…"
        emptyTitle="No users match these filters."
        emptyDescription="Try a different name, email, role or status."
        onRetry={list.retry}
      >
        <Table
          minWidthClass="min-w-[980px]"
          headers={['User', 'Email', 'Role', 'Company', 'Account Status', 'Registered Date', 'Actions']}
          emptyTitle="No users match these filters."
          rows={list.items.map((user) => [
            user.fullName,
            user.email,
            formatProfileRole(user.role),
            user.company?.companyName || '—',
            <Badge key={`${user.id}-status`} status={profileAccountStatusBadge(user.accountStatus)} className="normal-case">
              {formatProfileAccountStatus(user.accountStatus)}
            </Badge>,
            formatAdminDate(user.createdAt),
            <div key={`${user.id}-actions`} className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" to={`/admin/users/${user.id}`}>
                View
              </Button>
              {user.accountStatus !== 'SUSPENDED' && user.id !== sessionUser?.id ? (
                <Button size="sm" variant="ghost" onClick={() => setSuspendTarget(user)}>
                  Suspend
                </Button>
              ) : null}
              {user.accountStatus === 'SUSPENDED' ? (
                <Button size="sm" variant="secondary" onClick={() => reactivate(user)}>
                  Reactivate
                </Button>
              ) : null}
            </div>,
          ])}
        />
        <PaginationBar
          page={list.meta.page}
          totalPages={list.meta.totalPages}
          total={list.meta.total}
          noun="users"
          disabled={list.loading}
          onPrevious={() => list.goToPage(list.page - 1)}
          onNext={() => list.goToPage(list.page + 1)}
        />
      </QueryStatus>

      <Modal
        open={Boolean(suspendTarget)}
        title="Suspend account"
        onClose={() => setSuspendTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuspendTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmSuspend}>
              Suspend
            </Button>
          </>
        }
      >
        <p className="po-body">
          Suspend this account? The person will not be able to use authenticated PeaceOne features until reactivated.
          Applications, interviews and learning history are kept.
        </p>
        {suspendTarget ? (
          <p className="po-secondary mt-2">{suspendTarget.fullName} · {suspendTarget.email}</p>
        ) : null}
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default Users
