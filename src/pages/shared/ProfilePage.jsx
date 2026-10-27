import { useState } from 'react'
import Button from '../../components/common/Button.jsx'
import Badge from '../../components/common/Badge.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import { educationLevels } from '../../data/candidateData.js'

function ProfilePage({ profile }) {
  const [fullName, setFullName] = useState(profile.fullName)
  const [email, setEmail] = useState(profile.email)
  const [phone, setPhone] = useState(profile.phone)
  const [educationLevel, setEducationLevel] = useState(profile.educationLevel)
  const [fieldOfStudy, setFieldOfStudy] = useState(profile.fieldOfStudy)
  const [institution, setInstitution] = useState(profile.institution)
  const [graduationYear, setGraduationYear] = useState(profile.graduationYear)
  const [location, setLocation] = useState(profile.location)
  const [experienceSummary, setExperienceSummary] = useState(profile.experienceSummary)
  const [requestedPosition, setRequestedPosition] = useState(
    profile.currentPosition === 'Student' ? 'Job Seeker' : 'Student',
  )
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  function handleSave(event) {
    event.preventDefault()
    showToast('Profile changes saved.')
  }

  function handlePositionRequest(event) {
    event.preventDefault()
    showToast('Position change request submitted for review.')
  }

  return (
    <PageContent
      title="My Profile"
      description="Keep your PeaceOne details current."
    >
      <form className="space-y-6" onSubmit={handleSave}>
        <Card>
          <h2 className="po-section-title">Basic information</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <TextInput
              id="profile-name"
              label="Full Name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
            <TextInput
              id="profile-email"
              label="Email Address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextInput
              id="profile-phone"
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <div>
              <p className="po-label">Account Status</p>
              <div className="flex h-11 items-center">
                <Badge status="active">{profile.accountStatus}</Badge>
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
              value={educationLevel}
              onChange={(event) => setEducationLevel(event.target.value)}
              options={educationLevels.map((value) => ({ value, label: value }))}
            />
            <TextInput
              id="field-of-study"
              label="Field of Study"
              value={fieldOfStudy}
              onChange={(event) => setFieldOfStudy(event.target.value)}
            />
            <TextInput
              id="institution"
              label="Institution"
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
            />
            <TextInput
              id="graduation-year"
              label="Graduation Year"
              value={graduationYear}
              onChange={(event) => setGraduationYear(event.target.value)}
            />
          </div>
        </Card>

        <Card>
          <h2 className="po-section-title">Career / experience information</h2>
          <div className="mt-5 grid gap-5">
            <TextInput
              id="profile-location"
              label="Location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <TextArea
              id="experience-summary"
              label="Experience Summary"
              value={experienceSummary}
              onChange={(event) => setExperienceSummary(event.target.value)}
            />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save Changes</Button>
        </div>
      </form>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="po-section-title">Current Position</h2>
          <p className="po-secondary mt-2">This is the logged-in position for this PeaceOne account.</p>
          <p className="mt-4 text-lg font-semibold text-ink">{profile.currentPosition}</p>
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
              <p className="text-sm font-medium text-ink">{profile.currentPosition}</p>
            </div>
            <SelectInput
              id="requested-position"
              label="Requested Position"
              value={requestedPosition}
              onChange={(event) => setRequestedPosition(event.target.value)}
              options={[
                { value: 'Student', label: 'Student' },
                { value: 'Job Seeker', label: 'Job Seeker' },
              ]}
            />
            <Button type="submit">Submit Position Change Request</Button>
          </form>
        </Card>
      </div>

      <Toast message={toast} />
    </PageContent>
  )
}

export default ProfilePage
