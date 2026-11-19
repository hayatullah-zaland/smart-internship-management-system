import { useEffect, useId, useRef, useState } from 'react'
import { Save, SquarePen, Trash2, X } from 'lucide-react'
import { validateManagedUserDetails } from '../context/userApi'
import UserStatusForm from './UserStatusForm'

export default function UserActions({ account, disabled, saving, error, onSaveStatus, onUpdate, onDelete }) {
  const id = useId()
  const nameRef = useRef(null)
  const [mode, setMode] = useState('')
  const [values, setValues] = useState({ name: account.name, email: account.email })
  const [errors, setErrors] = useState({})
  const changed = values.name !== account.name || values.email !== account.email
  useEffect(() => {
    if (mode === 'edit') nameRef.current?.focus()
  }, [mode])

  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }
  function cancel() {
    setMode('')
    setValues({ name: account.name, email: account.email })
    setErrors({})
  }
  function submit(event) {
    event.preventDefault()
    if (disabled || saving || !changed) return
    const fieldErrors = validateManagedUserDetails(values)
    setErrors(fieldErrors)
    const first = Object.keys(fieldErrors)[0]
    if (first) return event.currentTarget.elements.namedItem(first)?.focus()
    onUpdate(account, values)
  }

  if (account.role === 'admin') return <UserStatusForm account={account} disabled={disabled} saving={saving} onSave={onSaveStatus} />

  return (
    <div className="min-w-0 space-y-4">
      {error && <p role="alert" className="break-words rounded-md border border-error/40 bg-error/10 p-3 text-sm leading-6 text-error">{error}</p>}
      <UserStatusForm account={account} disabled={disabled || Boolean(mode)} saving={saving} onSave={onSaveStatus} />
      {!mode && <div className="flex items-center gap-2">
        <button type="button" className="btn btn-ghost btn-square btn-sm" disabled={disabled || saving}
          onClick={() => setMode('edit')} aria-label={`Edit user ${account.name}`} title="Edit user">
          <SquarePen size={17} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-ghost btn-square btn-sm text-error" disabled={disabled || saving}
          onClick={() => setMode('delete')} aria-label={`Delete user ${account.name}`} title="Delete user">
          <Trash2 size={17} aria-hidden="true" />
        </button>
      </div>}
      {mode === 'edit' && <form onSubmit={submit} aria-label={`Edit user ${account.name}`} noValidate aria-busy={saving}>
        <fieldset className="min-w-0 space-y-4" disabled={disabled || saving}>
          <legend className="sr-only">User details</legend>
          {['name', 'email'].map((name) => <div className="min-w-0" key={name}>
            <label className="mb-2 block text-sm font-medium" htmlFor={`${id}-${name}`}>{name === 'name' ? 'Full name' : 'Email address'}</label>
            <input ref={name === 'name' ? nameRef : undefined} id={`${id}-${name}`} name={name}
              type={name === 'email' ? 'email' : 'text'} className={`input w-full ${errors[name] ? 'input-error' : ''}`}
              value={values[name]} onChange={changeField} autoComplete="off" required minLength={name === 'name' ? 2 : undefined}
              maxLength={name === 'name' ? 100 : 254} aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `${id}-${name}-error` : undefined} />
            {errors[name] && <p id={`${id}-${name}-error`} className="mt-2 text-xs text-error">{errors[name]}</p>}
          </div>)}
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={disabled || saving || !changed}>
            {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Saving...</>
              : <><Save size={16} aria-hidden="true" /> Save changes</>}
          </button>
          <button type="button" className="btn btn-ghost btn-square btn-sm" onClick={cancel} disabled={disabled || saving}
            aria-label="Cancel user edit" title="Cancel user edit"><X size={17} aria-hidden="true" /></button>
        </div>
      </form>}
      {mode === 'delete' && <div role="group" aria-label={`Confirm deletion of ${account.name}`}>
        <p className="break-words text-sm font-medium">Permanently delete {account.name} ({account.email})?</p>
        <p className="mt-2 text-sm leading-6 text-base-content/70">This cannot be undone. Accounts with project records cannot be deleted.</p>
        {account.isActive && <p className="mt-2 text-sm text-warning">Deactivate this account before deleting it.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-error btn-sm" disabled={disabled || saving || account.isActive}
            onClick={() => onDelete(account)}>
            {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Deleting...</>
              : <><Trash2 size={16} aria-hidden="true" /> Delete user</>}
          </button>
          <button type="button" className="btn btn-ghost btn-square btn-sm" onClick={cancel} disabled={disabled || saving}
            aria-label="Cancel user deletion" title="Cancel user deletion"><X size={17} aria-hidden="true" /></button>
        </div>
      </div>}
    </div>
  )
}
