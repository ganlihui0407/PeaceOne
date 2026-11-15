import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import { useMeProfileForm } from '../../hooks/useMeProfileForm.js'
import {
  formatProfileAccountStatus,
  formatProfileRole,
  profileAccountStatusBadge,
} from '../../api/meForm.js'

function AdminProfile() {
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

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function handleSave(event) {
    event.preventDefault()
    const saved = await save()
    if (saved) {
      showToast('Administrator profile changes saved.')
    }
  }

  return (
    <PageContent
      title="My Profile"
      description="Keep your administrator details current."
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
                id="admin-name"
                label="Full Name"
                required
                value={form.fullName}
                error={fieldErrors.fullName}
                disabled={saving}
                onChange={(event) => updateField('fullName', event.target.value)}
              />
              <TextInput
                id="admin-email"
                label="Email Address"
                type="email"
                value={profile?.email ?? ''}
                disabled
                helperText="Email cannot be changed from your profile."
              />
              <TextInput
                id="admin-phone"
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
              <div>
                <p className="po-label">Role</p>
                <div className="flex h-11 items-center">
                  <Badge tone="primary" className="normal-case">
                    {formatProfileRole(profile?.role)}
                  </Badge>
                </div>
              </div>
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
      </QueryStatus>
      <Toast message={toast} />
    </PageContent>
  )
}

export default AdminProfile
