import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCurrentUser, loginAccount, logoutAccount, registerAccount } from '../api/auth.js'
import { AuthContext } from './auth-context.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetchCurrentUser()
      .then((current) => {
        if (!cancelled) {
          setUser(current)
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
    setUser(nextUser)
    return nextUser
  }, [])

  const login = useCallback(async (input) => {
    const nextUser = await loginAccount(input)
    setUser(nextUser)
    return nextUser
  }, [])

  const logout = useCallback(async () => {
    await logoutAccount()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, register, login, logout }),
    [user, ready, register, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
