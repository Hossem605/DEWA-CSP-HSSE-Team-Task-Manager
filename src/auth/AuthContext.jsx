import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { auth, isFirebaseConfigured } from '../firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'

const AuthContext = createContext(null)

// Directory of known users with their roles/positions (keyed by email)
const USER_DIRECTORY = {
  'ahammad.saman@nomac.com': { name: 'Ahammad Saman', position: 'HSSE Supervisor' },
  'asif.javad@nomac.com': { name: 'Asif Javad', position: 'HSSE Engineer' },
  'asif.kalathil@nomac.com': { name: 'Asif Kalathil', position: 'HSSE Supervisor' },
  'shahab.khan@nomac.com': { name: 'Shahab Khan', position: 'HSSE Supervisor' },
  'jawed.akhtar@nomac.com': { name: 'Jawed Akhtar', position: 'HSSE Supervisor' },
  'anoop.sarafudeen@nomac.com': { name: 'Anoop Sarafudeen', position: 'HSSE Supervisor' },
  'hosseme.eddine@nomac.com': { name: 'Hosseme Eddine', position: 'HSSE Supervisor' },
  'aissam.elmarhraoui@nomac.com': { name: 'Aissam Elmarhraoui', position: 'HSSE Manager' },
}

function deriveNameFromEmail(email) {
  if (!email) return ''
  const local = String(email).split('@')[0]
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function getProfile(email) {
  if (!email) return { name: '', position: '' }
  const key = email.toLowerCase().trim()
  const entry = USER_DIRECTORY[key]
  return {
    name: entry?.name || deriveNameFromEmail(email),
    position: entry?.position || 'Member',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      // Demo fallback: restore from localStorage
      const raw = localStorage.getItem('gtm_user')
      const restored = raw ? JSON.parse(raw) : null
      if (restored?.email) {
        const profile = getProfile(restored.email)
        setUser({ ...restored, ...profile })
      } else {
        setUser(null)
      }
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const base = { email: fbUser.email, uid: fbUser.uid }
        const profile = getProfile(fbUser.email)
        setUser({ ...base, ...profile })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      if (user) localStorage.setItem('gtm_user', JSON.stringify(user))
      else localStorage.removeItem('gtm_user')
    }
  }, [user])

  const login = async (email, password) => {
    if (!isFirebaseConfigured) {
      const profile = getProfile(email)
      setUser({ email, ...profile })
      return
    }
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signup = async (email, password) => {
    if (!isFirebaseConfigured) {
      const profile = getProfile(email)
      setUser({ email, ...profile })
      return
    }
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const logout = async () => {
    if (!isFirebaseConfigured) {
      setUser(null)
      return
    }
    await signOut(auth)
  }

  const isAuthenticated = !!user
  const value = useMemo(() => ({ user, isAuthenticated, login, signup, logout, loading, isFirebaseConfigured }), [user, isAuthenticated, loading])

  if (loading) return null

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}