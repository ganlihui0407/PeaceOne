import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/cards/Card.jsx'
import Button from '../../components/common/Button.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { ApiError } from '../../api/client.js'

function SettingsPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleLogout() {
    setError('')
    setSubmitting(true)
    try {
      await logout()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to log out right now.')
      setSubmitting(false)
    }
  }

  return (
    <PageContent
      title="Settings"
      description="Review account and workspace preferences for your PeaceOne profile."
    >
      <Card>
        <h2 className="po-section-title">Preferences</h2>
        <p className="po-body mt-3">
          Your PeaceOne workspace is active. Additional notification and display preferences can be
          managed here.
        </p>
      </Card>

      <Card className="mt-6">
        <h2 className="po-section-title">Account</h2>
        <p className="po-body mt-3">Sign out of this PeaceOne workspace on this device.</p>
        {error ? (
          <p className="po-helper mt-3" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5">
          <Button type="button" variant="danger" onClick={handleLogout} disabled={submitting}>
            {submitting ? 'Signing out…' : 'Log out'}
          </Button>
        </div>
      </Card>
    </PageContent>
  )
}

export default SettingsPage
