import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import { validateDailyReportReview } from '../context/dailyReportApi'

export function DailyReportReviewFields({ id, values, errors, disabled, saving, onChange, onSubmit }) {
  return (
    <form className="mt-4 max-w-2xl" onSubmit={onSubmit} aria-label="Daily report review" aria-busy={saving} noValidate>
      <fieldset disabled={disabled || saving} className="min-w-0 space-y-5">
        <legend className="sr-only">Report review decision</legend>
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor={`${id}-status`}>Decision</label>
          <select id={`${id}-status`} name="status" className={`select w-full ${errors.status ? 'select-error' : ''}`}
            value={values.status} onChange={onChange} required aria-invalid={Boolean(errors.status)}
            aria-describedby={errors.status ? `${id}-status-error` : undefined}>
            <option value="" disabled>Choose a decision</option>
            <option value="approved">Approve report</option>
            <option value="changes_requested">Request changes</option>
          </select>
          {errors.status && <p id={`${id}-status-error`} className="mt-2 text-xs text-error">{errors.status}</p>}
        </div>
        {values.status === 'changes_requested' && <div>
          <label className="mb-2 block text-sm font-medium" htmlFor={`${id}-feedback`}>Feedback</label>
          <textarea id={`${id}-feedback`} name="feedback" rows={4} maxLength={1000} required
            className={`textarea w-full min-w-0 leading-6 ${errors.feedback ? 'textarea-error' : ''}`} value={values.feedback} onChange={onChange}
            aria-invalid={Boolean(errors.feedback)} aria-describedby={errors.feedback ? `${id}-feedback-error` : undefined} />
          {errors.feedback && <p id={`${id}-feedback-error`} className="mt-2 text-xs text-error">{errors.feedback}</p>}
        </div>}
        <button className="btn btn-primary min-w-40" type="submit" disabled={disabled || saving}>
          {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Saving...</>
            : <><Check size={17} aria-hidden="true" /> Save review</>}
        </button>
      </fieldset>
    </form>
  )
}

export default function DailyReportReviewForm({ report, disabled = false, saving = false, onReview }) {
  const id = useId()
  const [values, setValues] = useState({ status: '', feedback: '' })
  const [errors, setErrors] = useState({})

  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }
  function submit(event) {
    event.preventDefault()
    if (disabled || saving || report.status !== 'submitted') return
    const fieldErrors = validateDailyReportReview(values)
    setErrors(fieldErrors)
    const first = Object.keys(fieldErrors)[0]
    if (first) return event.currentTarget.elements.namedItem(first)?.focus()
    onReview(report, values)
  }

  if (report.status !== 'submitted') return null
  return (
    <section className="mt-5 border-t border-base-300 pt-5" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`} className="text-sm font-semibold">Review report</h3>
      <DailyReportReviewFields id={id} values={values} errors={errors} disabled={disabled} saving={saving} onChange={changeField} onSubmit={submit} />
    </section>
  )
}
