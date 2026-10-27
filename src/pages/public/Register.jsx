import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/cards/Card.jsx'
import Toast from '../../components/common/Toast.jsx'
import MediaImage from '../../components/common/MediaImage.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import PasswordInput from '../../components/forms/PasswordInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import Checkbox from '../../components/forms/Checkbox.jsx'
import { images } from '../../data/images.js'
import { cn } from '../../utils/cn.js'
import { useAuth } from '../../auth/useAuth.js'
import { dashboardForRole } from '../../auth/rolePaths.js'
import { ApiError } from '../../api/client.js'

const roles = [
  {
    value: 'student-jobseeker',
    title: 'Student / Job Seeker',
    description: 'Build your skill profile, learn, and explore opportunities.',
  },
  {
    value: 'employer',
    title: 'Company Staff',
    description: 'Share roles and review applicants from PeaceOne.',
  },
  {
    value: 'admin',
    title: 'Admin',
    description: 'Oversee users, content and platform operations.',
  },
]

function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('student-jobseeker')
  const [currentPosition, setCurrentPosition] = useState('student')
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}

    if (password && confirmPassword && password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    if (!terms) {
      nextErrors.terms = 'Please agree to the Terms and Privacy Policy.'
    }

    setErrors(nextErrors)
    setFormError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)

    try {
      const body = {
        fullName,
        email,
        password,
        confirmPassword,
        role,
        terms: true,
      }
      if (phone.trim()) {
        body.phone = phone.trim()
      }
      if (role === 'student-jobseeker') {
        body.currentPosition = currentPosition
      }

      const user = await register(body)
      setToast('Account created successfully. Welcome to PeaceOne.')
      window.setTimeout(() => navigate(dashboardForRole(user.role)), 1200)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setFormError(err.message)
        } else if (err.status === 403) {
          setFormError(err.message)
        } else if (err.status === 400) {
          setFormError('Please check the registration details and try again.')
        } else {
          setFormError(err.message)
        }
      } else {
        setFormError('Unable to create an account right now.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="bg-page">
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12 lg:py-16">
        <div className="min-w-0">
          <p className="po-secondary">Create your PeaceOne account</p>
          <h1 className="po-page-title mt-2">Join the platform</h1>
          <p className="po-secondary mt-2 max-w-2xl">
            Create an account to start building your career workspace on PeaceOne.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <Card>
              <h2 className="po-section-title">Account details</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <TextInput
                  id="full-name"
                  label="Full Name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                />
                <TextInput
                  id="register-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
                <PasswordInput
                  id="register-password"
                  label="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <PasswordInput
                  id="confirm-password"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  error={errors.confirmPassword}
                  autoComplete="new-password"
                  required
                />
                <div className="md:col-span-2">
                  <TextInput
                    id="phone"
                    label="Phone Number"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <fieldset>
                <legend className="po-section-title">Role</legend>
                <p className="po-helper mt-1">
                  Choose one primary role. Student / Job Seeker then select a current position.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {roles.map((option) => {
                    const selected = role === option.value

                    return (
                      <label
                        key={option.value}
                        className={cn(
                          'flex min-w-0 cursor-pointer gap-3 rounded-xl border p-4 transition-colors duration-150',
                          selected
                            ? 'border-primary bg-soft'
                            : 'border-line bg-page hover:border-primary/40',
                        )}
                      >
                        <input
                          type="radio"
                          name="register-role"
                          value={option.value}
                          checked={selected}
                          onChange={(event) => setRole(event.target.value)}
                          className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink">{option.title}</span>
                          <span className="po-secondary mt-1 block">{option.description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {role === 'student-jobseeker' ? (
                <div className="mt-6">
                  <SelectInput
                    id="current-position"
                    label="Current Position"
                    value={currentPosition}
                    onChange={(event) => setCurrentPosition(event.target.value)}
                    helperText="This chooses the Student or Job Seeker workspace after registration."
                    options={[
                      { value: 'student', label: 'Student' },
                      { value: 'jobseeker', label: 'Job Seeker' },
                    ]}
                  />
                </div>
              ) : null}
            </Card>

            <Card>
              <Checkbox
                id="terms"
                label={
                  <>
                    I agree to the{' '}
                    <a href="#terms" className="text-primary">
                      Terms and Conditions
                    </a>{' '}
                    and{' '}
                    <a href="#privacy" className="text-primary">
                      Privacy Policy
                    </a>
                    .
                  </>
                }
                checked={terms}
                onChange={(event) => setTerms(event.target.checked)}
                error={errors.terms}
              />

              {formError ? (
                <p className="po-helper po-helper-error mt-4" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="mt-6">
                <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
                  {submitting ? 'Creating account…' : 'Create Account'}
                </Button>
              </div>
            </Card>
          </form>

          <p className="po-secondary mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary">
              Login
            </Link>
          </p>
        </div>

        <div className="hidden min-w-0 lg:sticky lg:top-24 lg:block">
          <MediaImage src={images.register.src} alt={images.register.alt} aspect="4/3" />
          <p className="po-secondary mt-4">
            PeaceOne keeps registration focused on the details needed to start a career
            development workspace.
          </p>
        </div>
      </div>
      <Toast message={toast} />
    </section>
  )
}

export default Register
