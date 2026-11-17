import { useId, useState } from 'react'
import { Check, ChevronDown, ClipboardCheck } from 'lucide-react'
import { validateApplicationReview } from '../context/applicationApi'

export function ApplicationReviewFields({ id, currentStatus, values, errors, disabled, saving, onChange, onSubmit }) {
  return (
    <form className="mt-5 max-w-2xl" onSubmit={onSubmit} noValidate aria-label="Application decision" aria-busy={saving}>
      <fieldset disabled={disabled || saving} className="min-w-0 space-y-5">
        <legend className="sr-only">Review decision</legend>
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor={`${id}-decision`}>Decision</label>
          <select id={`${id}-decision`} name="status" className={`select w-full ${errors.status ? 'select-error' : ''}`}
            value={values.status} onChange={onChange} required aria-invalid={Boolean(errors.status)}
            aria-describedby={errors.status ? `${id}-decision-error` : undefined}>
            <option value="" disabled>Choose a decision</option>
            {currentStatus === 'pending' && <option value="under_review">Under review</option>}
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {errors.status && <p id={`${id}-decision-error`} className="mt-2 text-xs text-error">{errors.status}</p>}
        </div>
        {values.status === 'rejected' && <div>
          <label className="mb-2 block text-sm font-medium" htmlFor={`${id}-reason`}>Rejection reason</label>
          <textarea id={`${id}-reason`} name="rejectionReason" className={`textarea min-h-28 w-full ${errors.rejectionReason ? 'textarea-error' : ''}`}
            rows={4} maxLength={1000} required value={values.rejectionReason} onChange={onChange}
            aria-invalid={Boolean(errors.rejectionReason)} aria-describedby={errors.rejectionReason ? `${id}-reason-error` : undefined} />
          {errors.rejectionReason && <p id={`${id}-reason-error`} className="mt-2 text-xs text-error">{errors.rejectionReason}</p>}
        </div>}
        <button className="btn btn-primary min-w-40" type="submit" disabled={disabled || saving}>
          {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Saving...</>
            : <><Check size={17} aria-hidden="true" /> Save decision</>}
        </button>
      </fieldset>
    </form>
  )
}

export default function ApplicationReviewForm({ application, disabled, saving, onReview }) {
  const id = useId()
  const [values, setValues] = useState({ status: '', rejectionReason: '' })
  const [errors, setErrors] = useState({})

  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  function submit(event) {
    event.preventDefault()
    if (disabled || saving) return
    const fieldErrors = validateApplicationReview(values)
    setErrors(fieldErrors)
    const firstInvalid = Object.keys(fieldErrors)[0]
    if (firstInvalid) {
      event.currentTarget.elements.namedItem(firstInvalid)?.focus()
      return
    }
    onReview(application._id, values)
  }

  if (!['pending', 'under_review'].includes(application.status)) return null
  return (
    <details className="group mt-5 border-t border-base-300 pt-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <ClipboardCheck size={17} aria-hidden="true" /> Review application
        <ChevronDown size={16} className="ml-auto shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <ApplicationReviewFields id={id} currentStatus={application.status} values={values} errors={errors}
        disabled={disabled} saving={saving} onChange={changeField} onSubmit={submit} />
    </details>
  )
}
