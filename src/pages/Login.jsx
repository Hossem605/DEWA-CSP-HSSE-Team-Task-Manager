import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

export default function Login() {
  const { login, signup, isFirebaseConfigured } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }
    try {
      setLoading(true)
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signup(email, password)
      }
      nav('/dashboard', { replace: true })
    } catch (err) {
      setError(err?.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="login-card">
        <h2 className="login-title">DEWA CSP HSSE Team Task Manager</h2>
        <p className="login-sub">{isFirebaseConfigured ? 'Sign in to manage your team\'s tasks' : 'Demo mode: any email/password works (no backend yet)'}</p>
        <form onSubmit={onSubmit}>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

          <div style={{ height: 10 }} />
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />

          {error && (
            <div style={{ color: 'var(--error)', marginTop: 8, fontSize: 12 }}>{error}</div>
          )}

          <div className="actions" style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="button" type="submit" disabled={loading}>{mode === 'login' ? 'Login' : 'Sign up'}</button>
            <button type="button" className="secondary" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Create account' : 'Have an account? Login'}
            </button>
          </div>
        </form>
        {!isFirebaseConfigured && (
          <>
            <hr className="sep" />
            <p className="small">Demo login accepts any email/password and stores only email locally.</p>
          </>
        )}
      </div>
    </div>
  )
}