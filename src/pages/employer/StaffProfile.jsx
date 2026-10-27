import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import { employerStaff } from '../../data/employerStaff.js'

function StaffProfile() {
  const [fullName, setFullName] = useState(employerStaff.fullName)
  const [email, setEmail] = useState(employerStaff.email)
  const [phone, setPhone] = useState(employerStaff.phone)
  const [position, setPosition] = useState(employerStaff.position)
  const [department, setDepartment] = useState(employerStaff.department)
  const [toast, setToast] = useState('')

  function handleSave(event) {
    event.preventDefault()
    setToast('Staff profile changes saved.')
    window.setTimeout(() => setToast(''), 2500)
  }

  return (
    <PageContent
      title="My Profile"
      description="Keep your company staff details current."
    >
      <form className="space-y-6" onSubmit={handleSave}>
        <Card>
          <h2 className="po-section-title">Basic Information</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <TextInput
              id="staff-name"
              label="Full Name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
            <TextInput
              id="staff-email"
              label="Email Address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextInput
              id="staff-phone"
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <div>
              <p className="po-label">Account Status</p>
              <div className="flex h-11 items-center">
                <Badge status="active" className="normal-case">
                  {employerStaff.accountStatus}
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
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />
            <TextInput
              id="staff-department"
              label="Department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            />
            <div>
              <p className="po-label">Staff Status</p>
              <div className="flex h-11 items-center">
                <Badge status="active" className="normal-case">
                  {employerStaff.staffStatus}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
      <Toast message={toast} />
    </PageContent>
  )
}

export default StaffProfile
