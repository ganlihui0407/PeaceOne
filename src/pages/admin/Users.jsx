import { useMemo, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  accountStatuses,
  adminUsers,
  adminUserSummary,
  userRoles,
} from '../../data/users.js'

function Users() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('All')
  const [status, setStatus] = useState('All')
  const [statusById, setStatusById] = useState({})
  const [hiddenIds, setHiddenIds] = useState([])
  const [removeTarget, setRemoveTarget] = useState(null)
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  const rows = useMemo(() => {
    return adminUsers
      .filter((user) => !hiddenIds.includes(user.id))
      .map((user) => ({
        ...user,
        accountStatus: statusById[user.id] || user.accountStatus,
      }))
      .filter((user) => {
        const matchesRole = role === 'All' || user.role === role
        const matchesStatus = status === 'All' || user.accountStatus === status
        const haystack = `${user.fullName} ${user.email}`.toLowerCase()
        return matchesRole && matchesStatus && haystack.includes(query.trim().toLowerCase())
      })
  }, [query, role, status, statusById, hiddenIds])

  function suspendUser(user) {
    setStatusById((current) => ({ ...current, [user.id]: 'Suspended' }))
    showToast('User suspended.')
  }

  function confirmRemove() {
    if (!removeTarget) return
    setHiddenIds((current) => (current.includes(removeTarget.id) ? current : [...current, removeTarget.id]))
    setRemoveTarget(null)
    showToast('User removed from the current list.')
  }

  return (
    <PageContent
      title="User Management"
      description="View and manage registered PeaceOne users."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {adminUserSummary.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="mt-8 mb-6 grid gap-4 md:grid-cols-3">
        <SearchInput
          id="admin-user-search"
          label="Search User"
          value={query}
          placeholder="Search by name or email"
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectInput
          id="admin-user-role"
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          options={userRoles}
        />
        <SelectInput
          id="admin-user-status"
          label="Account Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={accountStatuses}
        />
      </div>

      <Table
        minWidthClass="min-w-[980px]"
        headers={['User', 'Email', 'Role', 'Current Position', 'Account Status', 'Registered Date', 'Actions']}
        rows={rows.map((user) => [
          user.fullName,
          user.email,
          user.role,
          user.currentPosition,
          <Badge key={`${user.id}-status`} status={user.accountStatus.toLowerCase()} className="normal-case">
            {user.accountStatus}
          </Badge>,
          user.registeredDate,
          <div key={`${user.id}-actions`} className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" to={`/admin/users/${user.id}`}>
              View
            </Button>
            {user.accountStatus !== 'Suspended' ? (
              <Button size="sm" variant="ghost" onClick={() => suspendUser(user)}>
                Suspend
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(user)}>
              Remove
            </Button>
          </div>,
        ])}
      />

      <Modal
        open={Boolean(removeTarget)}
        title="Remove user"
        onClose={() => setRemoveTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoveTarget(null)}>
              Close
            </Button>
            <Button variant="danger" onClick={confirmRemove}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="po-body">Are you sure you want to remove this user?</p>
        {removeTarget ? (
          <p className="po-secondary mt-2">{removeTarget.fullName} will be removed from the current view.</p>
        ) : null}
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default Users
