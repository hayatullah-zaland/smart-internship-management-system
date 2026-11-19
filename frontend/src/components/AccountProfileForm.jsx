import { useContext, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, CircleDot, Mail, RotateCcw, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { validateAccount } from '../context/accountApi'
import { prepareProfileImage } from '../context/profileImage'
import { USER_ROLES } from '../context/userApi'
import ProfileIdentity from './ProfileIdentity'

export default function AccountProfileForm() {
  const { user, token, updateAccount, signOut } = useContext(AuthContext)
  const initialValues = { name: user.name, email: user.email, profileImage: user.profileImage || '' }
  const [values, setValues] = useState(initialValues)
  const [savedValues, setSavedValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [readingPhoto, setReadingPhoto] = useState(false)
  const requestRef = useRef(null)
  const photoReadRef = useRef(null)
  const fileRef = useRef(null)
  const busy = saving || readingPhoto
  const changed = Object.keys(savedValues).some((key) => values[key] !== savedValues[key])

  useEffect(() => () => {
    requestRef.current?.abort()
    photoReadRef.current?.abort()
  }, [token])

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setError('')
    setSaved(false)
  }

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    if (!file || busy) return
    const controller = new AbortController()
    photoReadRef.current = controller
    setReadingPhoto(true)
    setSaved(false)
    setError('')
    setErrors((current) => ({ ...current, profileImage: undefined }))
    try {
      const profileImage = await prepareProfileImage(file)
      if (!controller.signal.aborted) setValues((current) => ({ ...current, profileImage }))
    } catch (err) {
      if (!controller.signal.aborted) {
        setErrors((current) => ({ ...current, profileImage: err.message }))
        if (fileRef.current) fileRef.current.value = ''
      }
    } finally {
      if (!controller.signal.aborted) setReadingPhoto(false)
    }
  }

  function removePhoto() {
    setValues((current) => ({ ...current, profileImage: '' }))
    if (fileRef.current) fileRef.current.value = ''
    setErrors((current) => ({ ...current, profileImage: undefined }))
    setError('')
    setSaved(false)
  }

  function resetChanges() {
    setValues(savedValues)
    if (fileRef.current) fileRef.current.value = ''
    setErrors({})
    setError('')
    setSaved(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy || !changed) return
    const fieldErrors = validateAccount(values)
    setErrors(fieldErrors)
    setError('')
    setSaved(false)
    const firstInvalid = Object.keys(fieldErrors)[0]
    if (firstInvalid) {
      event.currentTarget.elements.namedItem(firstInvalid)?.focus()
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    setSaving(true)
    try {
      const updated = await updateAccount(values, controller.signal)
      if (controller.signal.aborted) return
      const confirmed = { name: updated.name, email: updated.email, profileImage: updated.profileImage || '' }
      setValues(confirmed)
      setSavedValues(confirmed)
      if (fileRef.current) fileRef.current.value = ''
      setSaved(true)
    } catch (err) {
      if (controller.signal.aborted) return
      if (err.status === 401) { signOut(); return }
      let message = err.message || 'Unable to save your account.'
      if (err.name === 'TypeError' || err.name === 'TimeoutError' || err.name === 'AbortError') {
        message = 'Your changes have not been confirmed. Check your connection and refresh your account before trying again.'
      }
      setError(message)
    } finally {
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  return (
    <section className="py-8" aria-labelledby="account-profile-heading">
      <form onSubmit={handleSubmit} noValidate aria-busy={busy}>
        <div className="grid min-w-0 gap-7 md:grid-cols-[208px_minmax(0,1fr)] md:gap-8">
          <ProfileIdentity user={{ ...user, profileImage: values.profileImage }}>
            <fieldset disabled={busy} className="min-w-0">
              <legend className="sr-only">Profile photo</legend>
              <label className="sr-only" htmlFor="account-photo">Profile photo</label>
              <input ref={fileRef} id="account-photo" name="profileImage" type="file" accept="image/jpeg,image/png,image/webp"
                className="sr-only" tabIndex={-1} onChange={choosePhoto} aria-invalid={Boolean(errors.profileImage)}
                aria-describedby={errors.profileImage ? 'account-photo-error account-photo-hint' : 'account-photo-hint'} />
              <div className="flex items-center gap-2 md:justify-center">
                <div className="tooltip tooltip-bottom tooltip-start" data-tip="Change profile photo">
                  <button type="button" className="btn btn-outline btn-square size-11 border-base-300 bg-base-100"
                    onClick={() => fileRef.current?.click()} aria-label="Change profile photo" title="Change profile photo"
                    aria-describedby="account-photo-hint">
                    <Camera size={19} aria-hidden="true" />
                  </button>
                </div>
                <div className="tooltip tooltip-bottom tooltip-start" data-tip="Remove photo">
                  <button className="btn btn-ghost btn-square size-11" type="button" disabled={!values.profileImage}
                    onClick={removePhoto} aria-label="Remove photo" title="Remove photo"><Trash2 size={18} aria-hidden="true" /></button>
                </div>
              </div>
              <p id="account-photo-hint" className="mt-3 text-xs leading-5 text-base-content/60 md:text-center">JPG, PNG or WebP. Maximum 5 MB.</p>
              {errors.profileImage && <p id="account-photo-error" role="alert" className="mt-3 break-words text-sm leading-6 text-error">{errors.profileImage}</p>}
              {readingPhoto && <p role="status" className="mt-3 text-sm text-base-content/70 md:text-center">Preparing photo...</p>}
            </fieldset>
          </ProfileIdentity>
          <div className="min-w-0">
            <div className="mb-7 flex items-center gap-2.5">
              <UserRound size={19} className="shrink-0 text-primary" aria-hidden="true" />
              <h2 id="account-profile-heading" className="text-base font-semibold">Profile details</h2>
            </div>
            <fieldset disabled={busy} className="grid min-w-0 gap-6 sm:grid-cols-2">
              <legend className="sr-only">Edit my account</legend>
              <div className="min-w-0">
                <label className="mb-2 block text-sm font-medium" htmlFor="account-name">Full name</label>
                <div className="relative">
                  <UserRound size={17} className="pointer-events-none absolute top-3.5 left-3 z-10 text-base-content/45" aria-hidden="true" />
                  <input id="account-name" name="name" type="text" autoComplete="name" required minLength={2} maxLength={100}
                    className={`input h-11 w-full bg-base-100 pl-10 ${errors.name ? 'input-error' : ''}`} value={values.name} onChange={updateField}
                    aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'account-name-error' : undefined} />
                </div>
                {errors.name && <p id="account-name-error" className="mt-2 text-sm text-error">{errors.name}</p>}
              </div>
              <div className="min-w-0">
                <label className="mb-2 block text-sm font-medium" htmlFor="account-email">Email address</label>
                <div className="relative">
                  <Mail size={17} className="pointer-events-none absolute top-3.5 left-3 z-10 text-base-content/45" aria-hidden="true" />
                  <input id="account-email" name="email" type="email" autoComplete="email" required maxLength={254}
                    className={`input h-11 w-full bg-base-100 pl-10 ${errors.email ? 'input-error' : ''}`} value={values.email} onChange={updateField}
                    aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'account-email-error' : undefined} />
                </div>
                {errors.email && <p id="account-email-error" className="mt-2 text-sm text-error">{errors.email}</p>}
              </div>
            </fieldset>
            <dl className="mt-8 grid min-w-0 gap-6 border-t border-base-300 pt-6 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="mb-2 flex items-center gap-2 text-xs text-base-content/65"><ShieldCheck size={15} aria-hidden="true" /> Account role</dt>
                <dd className="break-words text-sm font-medium">{USER_ROLES[user.role]}</dd>
              </div>
              {typeof user.isActive === 'boolean' && <div className="min-w-0">
                <dt className="mb-2 text-xs text-base-content/65">Account status</dt>
                <dd className="inline-flex items-center gap-2 text-sm font-medium"><CircleDot size={15} className={user.isActive ? 'text-primary' : 'text-base-content/60'} aria-hidden="true" />{user.isActive ? 'Active' : 'Inactive'}</dd>
              </div>}
            </dl>
            {error && <p role="alert" className="mt-6 break-words rounded-md border border-error/40 bg-error/10 p-3 text-sm leading-6 text-error">{error}</p>}
            <div className="mt-8 grid gap-4 border-t border-base-300 pt-5 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex min-h-6 min-w-0 items-center">
                {saved ? <p role="status" className="flex items-start gap-2 text-sm text-success">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> Account saved successfully.
                </p> : changed ? <p className="flex items-center gap-2 text-xs text-base-content/65"><CircleDot size={14} className="text-warning" aria-hidden="true" /> Unsaved changes</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <div className="tooltip tooltip-top tooltip-start" data-tip="Reset changes">
                  <button className="btn btn-ghost btn-square size-11" type="button" disabled={busy || !changed} onClick={resetChanges}
                    aria-label="Reset changes" title="Reset changes"><RotateCcw size={18} aria-hidden="true" /></button>
                </div>
                <button className="btn btn-primary min-h-11 flex-1 sm:flex-none" type="submit" disabled={busy || !changed}>
                  {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Saving...</>
                    : <><Save size={17} aria-hidden="true" /> Save account</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  )
}
