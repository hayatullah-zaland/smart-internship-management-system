import { useContext, useState } from 'react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function Login() {
  const { user, token, signIn } = useContext(AuthContext)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      setPassword('')
      setShowPassword(false)
    } catch (err) {
      if (err.name === 'TypeError' || err.name === 'TimeoutError') {
        setError('Could not connect. Please try again in a moment.')
      } else {
        setError(err.message || 'Unable to sign in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (user && token) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AuthLayout headingId="login-heading">
      <p className="mb-3 text-sm font-medium text-primary">Account access</p>
      <h1 id="login-heading" className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm leading-6 text-base-content/65">Sign in to your university account.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit} aria-busy={loading}>
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="email">Email address</label>
          <input className="input w-full" id="email" name="email" type="email"
            autoComplete="username" placeholder="you@example.com" required maxLength={254}
            value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading}
            aria-describedby={error ? 'login-error' : undefined} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="password">Password</label>
          <div className="relative">
            <input className="input w-full pr-12" id="password" name="password"
              type={showPassword ? 'text' : 'password'} autoComplete="current-password"
              placeholder="Enter your password" required value={password}
              onChange={(event) => setPassword(event.target.value)} disabled={loading}
              aria-describedby={error ? 'login-error' : undefined} />
            <button className="btn btn-ghost btn-square btn-sm absolute top-1 right-1 z-10"
              type="button" onClick={() => setShowPassword(!showPassword)} disabled={loading}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword} title={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {error && <p id="login-error" role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm leading-6 text-error">{error}</p>}
        <button className="btn btn-primary mt-2 min-h-11 w-full" type="submit" disabled={loading}>
          {loading ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Signing in...</> : <>Sign in <ArrowRight size={18} aria-hidden="true" /></>}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-base-content/65">
        New student?{' '}
        <Link className="link link-primary font-medium" to="/signup" aria-disabled={loading}
          onClick={(event) => { if (loading) event.preventDefault() }}>
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
