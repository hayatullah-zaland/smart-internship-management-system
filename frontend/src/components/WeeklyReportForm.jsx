import { Save, X } from 'lucide-react'
import { getStartedWeekCount, getWeeklyReportDates } from '../context/weeklyReportApi'

const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit' })

export default function WeeklyReportForm({ values, errors, internships, editing, loading, optionsError, saving, disabled, onChange, onSubmit, onCancel }) {
  const selected = editing?.internship || internships.find((item) => item._id === values.internshipId)
  const weekCount = getStartedWeekCount(selected)
  const dates = getWeeklyReportDates(selected, values.weekNumber)
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="weekly-form-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="weekly-form-heading" className="text-base font-semibold">{editing ? 'Edit weekly report' : 'New weekly report'}</h2>
        {editing && <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel} disabled={saving}>
          <X size={16} aria-hidden="true" /> Cancel edit
        </button>}
      </div>
      {!editing && loading && <p role="status" className="mt-4 text-sm text-base-content/70">Loading active internships...</p>}
      {!editing && optionsError && <p role="alert" className="mt-4 break-words text-sm text-error">{optionsError}</p>}
      {!editing && !loading && !optionsError && !internships.length && <p role="status" className="mt-4 text-sm text-base-content/70">No active internships available.</p>}
      {selected && !weekCount && <p role="status" className="mt-4 text-sm text-base-content/70">No started weeks available for this internship.</p>}
      <form className="mt-5 max-w-3xl" onSubmit={onSubmit} aria-label={editing ? 'Edit weekly report' : 'New weekly report'} aria-busy={saving} noValidate>
        <fieldset className="grid min-w-0 gap-5 sm:grid-cols-2" disabled={disabled || saving}>
          <legend className="sr-only">Weekly report details</legend>
          {!editing && <div className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="weekly-internshipId">Internship</label>
            <select id="weekly-internshipId" name="internshipId" className={`select w-full ${errors.internshipId ? 'select-error' : ''}`}
              value={values.internshipId} onChange={onChange} required disabled={loading || Boolean(optionsError) || !internships.length}
              aria-invalid={Boolean(errors.internshipId)} aria-describedby={errors.internshipId ? 'weekly-internshipId-error' : undefined}>
              <option value="" disabled>Choose an active internship</option>
              {values.internshipId && !internships.some((item) => item._id === values.internshipId)
                && <option value={values.internshipId} disabled>Internship no longer available</option>}
              {internships.map((item) => <option key={item._id} value={item._id}>
                {item.opportunity?.title || 'Internship'} - {item.company?.name || 'Company unavailable'} ({item.startDate.slice(0, 10)} to {item.endDate.slice(0, 10)})
              </option>)}
            </select>
            {errors.internshipId && <p id="weekly-internshipId-error" className="mt-2 text-xs text-error">{errors.internshipId}</p>}
          </div>}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium" htmlFor="weekly-weekNumber">Week number</label>
            <input id="weekly-weekNumber" name="weekNumber" type="number" min={1} max={selected ? weekCount : 10000} step={1} required readOnly={Boolean(editing)} disabled={Boolean(selected && !weekCount)}
              className={`input w-full min-w-0 ${errors.weekNumber ? 'input-error' : ''}`} value={values.weekNumber} onChange={onChange}
              aria-invalid={Boolean(errors.weekNumber)} aria-describedby={errors.weekNumber ? 'weekly-weekNumber-error' : undefined} />
            {errors.weekNumber && <p id="weekly-weekNumber-error" className="mt-2 text-xs text-error">{errors.weekNumber}</p>}
          </div>
          {dates && <dl className="min-w-0 text-sm"><dt className="mb-2 font-medium">Week dates</dt>
            <dd className="break-words leading-6"><time dateTime={dates.weekStart.slice(0, 10)}>{dateFormatter.format(new Date(dates.weekStart))}</time>
              {' to '}<time dateTime={dates.weekEnd.slice(0, 10)}>{dateFormatter.format(new Date(dates.weekEnd))}</time></dd>
          </dl>}
          {[['summary', 'Weekly summary', 5000], ['learning', 'What I learned', 3000], ['challenges', 'Challenges (optional)', 2000]].map(([name, label, max]) => <div key={name} className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor={`weekly-${name}`}>{label}</label>
            <textarea id={`weekly-${name}`} name={name} rows={name === 'summary' ? 4 : 3} maxLength={max} required={name !== 'challenges'}
              className={`textarea w-full min-w-0 leading-6 ${errors[name] ? 'textarea-error' : ''}`} value={values[name]} onChange={onChange}
              aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `weekly-${name}-error` : undefined} />
            {errors[name] && <p id={`weekly-${name}-error`} className="mt-2 text-xs text-error">{errors[name]}</p>}
          </div>)}
        </fieldset>
        <button className="btn btn-primary mt-6 min-w-40" type="submit" disabled={disabled || saving || Boolean(selected && !weekCount)}>
          {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Saving...</>
            : <><Save size={17} aria-hidden="true" /> {editing ? 'Save changes' : 'Save draft'}</>}
        </button>
      </form>
    </section>
  )
}
