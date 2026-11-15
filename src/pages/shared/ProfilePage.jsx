import { useState } from 'react'
import Button from '../../components/common/Button.jsx'
import Badge from '../../components/common/Badge.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import { useMeProfileForm } from '../../hooks/useMeProfileForm.js'
import {
  PROFILE_POSITION_UNAVAILABLE,
  educationLevelOptions,
  formatProfileAccountStatus,
  formatProfileRole,
  profileAccountStatusBadge,
} from '../../api/meForm.js'

function ProfilePage() {
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
  const [toast, setToast] = useState('')
  const [requestedPositionOverride, setRequestedPositionOverride] = useState(null)
  const [positionRequestError, setPositionRequestError] = useState('')

  const currentPosition = profile ? formatProfileRole(profile.role) : ''
  const requestedPosition =
    requestedPositionOverride ?? (profile?.role === 'JOB_SEEKER' ? 'Student' : 'Job Seeker')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function handleSave(event) {
    event.preventDefault()
    const saved = await save()
    if (saved) {
      showToast('Profile changes saved.')
    }
  }

  function handlePositionRequest(event) {
    event.preventDefault()
    setPositionRequestError(PROFILE_POSITION_UNAVAILABLE)
  }

  return (
    <PageContent
      title="My Profile"
      description="Keep your PeaceOne details current."
    >
      <QueryStatus
        loading={loading}
        error={loadError}
        loadingLabel="Loading your profile…"
        onRetry={retry}
      >
        <form className="space-y-6" onSubmit={handleSave}>
          <Card>
            <h2 className="po-section-title">Basic information</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <TextInput
                id="profile-name"
                label="Full Name"
                required
                value={form.fullName}
                error={fieldErrors.fullName}
                disabled={saving}
                onChange={(event) => updateField('fullName', event.target.value)}
              />
              <TextInput
                id="profile-email"
                label="Email Address"
                type="email"
                value={profile?.email ?? ''}
                disabled
                helperText="Email cannot be changed from your profile."
              />
              <TextInput
                id="profile-phone"
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
                  <Badge status={profileAccountStatusBadge(profile?.accountStatus)}>
                    {formatProfileAccountStatus(profile?.accountStatus)}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="po-section-title">Education information</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <SelectInput
                id="education-level"
                label="Education Level"
                value={form.educationLevel}
                error={fieldErrors.educationLevel}
                disabled={saving}
                onChange={(event) => updateField('educationLevel', event.target.value)}
                options={educationLevelOptions}
              />
              <TextInput
                id="field-of-study"
                label="Field of Study"
                value={form.fieldOfStudy}
                error={fieldErrors.fieldOfStudy}
                disabled={saving}
                onChange={(event) => updateField('fieldOfStudy', event.target.value)}
              />
              <TextInput
                id="institution"
                label="Institution"
                value={form.institution}
                error={fieldErrors.institution}
                disabled={saving}
                onChange={(event) => updateField('institution', event.target.value)}
              />
              <TextInput
                id="graduation-year"
                label="Graduation Year"
                inputMode="numeric"
                autoComplete="off"
                value={form.graduationYear}
                error={fieldErrors.graduationYear}
                disabled={saving}
                onChange={(event) => updateField('graduationYear', event.target.value)}
                helperText="Enter a 4-digit year from 1950 to 2100."
              />
            </div>
          </Card>

          <Card>
            <h2 className="po-section-title">Career / experience information</h2>
            <div className="mt-5 grid gap-5">
              <TextInput
                id="profile-location"
                label="Location"
                value={form.location}
                error={fieldErrors.location}
                disabled={saving}
                onChange={(event) => updateField('location', event.target.value)}
              />
              <TextArea
                id="experience-summary"
                label="Experience Summary"
                value={form.experienceSummary}
                error={fieldErrors.experienceSummary}
                disabled={saving}
                onChange={(event) => updateField('experienceSummary', event.target.value)}
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
            <h2 className="po-section-title">Current Position</h2>
            <p className="po-secondary mt-2">This is the logged-in position for this PeaceOne account.</p>
            <p className="mt-4 text-lg font-semibold text-ink">{currentPosition}</p>
          </Card>

          <Card>
            <h2 className="po-section-title">Request Position Change</h2>
            <p className="po-secondary mt-2">
              Students and job seekers can request to change their current position when their career
              status changes. An administrator will review the request.
            </p>
            <form className="mt-5 space-y-4" onSubmit={handlePositionRequest}>
              <div>
                <p className="po-label">Current Position</p>
                <p className="text-sm font-medium text-ink">{currentPosition}</p>
              </div>
              <SelectInput
                id="requested-position"
                label="Requested Position"
                value={requestedPosition}
                onChange={(event) => {
                  setRequestedPositionOverride(event.target.value)
                  setPositionRequestError('')
                }}
                options={[
                  { value: 'Student', label: 'Student' },
                  { value: 'Job Seeker', label: 'Job Seeker' },
                ]}
              />
              {positionRequestError ? (
                <p className="po-helper po-helper-error mt-0" role="alert">
                  {positionRequestError}
                </p>
              ) : null}
              <Button type="submit">Submit Position Change Request</Button>
            </form>
          </Card>
        </div>
      </QueryStatus>

      <Toast message={toast} />
    </PageContent>
  )
}

export default ProfilePage
