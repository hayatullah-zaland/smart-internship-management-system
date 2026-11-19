import { useEffect, useState } from 'react'
import { LogOut, RotateCw } from 'lucide-react'
import { AuthContext } from './AuthContext'
import { clearSessionToken, fetchSessionUser, isValidSessionUser, readSessionToken, saveSessionToken } from './authSession'
import AuthLayout from '../components/AuthLayout'
import { saveAccount } from './accountApi'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(readSessionToken)
  const [restoreError, setRestoreError] = useState('')
  const [restoreAttempt, setRestoreAttempt] = useState(0)

  useEffect(() => {
    if (!token || user) return
    const controller = new AbortController()

    async function restoreSession() {
      try {
        const restoredUser = await fetchSessionUser(token, controller.signal)
        if (!controller.signal.aborted) setUser(restoredUser)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) {
          clearSessionToken()
          setToken(null)
          return
        }
        setRestoreError('Could not restore your session. Please check your connection and try again.')
      }
    }

    restoreSession()
    return () => controller.abort()
  }, [token, user, restoreAttempt])

  async function signIn(email, password) {
    const credentials = { email: email.trim().toLowerCase(), password }
    const response = await fetch('/api/v1/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Sign in is unavailable right now. Please try again.')
    }
    const result = await response.json()
    if (!response.ok || result?.success !== true) {
      throw new Error(result?.message || 'Unable to sign in. Please try again.')
    }
    if (!isValidSessionUser(result.data?.user) || result.data.user.email !== credentials.email
      || typeof result.data.token !== 'string' || !result.data.token.trim()) {
      throw new Error('Unable to sign in. Please try again.')
    }

    // Save only the token; restore current account details from the server.
    saveSessionToken(result.data.token)
    setRestoreError('')
    setToken(result.data.token)
    setUser(result.data.user)
  }

  async function signUp(name, email, password) {
    const details = { name: name.trim(), email: email.trim().toLowerCase(), password }
    const response = await fetch('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Registration is unavailable right now. Please try again.')
    }
    const result = await response.json()
    if (!response.ok || result?.success !== true) {
      throw new Error(result?.message || 'Unable to create your account. Please try again.')
    }
    const account = result.data?.user
    if (!isValidSessionUser(account) || account.role !== 'student' || account.name !== details.name || account.email !== details.email) {
      throw new Error('Unable to confirm your account. Check your details before trying again.')
    }
    // Creating an account does not sign the student in automatically.
  }

  function signOut() {
    clearSessionToken()
    setRestoreError('')
    setUser(null)
    setToken(null)
  }

  async function updateAccount(values, signal) {
    const updated = await saveAccount(token, user, values, signal)
    if (!signal?.aborted) {
      setUser((current) => current?.id === updated.id ? updated : current)
    }
    return updated
  }

  function retryRestore() {
    setRestoreError('')
    setRestoreAttempt((attempt) => attempt + 1)
  }

  // Keep route guards from redirecting while the saved session is checked.
  if (token && !user) {
    return (
      <AuthLayout headingId="restore-heading">
        <h1 id="restore-heading" className="text-xl font-semibold">{restoreError ? 'Connection problem' : 'Restoring your session'}</h1>
        {restoreError ? (
          <>
            <p role="alert" className="mt-4 text-sm leading-6 text-error">{restoreError}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" onClick={retryRestore}>
                <RotateCw size={18} aria-hidden="true" /> Retry
              </button>
              <button type="button" className="btn btn-ghost" onClick={signOut}>
                <LogOut size={18} aria-hidden="true" /> Sign out
              </button>
            </div>
          </>
        ) : (
          <p role="status" className="mt-4 flex items-center gap-3 text-sm text-base-content/70">
            <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Checking your account...
          </p>
        )}
      </AuthLayout>
    )
  }

  return (
    <AuthContext.Provider value={{ user, token, signIn, signUp, signOut, updateAccount }}>
      {children}
    </AuthContext.Provider>
  )
}
