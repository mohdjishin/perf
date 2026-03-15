import React, { createContext, useContext, useState, useEffect } from 'react'
import { loadConfig } from '../config'
import { setApiBaseUrl } from '../api/client'
import { api } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfig().then((cfg) => {
      if (cfg.apiBaseUrl) setApiBaseUrl(cfg.apiBaseUrl)
    })
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    api('/auth/me')
      .then((res) => {
        if (res.user) {
          const u = { ...res.user, id: res.user.id }
          setUser(u)
          localStorage.setItem('user', JSON.stringify(u))
        }
      })
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  const login = async (email, password) => {
    const { token, user: u } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem('token', token)
    const userData = { ...u, id: u.id }
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }

  const register = async (data) => {
    const { token, user: u } = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    localStorage.setItem('token', token)
    const userData = { ...u, id: u.id }
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }
  const googleAuth = async (code) => {
    const { token, user: u } = await api('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
    localStorage.setItem('token', token)
    const userData = { ...u, id: u.id }
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // Ignore - clear local state regardless
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
    }
  }

  const value = { user, loading, login, register, logout, setUser, googleAuth }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

