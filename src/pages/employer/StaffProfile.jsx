import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import { useMeProfileForm } from '../../hooks/useMeProfileForm.js'
import { useStaffPositionChangeRequests } from '../../hooks/useStaffPositionChangeRequests.js'
import {
  formatProfileAccountStatus,
  profileAccountStatusBadge,
} from '../../api/meForm.js'
import {
  REASON_MAX,
  REQUESTED_POSITION_MAX,
  formatPositionChangeStatus,
  formatRequestDate,
  hasPendingPositionChangeRequest,
  positionChangeStatusTone,
} from '../../api/positionChangeRequests.js'

function StaffProfile() {
  const {
    profile,
    form,
    fieldErrors,
    loading,
    saving,
    loadError,
    saveError,
    retry,
    updateField,
    save,
  } = useMeProfileForm()
  const requests = useStaffPositionChangeRequests()
  const [toast, setToast] = useState('')
  const [requestedPosition, setRequestedPosition] = useState('')
  const [reason, setReason] = useState('')
  const [requestFieldErrors, setRequestFieldErrors] = useState({})

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function handleSave(event) {
    event.preventDefault()
    const saved = await save()
    if (saved) {
      showToast('Staff profile changes saved.')
    }
  }

  function validateRequest() {
    const errors = {}
    const nextPosition = requestedPosition.trim()
    const nextReason = reason.trim()
    if (!nextPosition) {
      errors.requestedPosition = 'Enter the requested position.'
    } else if (nextPosition.length > REQUESTED_POSITION_MAX) {
      errors.requestedPosition = `Requested position can be at most ${REQUESTED_POSITION_MAX} characters.`
    } else if (profile?.jobTitle && nextPosition === profile.jobTitle) {
      errors.requestedPosition = 'Requested position must be different from your current position.'
    }
    if (!nextReason) {
      errors.reason = 'Enter a reason for this request.'
    } else if (nextReason.length > REASON_MAX) {
      errors.reason = `Reason can be at most ${REASON_MAX} characters.`
    }
    return errors
  }

  async function handlePositionRequest(event) {
    event.preventDefault()
    const errors = validateRequest()
    setRequestFieldErrors(errors)
    requests.setSubmitError('')
    if (Object.keys(errors).length > 0) {
      return
    }
    const created = await requests.submit({
      requestedPosition: requestedPosition.trim(),
      reason: reason.trim(),
    })
    if (created) {
      setRequestedPosition('')
      setReason('')
      setRequestFieldErrors({})
      showToast('Position change request submitted.')
    }
  }

  const pending = hasPendingPositionChangeRequest(requests.items)
  const currentPosition = profile?.jobTitle?.trim() ? profile.jobTitle : 'Not set'

  return (
    <PageContent
      title="My Profile"
      description="Keep your company staff details current."
    >
      <QueryStatus
        loading={loading}
        error={loadError}
        loadingLabel="Loading your profile…"
        onRetry={retry}
      >
        <form className="space-y-6" onSubmit={handleSave}>
          <Card>
            <h2 className="po-section-title">Basic Information</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <TextInput
                id="staff-name"
                label="Full Name"
                required
                value={form.fullName}
                error={fieldErrors.fullName}
                disabled={saving}
                onChange={(event) => updateField('fullName', event.target.value)}
              />
              <TextInput
                id="staff-email"
                label="Email Address"
                type="email"
                value={profile?.email ?? ''}
                disabled
                helperText="Email cannot be changed from your profile."
              />
              <TextInput
                id="staff-phone"
                label="Phone Number"
                type="tel"
                value={form.phone}
                error={fieldErrors.phone}
                disabled={saving}
                onChange={(event) => updateField('phone', event.target.value)}
              />
              <div>
                <p className="po-label">Account Status</p>
                <div className="flex h-11 items-center">
                  <Badge status={profileAccountStatusBadge(profile?.accountStatus)} className="normal-case">
                    {formatProfileAccountStatus(profile?.accountStatus)}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="po-section-title">Employment Information</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <TextInput
                id="staff-position"
                label="Position"
                value={currentPosition === 'Not set' ? '' : currentPosition}
                disabled
                helperText="Position changes are submitted as a request for administrator review."
              />
              <TextInput
                id="staff-department"
                label="Department"
                value={form.department}
                error={fieldErrors.department}
                disabled={saving}
                onChange={(event) => updateField('department', event.target.value)}
              />
              <TextInput
                id="staff-location"
                label="Location"
                value={form.location}
                error={fieldErrors.location}
                disabled={saving}
                onChange={(event) => updateField('location', event.target.value)}
              />
            </div>
          </Card>

          {saveError ? (
            <p className="po-helper po-helper-error mt-0" role="alert">
              {saveError}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="po-section-title">Request Position Change</h2>
            <p className="po-secondary mt-2">
              Submit a requested position and reason. An administrator must approve the change before your
              stored position is updated.
            </p>
            {pending ? (
              <p className="po-helper mt-4">
                You already have a pending request. Wait for it to be reviewed before submitting another.
              </p>
            ) : null}
            <form className="mt-5 space-y-4" onSubmit={handlePositionRequest}>
              <div>
                <p className="po-label">Current Position</p>
                <p className="text-sm font-medium text-ink">{currentPosition}</p>
              </div>
              <TextInput
                id="requested-position"
                label="Requested Position"
                required
                value={requestedPosition}
                error={requestFieldErrors.requestedPosition}
                disabled={requests.submitting || pending}
                maxLength={REQUESTED_POSITION_MAX}
                onChange={(event) => {
                  setRequestedPosition(event.target.value)
                  if (requestFieldErrors.requestedPosition) {
                    setRequestFieldErrors((current) => ({ ...current, requestedPosition: undefined }))
                  }
                }}
              />
              <TextArea
                id="position-change-reason"
                label="Reason"
                required
                value={reason}
                error={requestFieldErrors.reason}
                disabled={requests.submitting || pending}
                maxLength={REASON_MAX}
                onChange={(event) => {
                  setReason(event.target.value)
                  if (requestFieldErrors.reason) {
                    setRequestFieldErrors((current) => ({ ...current, reason: undefined }))
                  }
                }}
              />
              {requests.submitError ? (
                <p className="po-helper po-helper-error mt-0" role="alert">
                  {requests.submitError}
                </p>
              ) : null}
              <Button type="submit" disabled={requests.submitting || pending}>
                {requests.submitting ? 'Submitting…' : 'Submit Position Change Request'}
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="po-section-title">Request history</h2>
            <QueryStatus
              loading={requests.loading}
              error={requests.error}
              empty={requests.items.length === 0}
              loadingLabel="Loading your requests…"
              emptyTitle="No position change requests yet."
              emptyDescription="Submitted requests and administrator review notes will appear here."
              onRetry={requests.retry}
            >
              <Table
                minWidthClass="min-w-[520px]"
                headers={['Requested', 'Status', 'Submitted', 'Review note']}
                rows={requests.items.map((item) => [
                  item.requestedPosition,
                  <Badge
                    key={`${item.id}-status`}
                    tone={positionChangeStatusTone(item.status)}
                    className="normal-case"
                  >
                    {formatPositionChangeStatus(item.status)}
                  </Badge>,
                  formatRequestDate(item.createdAt),
                  item.reviewNote || '—',
                ])}
              />
            </QueryStatus>
          </Card>
        </div>
      </QueryStatus>
      <Toast message={toast} />
    </PageContent>
  )
}

export default StaffProfile
