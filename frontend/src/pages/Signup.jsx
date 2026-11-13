import { useContext, useState } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function Signup({ onGoToLogin }) {
  const { signUp } = useContext(AuthContext)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return
    setError('')
    if (name.trim().length < 2) {
      setError('Please enter a name with at least 2 characters.')
      return
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('Your password is too long. Please choose a shorter one.')
      return
    }
    if (password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await signUp(name, email, password)
      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setCreated(true)
    } catch (err) {
      if (err.name === 'TypeError' || err.name === 'TimeoutError') {
        setError('Could not connect. Please try again in a moment.')
      } else {
        setError(err.message || 'Unable to create your account. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout headingId="signup-heading">
      {created ? (
        <div role="status">
          <CheckCircle2 className="mb-5 text-primary" size={36} aria-hidden="true" />
          <h1 id="signup-heading" className="text-2xl font-semibold">Account created</h1>
          <p className="mt-3 text-sm leading-6 text-base-content/75">
            Your student account is ready. Sign in with your email and password.
          </p>
          <button className="btn btn-primary mt-7 w-full" type="button" onClick={onGoToLogin}>
            Go to sign in <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm font-medium text-primary">Student registration</p>
          <h1 id="signup-heading" className="text-3xl font-semibold">Create an account</h1>
          <p className="mt-2 text-sm leading-6 text-base-content/65">Join your university internship portal.</p>

          <form className="mt-7 space-y-5" onSubmit={handleSubmit} aria-busy={loading}>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="signup-name">Full name</label>
              <input className="input w-full" id="signup-name" name="name" type="text"
                autoComplete="name" placeholder="Your full name" required minLength={2} maxLength={100}
                value={name} onChange={(event) => setName(event.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="signup-email">Email address</label>
              <input className="input w-full" id="signup-email" name="email" type="email"
                autoComplete="email" placeholder="you@example.com" required maxLength={254}
                value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="signup-password">Password</label>
              <div className="relative">
                <input className="input w-full pr-12" id="signup-password" name="password"
                  type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                  placeholder="Create a password" required minLength={8} aria-describedby="password-hint"
                  value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
                <button className="btn btn-ghost btn-square btn-sm absolute top-1 right-1 z-10" type="button"
                  onClick={() => setShowPassword(!showPassword)} disabled={loading}
                  aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} aria-pressed={showPassword}
                  title={showPassword ? 'Hide passwords' : 'Show passwords'}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
              <p id="password-hint" className="mt-2 text-xs text-base-content/65">At least 8 characters.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="signup-confirm">Confirm password</label>
              <input className="input w-full" id="signup-confirm" name="confirmPassword"
                type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                placeholder="Re-enter your password" required minLength={8}
                value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={loading} />
            </div>
            {error && <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm leading-6 text-error">{error}</p>}
            <button className="btn btn-primary mt-2 min-h-11 w-full" type="submit" disabled={loading}>
              {loading ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Creating account...</> : <>Create account <ArrowRight size={18} aria-hidden="true" /></>}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-base-content/65">
            Already have an account?{' '}
            <button className="link link-primary font-medium" type="button" onClick={onGoToLogin} disabled={loading}>Sign in</button>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
