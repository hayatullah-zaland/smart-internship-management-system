import { useId, useRef, useState } from 'react'
import { Check, LockKeyhole, X } from 'lucide-react'

export function UserStatusFields({ id, inputRef, account, isActive, disabled, saving, onChange, onSubmit, onCancel }) {
  if (account.role === 'admin') return <p className="flex items-center gap-2 text-sm text-base-content/65">
    <LockKeyhole size={16} className="shrink-0" aria-hidden="true" /> Administrator access protected
  </p>
  const changed = isActive !== account.isActive
  return (
    <form onSubmit={onSubmit} aria-label={`Account access for ${account.name}`} aria-busy={saving}>
      <label htmlFor={id} className="flex w-fit items-center gap-3 text-sm">
        <input id={id} ref={inputRef} className="toggle toggle-sm toggle-success shrink-0" type="checkbox" role="switch"
          checked={isActive} onChange={onChange} disabled={disabled || saving}
          aria-label={`Active account for ${account.name}`} aria-describedby={changed ? `${id}-confirmation` : undefined} />
        <span>{isActive ? 'Active' : 'Inactive'}</span>
      </label>
      {changed && <div className="mt-3">
        <p id={`${id}-confirmation`} className="break-words text-sm leading-6">{isActive ? 'Activate' : 'Deactivate'} {account.name}?</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-error btn-outline'}`} type="submit" disabled={disabled || saving}>
            {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Saving...</>
              : <><Check size={16} aria-hidden="true" /> {isActive ? 'Activate' : 'Deactivate'}</>}
          </button>
          <button className="btn btn-ghost btn-square btn-sm" type="button" disabled={disabled || saving}
            onClick={onCancel} aria-label="Cancel status change" title="Cancel status change"><X size={17} aria-hidden="true" /></button>
        </div>
      </div>}
    </form>
  )
}

export default function UserStatusForm({ account, disabled, saving, onSave }) {
  const id = useId()
  const inputRef = useRef(null)
  const [isActive, setIsActive] = useState(account.isActive)
  function submit(event) {
    event.preventDefault()
    if (!disabled && !saving && account.role !== 'admin' && isActive !== account.isActive) onSave(account, isActive)
  }
  function cancel() {
    setIsActive(account.isActive)
    inputRef.current?.focus()
  }
  return <UserStatusFields id={id} inputRef={inputRef} account={account} isActive={isActive} disabled={disabled} saving={saving}
    onChange={(event) => setIsActive(event.target.checked)} onSubmit={submit} onCancel={cancel} />
}
