import { useState } from 'react'
import { AuthContext } from './AuthContext'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)

  async function signIn(email, password) {
    const response = await fetch('/api/v1/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Sign in is unavailable right now. Please try again.')
    }
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to sign in. Please try again.')
    }
    if (!result.data?.user || typeof result.data.token !== 'string') {
      throw new Error('Unable to sign in. Please try again.')
    }

    // Keep the session in memory for this first frontend step.
    setToken(result.data.token)
    setUser(result.data.user)
  }

  async function signUp(name, email, password) {
    const response = await fetch('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Registration is unavailable right now. Please try again.')
    }
    const result = await response.json()
    if (!response.ok || !result.success || !result.data?.user) {
      throw new Error(result.message || 'Unable to create your account. Please try again.')
    }
    // Creating an account does not sign the student in automatically.
  }

  function signOut() {
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
