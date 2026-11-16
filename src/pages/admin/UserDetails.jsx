import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import {
  fetchAdminUser,
  formatAdminDate,
  formatProfileAccountStatus,
  formatProfileRole,
  updateAdminUserStatus,
  userFacingAdminUserError,
} from '../../api/adminUsers.js'
import { profileAccountStatusBadge } from '../../api/meForm.js'
import { useAuth } from '../../auth/useAuth.js'

function UserDetails() {
  const { userId } = useParams()
  return <UserDetailsView key={userId} userId={userId} />
}

function UserDetailsView({ userId }) {
  const { user: sessionUser } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [confirmSuspend, setConfirmSuspend] = useState(false)

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  function load() {
    setLoading(true)
    setError('')
    fetchAdminUser(userId)
      .then(setUser)
      .catch((loadError) => {
        setUser(null)
        setError(userFacingAdminUserError(loadError))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function changeStatus(accountStatus) {
    try {
      const next = await updateAdminUserStatus(userId, accountStatus)
      setUser((current) => ({ ...current, ...next }))
      setConfirmSuspend(false)
      showToast(accountStatus === 'SUSPENDED' ? 'Account suspended.' : 'Account reactivated.')
    } catch (actionError) {
      setConfirmSuspend(false)
      showToast(userFacingAdminUserError(actionError) || 'Unable to update this account.')
    }
  }

  const isSelf = sessionUser?.id === userId

  return (
    <PageContent
      title={user?.fullName || 'User details'}
      description="Review this PeaceOne account and related activity stored in PostgreSQL."
      actions={
        <Button variant="secondary" to="/admin/users">
          Back to Users
        </Button>
      }
    >
      <QueryStatus
        loading={loading}
        error={error}
        empty={!loading && !error && !user}
        loadingLabel="Loading user…"
        emptyTitle="User not found"
        onRetry={load}
      >
        {user ? (
          <div className="space-y-6">
            <Card>
              <h2 className="po-section-title">Basic User Information</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Full Name" value={user.fullName} />
                <DetailItem label="Email" value={user.email} />
                <DetailItem label="Phone" value={user.phone || '—'} />
                <DetailItem label="Role" value={formatProfileRole(user.role)} />
                <div>
                  <dt className="po-helper mt-0">Account Status</dt>
                  <dd className="mt-1">
                    <Badge status={profileAccountStatusBadge(user.accountStatus)} className="normal-case">
                      {formatProfileAccountStatus(user.accountStatus)}
                    </Badge>
                  </dd>
                </div>
                <DetailItem label="Registered" value={formatAdminDate(user.createdAt)} />
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                {user.accountStatus !== 'SUSPENDED' && !isSelf ? (
                  <Button variant="danger" onClick={() => setConfirmSuspend(true)}>
                    Suspend account
                  </Button>
                ) : null}
                {user.accountStatus === 'SUSPENDED' ? (
                  <Button onClick={() => changeStatus('ACTIVE')}>Reactivate account</Button>
                ) : null}
                {isSelf ? (
                  <p className="po-secondary">You cannot suspend your own administrator account.</p>
                ) : null}
              </div>
            </Card>

            {user.role === 'STUDENT' || user.role === 'JOB_SEEKER' ? (
              <>
                <Card>
                  <h2 className="po-section-title">Candidate Information</h2>
                  <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                    <DetailItem label="Current Position" value={user.jobTitle || '—'} />
                    <DetailItem label="Education Level" value={user.educationLevel || '—'} />
                    <DetailItem label="Field of Study" value={user.fieldOfStudy || '—'} />
                    <DetailItem label="Institution" value={user.institution || '—'} />
                    <DetailItem label="Graduation Year" value={user.graduationYear || '—'} />
                    <DetailItem label="Location" value={user.location || '—'} />
                    <div className="sm:col-span-2">
                      <dt className="po-helper mt-0">Experience Summary</dt>
                      <dd className="po-body mt-1">{user.experienceSummary || '—'}</dd>
                    </div>
                  </dl>
                </Card>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card padding="sm">
                    <p className="po-secondary">Skills recorded</p>
                    <p className="po-card-title mt-2">{user.skillCount ?? 0}</p>
                  </Card>
                  <Card padding="sm">
                    <p className="po-secondary">Applications</p>
                    <p className="po-card-title mt-2">{user.applicationCount ?? 0}</p>
                  </Card>
                  <Card padding="sm">
                    <p className="po-secondary">Learning enrolments</p>
                    <p className="po-card-title mt-2">
                      {user.enrollmentCount ?? 0}
                      {typeof user.completedCourseCount === 'number'
                        ? ` · ${user.completedCourseCount} completed`
                        : ''}
                    </p>
                  </Card>
                </div>
              </>
            ) : null}

            {user.role === 'COMPANY_STAFF' ? (
              <Card>
                <h2 className="po-section-title">Company Staff Information</h2>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Company" value={user.company?.companyName || '—'} />
                  <DetailItem label="Position" value={user.jobTitle || '—'} />
                  <DetailItem label="Department" value={user.department || '—'} />
                  <DetailItem label="Jobs created" value={String(user.createdJobCount ?? 0)} />
                </dl>
                {user.company ? (
                  <div className="mt-5">
                    <Button variant="secondary" to={`/admin/companies/${user.company.id}`}>
                      View company
                    </Button>
                  </div>
                ) : null}
              </Card>
            ) : null}

            {user.pendingPositionChangeRequest ? (
              <Card>
                <h2 className="po-section-title">Position Change Request</h2>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Current Position" value={user.pendingPositionChangeRequest.currentPosition || '—'} />
                  <DetailItem label="Requested Position" value={user.pendingPositionChangeRequest.requestedPosition || '—'} />
                  <DetailItem label="Status" value={user.pendingPositionChangeRequest.status} />
                </dl>
                <div className="mt-5">
                  <Button to={`/admin/position-requests/${user.pendingPositionChangeRequest.id}`}>
                    Open request
                  </Button>
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </QueryStatus>

      <Modal
        open={confirmSuspend}
        title="Suspend account"
        onClose={() => setConfirmSuspend(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmSuspend(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => changeStatus('SUSPENDED')}>Suspend</Button>
          </>
        }
      >
        <p className="po-body">
          The account will lose authenticated access. Related applications, interviews and learning records stay in the database.
        </p>
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default UserDetails
