import { createContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/auth.api'
import { setAccessToken } from '../api/axios'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    try {
      const { accessToken, user: u } = await authApi.refresh()
      setAccessToken(accessToken)
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshSession() }, [refreshSession])

  const login = async (email, password) => {
    const { accessToken, user: u } = await authApi.login(email, password)
    setAccessToken(accessToken)
    setUser(u)
  }

  const register = async (body) => {
    const { accessToken, user: u } = await authApi.register(body)
    setAccessToken(accessToken)
    setUser(u)
  }

  const logout = async () => {
    await authApi.logout()
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
