import { useContext, useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, KeyRound, LogOut, RotateCcw } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { changePassword, validatePasswordChange } from '../context/settingsApi'

const emptyValues = { currentPassword: '', newPassword: '', confirmPassword: '' }
const fields = [['currentPassword', 'Current password'], ['newPassword', 'New password'], ['confirmPassword', 'Confirm new password']]

export default function PasswordSettings() {
  const { token, signOut } = useContext(AuthContext)
  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState({})
  const [showPasswords, setShowPasswords] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState({ saved: false, error: '', uncertain: false })
  const requestRef = useRef(null)
  const formRef = useRef(null)
  const blocked = saving || result.uncertain

  useEffect(() => () => requestRef.current?.abort(), [token])
  useEffect(() => {
    if (!saving && errors.currentPassword) formRef.current?.elements.namedItem('currentPassword')?.focus()
  }, [saving, errors.currentPassword])

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined, ...(name === 'newPassword' ? { confirmPassword: undefined } : {}) }))
    setResult({ saved: false, error: '', uncertain: false })
  }

  function clear() {
    setValues(emptyValues)
    setErrors({})
    setShowPasswords(false)
    setResult({ saved: false, error: '', uncertain: false })
  }

  async function submit(event) {
    event.preventDefault()
    if (blocked || requestRef.current) return
    const fieldErrors = validatePasswordChange(values)
    setErrors(fieldErrors)
    setResult({ saved: false, error: '', uncertain: false })
    const first = Object.keys(fieldErrors)[0]
    if (first) return event.currentTarget.elements.namedItem(first)?.focus()
    const controller = new AbortController()
    requestRef.current = controller
    setSaving(true)
    try {
      await changePassword(token, values, controller.signal)
      if (controller.signal.aborted) return
      setValues(emptyValues)
      setShowPasswords(false)
      setResult({ saved: true, error: '', uncertain: false })
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) return signOut()
      if (error.status === 400 && error.message === 'Current password is incorrect.') {
        setErrors({ currentPassword: error.message })
      } else {
        setResult({ saved: false, error: error.message || 'Unable to change your password.', uncertain: Boolean(error.uncertain) })
      }
      if (error.uncertain) {
        setValues(emptyValues)
        setShowPasswords(false)
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  return (
    <section className="grid min-w-0 gap-6 border-b border-base-300 py-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-8" aria-labelledby="security-heading">
      <h2 id="security-heading" className="flex items-start gap-2.5 text-base font-semibold"><KeyRound size={19} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />Security</h2>
      <form ref={formRef} className="min-w-0 max-w-xl" noValidate onSubmit={submit} aria-label="Change password" aria-busy={saving}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Change password</h3>
          <button type="button" className="btn btn-ghost btn-square btn-sm" disabled={blocked} onClick={() => setShowPasswords((current) => !current)}
            aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'} title={showPasswords ? 'Hide passwords' : 'Show passwords'} aria-pressed={showPasswords}>
            {showPasswords ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        <fieldset disabled={blocked} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <legend className="sr-only">Password details</legend>
          {fields.map(([name, label]) => <div key={name} className={`min-w-0 ${name === 'currentPassword' ? 'sm:col-span-2' : ''}`}>
            <label className="mb-2 block text-sm font-medium" htmlFor={`settings-${name}`}>{label}</label>
            <input id={`settings-${name}`} name={name} type={showPasswords ? 'text' : 'password'} value={values[name]} onChange={updateField}
              className={`input h-11 w-full bg-base-100 ${errors[name] ? 'input-error' : ''}`} required maxLength={72}
              minLength={name === 'currentPassword' ? undefined : 8} autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
              aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `settings-${name}-error` : name === 'newPassword' ? 'password-requirements' : undefined} />
            {errors[name] && <p id={`settings-${name}-error`} className="mt-2 break-words text-sm leading-6 text-error">{errors[name]}</p>}
          </div>)}
        </fieldset>
        <p id="password-requirements" className="mt-3 text-xs leading-5 text-base-content/65">Minimum 8 characters. Maximum 72 UTF-8 bytes.</p>
        {result.error && <p role="alert" className="mt-5 break-words text-sm leading-6 text-error">{result.error}</p>}
        {result.saved && <p role="status" className="mt-5 text-sm leading-6 text-primary">Password changed successfully.</p>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary min-h-11" disabled={blocked}>
            {saving ? <span className="loading loading-spinner loading-xs" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
            {saving ? 'Changing...' : 'Change password'}
          </button>
          <button type="button" className="btn btn-ghost btn-square min-h-11" disabled={blocked || !Object.values(values).some(Boolean)} onClick={clear}
            aria-label="Clear passwords" title="Clear passwords"><RotateCcw size={18} aria-hidden="true" /></button>
          {result.uncertain && <button type="button" className="btn btn-outline min-h-11" onClick={signOut}><LogOut size={18} aria-hidden="true" />Sign out</button>}
        </div>
      </form>
    </section>
  )
}
