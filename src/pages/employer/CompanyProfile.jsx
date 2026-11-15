import { useState } from 'react'
import { Building2 } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import { COMPANY_EMPTY, COMPANY_FIELD_LIMITS, COMPANY_LOGO_UNAVAILABLE } from '../../api/company.js'
import { useCompanyProfileForm } from '../../hooks/useCompanyProfileForm.js'

function CompanyProfile() {
  const {
    company,
    form,
    fieldErrors,
    loading,
    saving,
    loadError,
    saveError,
    retry,
    updateField,
    save,
  } = useCompanyProfileForm()
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function handleSave(event) {
    event.preventDefault()
    const saved = await save()
    if (saved) {
      showToast('Company profile changes saved.')
    }
  }

  return (
    <PageContent
      title="Company Profile"
      description="Manage the company information for this signed-in staff account."
    >
      <QueryStatus
        loading={loading}
        error={loadError}
        loadingLabel="Loading company profile…"
        onRetry={retry}
      >
        <form className="space-y-6" onSubmit={handleSave}>
          {!company ? (
            <p className="po-helper mt-0">
              {COMPANY_EMPTY.title} {COMPANY_EMPTY.description}
            </p>
          ) : null}
          <Card>
            <h2 className="po-section-title">Company Information</h2>
            <div className="mt-5 flex flex-col gap-6 lg:flex-row">
              <div className="flex w-full max-w-[220px] flex-col items-start gap-3">
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-line bg-page text-primary">
                  <Building2 size={28} aria-hidden="true" />
                </div>
                <p className="po-helper mt-0">{COMPANY_LOGO_UNAVAILABLE}</p>
              </div>
              <div className="grid min-w-0 flex-1 gap-5 md:grid-cols-2">
                <TextInput
                  id="company-name"
                  label="Company Name"
                  required
                  value={form.companyName}
                  error={fieldErrors.companyName}
                  disabled={saving}
                  maxLength={COMPANY_FIELD_LIMITS.companyName}
                  onChange={(event) => updateField('companyName', event.target.value)}
                />
                <TextInput
                  id="company-registration"
                  label="Registration number"
                  value={form.registrationNumber}
                  error={fieldErrors.registrationNumber}
                  disabled={saving}
                  maxLength={COMPANY_FIELD_LIMITS.registrationNumber}
                  onChange={(event) => updateField('registrationNumber', event.target.value)}
                />
                <TextInput
                  id="company-industry"
                  label="Industry"
                  value={form.industry}
                  error={fieldErrors.industry}
                  disabled={saving}
                  maxLength={COMPANY_FIELD_LIMITS.industry}
                  onChange={(event) => updateField('industry', event.target.value)}
                />
                <TextInput
                  id="company-size"
                  label="Company size"
                  value={form.companySize}
                  error={fieldErrors.companySize}
                  disabled={saving}
                  maxLength={COMPANY_FIELD_LIMITS.companySize}
                  onChange={(event) => updateField('companySize', event.target.value)}
                />
                <TextInput
                  id="company-location"
                  label="Location"
                  value={form.location}
                  error={fieldErrors.location}
                  disabled={saving}
                  maxLength={COMPANY_FIELD_LIMITS.location}
                  onChange={(event) => updateField('location', event.target.value)}
                />
                <TextInput
                  id="company-address"
                  label="Address"
                  value={form.address}
                  error={fieldErrors.address}
                  disabled={saving}
                  maxLength={COMPANY_FIELD_LIMITS.address}
                  onChange={(event) => updateField('address', event.target.value)}
                />
                <TextInput
                  id="company-website"
                  label="Website"
                  value={form.website}
                  error={fieldErrors.website}
                  disabled={saving}
                  maxLength={COMPANY_FIELD_LIMITS.website}
                  onChange={(event) => updateField('website', event.target.value)}
                />
                <TextInput
                  id="company-email"
                  label="Email"
                  type="email"
                  value={form.email}
                  error={fieldErrors.email}
                  disabled={saving}
                  maxLength={COMPANY_FIELD_LIMITS.email}
                  onChange={(event) => updateField('email', event.target.value)}
                />
                <TextInput
                  id="company-phone"
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  error={fieldErrors.phone}
                  disabled={saving}
                  maxLength={COMPANY_FIELD_LIMITS.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="po-section-title">About the Company</h2>
            <div className="mt-5">
              <TextArea
                id="company-description"
                label="Company Description"
                rows={5}
                value={form.description}
                error={fieldErrors.description}
                disabled={saving}
                maxLength={COMPANY_FIELD_LIMITS.description}
                onChange={(event) => updateField('description', event.target.value)}
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
      </QueryStatus>
      <Toast message={toast} />
    </PageContent>
  )
}

export default CompanyProfile
