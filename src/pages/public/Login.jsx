import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/cards/Card.jsx'
import MediaImage from '../../components/common/MediaImage.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import PasswordInput from '../../components/forms/PasswordInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import Checkbox from '../../components/forms/Checkbox.jsx'
import { images } from '../../data/images.js'

const demoDestinations = {
  student: '/student/dashboard',
  jobseeker: '/jobseeker/dashboard',
  employer: '/employer/dashboard',
  admin: '/admin/dashboard',
}

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [demoRole, setDemoRole] = useState('student')
  const [remember, setRemember] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    navigate(demoDestinations[demoRole] || '/student/dashboard')
  }

  return (
    <section className="bg-page">
      <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-6xl lg:grid-cols-2">
        <div className="relative hidden min-h-[560px] overflow-hidden lg:block">
          <MediaImage
            src={images.login.src}
            alt={images.login.alt}
            aspect="none"
            rounded={false}
            className="absolute inset-0 h-full rounded-none"
          />
        </div>

        <div className="flex items-center px-4 py-10 sm:px-6 lg:px-12">
          <Card className="w-full max-w-md" padding="lg">
            <p className="po-secondary">Welcome back</p>
            <h1 className="po-page-title mt-2">Login to PeaceOne</h1>
            <p className="po-secondary mt-2">
              Sign in to continue to your PeaceOne workspace.
            </p>

            <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
              <TextInput
                id="login-email"
                label="Email Address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <PasswordInput
                id="login-password"
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <SelectInput
                id="demo-role"
                label="Login as"
                value={demoRole}
                onChange={(event) => setDemoRole(event.target.value)}
                helperText="Choose a workspace to preview. This demonstration does not check a password."
                options={[
                  { value: 'student', label: 'Student' },
                  { value: 'jobseeker', label: 'Job Seeker' },
                  { value: 'employer', label: 'Company Staff' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox
                  id="remember-me"
                  label="Remember me"
                  className="w-auto"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <a href="#forgot-password" className="shrink-0 text-sm font-medium text-primary">
                  Forgot password
                </a>
              </div>
              <p id="forgot-password" className="po-helper mt-0">
                Password recovery is not available in this prototype.
              </p>
              <Button type="submit" className="w-full" size="lg">
                Login
              </Button>
            </form>

            <p className="po-secondary mt-6">
              New to PeaceOne?{' '}
              <Link to="/register" className="font-medium text-primary">
                Register
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </section>
  )
}

export default Login
