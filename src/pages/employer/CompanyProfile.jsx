import { useState } from 'react'
import { Building2 } from 'lucide-react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import { nexaDigital } from '../../data/companies.js'

function CompanyProfile() {
  const [companyName, setCompanyName] = useState(nexaDigital.companyName)
  const [industry, setIndustry] = useState(nexaDigital.industry)
  const [location, setLocation] = useState(nexaDigital.location)
  const [website, setWebsite] = useState(nexaDigital.website)
  const [companyDescription, setCompanyDescription] = useState(nexaDigital.companyDescription)
  const [toast, setToast] = useState('')

  function handleSave(event) {
    event.preventDefault()
    setToast('Company profile changes saved.')
    window.setTimeout(() => setToast(''), 2500)
  }

  return (
    <PageContent
      title="Company Profile"
      description="Manage the company information shown across PeaceOne job postings."
    >
      <form className="space-y-6" onSubmit={handleSave}>
        <Card>
          <h2 className="po-section-title">Company Information</h2>
          <div className="mt-5 flex flex-col gap-6 lg:flex-row">
            <div className="flex w-full max-w-[220px] flex-col items-start gap-3">
              <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-line bg-page text-primary">
                <Building2 size={28} aria-hidden="true" />
              </div>
              <p className="po-helper mt-0">Optional company logo. You can add a visual placeholder for your organisation.</p>
            </div>
            <div className="grid min-w-0 flex-1 gap-5 md:grid-cols-2">
              <TextInput
                id="company-name"
                label="Company Name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
              <TextInput
                id="company-industry"
                label="Industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
              />
              <TextInput
                id="company-location"
                label="Location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
              <TextInput
                id="company-website"
                label="Website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
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
              value={companyDescription}
              onChange={(event) => setCompanyDescription(event.target.value)}
            />
          </div>
        </Card>

        <Card>
          <h2 className="po-section-title">Company Status</h2>
          <div className="mt-4 flex h-11 items-center">
            <Badge status="active" className="normal-case">
              {nexaDigital.companyStatus}
            </Badge>
          </div>
          <p className="po-helper">Company Status is shown for reference and cannot be changed here.</p>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
      <Toast message={toast} />
    </PageContent>
  )
}

export default CompanyProfile
