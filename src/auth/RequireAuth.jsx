import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.js'
import { dashboardForRole } from './rolePaths.js'

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <p className="po-secondary">Loading workspace…</p>
    </div>
  )
}

export function RequireAuth({ roles, children }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return <AuthLoading />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to={dashboardForRole(user.role)} replace />
  }

  return children
}
