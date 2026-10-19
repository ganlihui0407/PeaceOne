import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import { adminProfile } from '../../data/users.js'

function AdminProfile() {
  const [fullName, setFullName] = useState(adminProfile.fullName)
  const [email, setEmail] = useState(adminProfile.email)
  const [phone, setPhone] = useState(adminProfile.phone)
  const [toast, setToast] = useState('')

  function handleSave(event) {
    event.preventDefault()
    setToast('Administrator profile changes saved.')
    window.setTimeout(() => setToast(''), 2500)
  }

  return (
    <PageContent
      title="My Profile"
      description="Keep your administrator details current."
    >
      <form className="space-y-6" onSubmit={handleSave}>
        <Card>
          <h2 className="po-section-title">Basic Information</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <TextInput
              id="admin-name"
              label="Full Name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
            <TextInput
              id="admin-email"
              label="Email Address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextInput
              id="admin-phone"
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <div>
              <p className="po-label">Account Status</p>
              <div className="flex h-11 items-center">
                <Badge status="active" className="normal-case">
                  {adminProfile.accountStatus}
                </Badge>
              </div>
            </div>
            <div>
              <p className="po-label">Role</p>
              <div className="flex h-11 items-center">
                <Badge tone="primary" className="normal-case">
                  {adminProfile.role}
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

export default AdminProfile
