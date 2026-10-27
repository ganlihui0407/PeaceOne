import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCurrentUser, loginAccount, logoutAccount, registerAccount } from '../api/auth.js'
import { clearCsrfToken } from '../api/client.js'
import { AuthContext } from './auth-context.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [sessionNotice, setSessionNotice] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetchCurrentUser()
      .then((current) => {
        if (cancelled) {
          return
        }
        setUser(current.user)
        if (current.status === 'unavailable') {
          setSessionNotice('unavailable')
          clearCsrfToken()
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const register = useCallback(async (input) => {
    const nextUser = await registerAccount(input)
    setSessionNotice(null)
    setUser(nextUser)
    return nextUser
  }, [])

  const login = useCallback(async (input) => {
    const nextUser = await loginAccount(input)
    setSessionNotice(null)
    setUser(nextUser)
    return nextUser
  }, [])

  const logout = useCallback(async () => {
    await logoutAccount()
    setSessionNotice(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, sessionNotice, register, login, logout }),
    [user, ready, sessionNotice, register, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
