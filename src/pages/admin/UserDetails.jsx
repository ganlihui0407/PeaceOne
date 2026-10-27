import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import { getAdminUser } from '../../data/users.js'

function UserDetails() {
  const { userId } = useParams()
  return <UserDetailsView key={userId} userId={userId} />
}

function UserDetailsView({ userId }) {
  const user = getAdminUser(userId)
  const [requestStatus, setRequestStatus] = useState(user?.positionChangeRequest?.status || '')
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  if (!user) {
    return (
      <PageContent title="User not found">
        <Card>
          <p className="po-body">This user could not be found.</p>
          <div className="mt-5">
            <Button to="/admin/users" variant="secondary">
              Back to User Management
            </Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={user.fullName}
      description="Review this PeaceOne account and related activity."
      actions={
        <Button variant="secondary" to="/admin/users">
          Back to Users
        </Button>
      }
    >
      <div className="space-y-6">
        <Card>
          <h2 className="po-section-title">Basic User Information</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Full Name" value={user.fullName} />
            <DetailItem label="Email" value={user.email} />
            <DetailItem label="Phone" value={user.phone} />
            <DetailItem label="Role" value={user.role} />
            <div>
              <dt className="po-helper mt-0">Account Status</dt>
              <dd className="mt-1">
                <Badge status={user.accountStatus.toLowerCase()} className="normal-case">
                  {user.accountStatus}
                </Badge>
              </dd>
            </div>
          </dl>
        </Card>

        {user.kind === 'candidate' ? (
          <>
            <Card>
              <h2 className="po-section-title">Candidate Information</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Current Position" value={user.currentPosition} />
                <DetailItem label="Education Level" value={user.educationLevel} />
                <DetailItem label="Field of Study" value={user.fieldOfStudy} />
                <DetailItem label="Institution" value={user.institution} />
                <DetailItem label="Graduation Year" value={user.graduationYear} />
                <DetailItem label="Location" value={user.location} />
                <div className="sm:col-span-2">
                  <dt className="po-helper mt-0">Experience Summary</dt>
                  <dd className="po-body mt-1">{user.experienceSummary}</dd>
                </div>
              </dl>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card padding="sm">
                <p className="po-secondary">Skills Summary</p>
                <p className="po-card-title mt-2">{user.skillsSummary}</p>
              </Card>
              <Card padding="sm">
                <p className="po-secondary">Applications Summary</p>
                <p className="po-card-title mt-2">{user.applicationsSummary}</p>
              </Card>
              <Card padding="sm">
                <p className="po-secondary">Learning Progress Summary</p>
                <p className="po-card-title mt-2">{user.learningSummary}</p>
              </Card>
            </div>
          </>
        ) : null}

        {user.kind === 'staff' ? (
          <Card>
            <h2 className="po-section-title">Company Staff Information</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailItem label="Company" value={user.company} />
              <DetailItem label="Position" value={user.position} />
              <DetailItem label="Department" value={user.department} />
              <div>
                <dt className="po-helper mt-0">Staff Status</dt>
                <dd className="mt-1">
                  <Badge status={user.staffStatus.toLowerCase()} className="normal-case">
                    {user.staffStatus}
                  </Badge>
                </dd>
              </div>
            </dl>
          </Card>
        ) : null}

        {user.positionChangeRequest ? (
          <Card>
            <h2 className="po-section-title">Position Change Request</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailItem label="User" value={user.fullName} />
              <DetailItem label="Current Position" value={user.positionChangeRequest.currentPosition} />
              <DetailItem label="Requested Position" value={user.positionChangeRequest.requestedPosition} />
              <div>
                <dt className="po-helper mt-0">Status</dt>
                <dd className="mt-1">
                  <Badge status={requestStatus.toLowerCase()} className="normal-case">
                    {requestStatus}
                  </Badge>
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setRequestStatus('Approved')
                  showToast('Position change approved.')
                }}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setRequestStatus('Rejected')
                  showToast('Position change rejected.')
                }}
              >
                Reject
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
      <Toast message={toast} />
    </PageContent>
  )
}

export default UserDetails
