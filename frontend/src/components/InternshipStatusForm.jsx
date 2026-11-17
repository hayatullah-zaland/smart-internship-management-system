import { useId, useState } from 'react'
import { Check, ChevronDown, ClipboardCheck } from 'lucide-react'
import { INTERNSHIP_STATUS_TRANSITIONS, validateInternshipStatus } from '../context/internshipApi'

const labels = { active: 'Active', completed: 'Completed', cancelled: 'Cancelled' }

export function InternshipStatusFields({ id, currentStatus, values, errors, disabled, saving, onChange, onSubmit }) {
  const transitions = INTERNSHIP_STATUS_TRANSITIONS[currentStatus]
  return (
    <form className="mt-5 max-w-2xl" onSubmit={onSubmit} noValidate aria-label="Internship status change" aria-busy={saving}>
      <fieldset disabled={disabled || saving} className="min-w-0 space-y-5">
        <legend className="sr-only">Status change details</legend>
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor={`${id}-status`}>New status</label>
          <select id={`${id}-status`} name="status" className={`select w-full ${errors.status ? 'select-error' : ''}`}
            value={values.status} onChange={onChange} required aria-invalid={Boolean(errors.status)}
            aria-describedby={errors.status ? `${id}-status-error` : undefined}>
            <option value="" disabled>Choose a status</option>
            {(Array.isArray(transitions) ? transitions : []).map((status) => <option key={status} value={status}>{labels[status]}</option>)}
          </select>
          {errors.status && <p id={`${id}-status-error`} className="mt-2 text-xs text-error">{errors.status}</p>}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor={`${id}-reason`}>{values.status === 'cancelled' ? 'Cancellation reason' : 'Reason (optional)'}</label>
          <textarea id={`${id}-reason`} name="reason" className={`textarea min-h-28 w-full ${errors.reason ? 'textarea-error' : ''}`}
            rows={4} maxLength={1000} required={values.status === 'cancelled'} value={values.reason} onChange={onChange}
            aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? `${id}-reason-error` : undefined} />
          {errors.reason && <p id={`${id}-reason-error`} className="mt-2 text-xs text-error">{errors.reason}</p>}
        </div>
        <button className="btn btn-primary min-w-40" type="submit" disabled={disabled || saving}>
          {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Saving...</>
            : <><Check size={17} aria-hidden="true" /> Save status</>}
        </button>
      </fieldset>
    </form>
  )
}

export default function InternshipStatusForm({ internship, disabled, saving, onSave }) {
  const id = useId()
  const [values, setValues] = useState({ status: '', reason: '' })
  const [errors, setErrors] = useState({})
  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }
  function submit(event) {
    event.preventDefault()
    if (disabled || saving) return
    const fieldErrors = validateInternshipStatus(internship.status, values)
    setErrors(fieldErrors)
    const firstInvalid = Object.keys(fieldErrors)[0]
    if (firstInvalid) {
      event.currentTarget.elements.namedItem(firstInvalid)?.focus()
      return
    }
    onSave(internship, values)
  }
  if (!Array.isArray(INTERNSHIP_STATUS_TRANSITIONS[internship.status])) return null
  return (
    <details className="group mt-5 border-t border-base-300 pt-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <ClipboardCheck size={17} aria-hidden="true" /> Update status
        <ChevronDown size={16} className="ml-auto shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <InternshipStatusFields id={id} currentStatus={internship.status} values={values} errors={errors}
        disabled={disabled} saving={saving} onChange={changeField} onSubmit={submit} />
    </details>
  )
}
