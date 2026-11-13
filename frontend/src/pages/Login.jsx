import { useContext, useState } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, LogOut } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function Login({ onGoToSignup }) {
  const { user, signIn, signOut } = useContext(AuthContext)
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

  function handleSignOut() {
    signOut()
    setEmail('')
    setPassword('')
    setError('')
  }

  return (
    <AuthLayout headingId="login-heading">
          {user ? (
            <div role="status">
              <CheckCircle2 className="mb-5 text-primary" size={36} aria-hidden="true" />
              <h1 id="login-heading" className="text-2xl font-semibold">You're signed in</h1>
              <p className="mt-2 break-words text-base-content/75">Welcome, {user.name}.</p>
              <dl className="my-7 divide-y divide-base-300 border-y border-base-300 text-sm">
                <div className="py-4">
                  <dt className="mb-1 text-base-content/65">Email</dt>
                  <dd className="break-all font-medium">{user.email}</dd>
                </div>
                <div className="py-4">
                  <dt className="mb-1 text-base-content/65">Account role</dt>
                  <dd className="font-medium capitalize">{user.role.replaceAll('_', ' ')}</dd>
                </div>
              </dl>
              <button className="btn btn-outline w-full" type="button" onClick={handleSignOut}>
                <LogOut size={18} aria-hidden="true" /> Sign out
              </button>
            </div>
          ) : (
            <>
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
                <button className="link link-primary font-medium" type="button" onClick={onGoToSignup} disabled={loading}>
                  Create an account
                </button>
              </p>
            </>
          )}
    </AuthLayout>
  )
}
