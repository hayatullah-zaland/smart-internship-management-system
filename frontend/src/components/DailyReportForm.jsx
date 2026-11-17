import { Save, X } from 'lucide-react'

export default function DailyReportForm({ values, errors, internships, editing, loading, optionsError, saving, disabled, onChange, onSubmit, onCancel }) {
  const selected = editing?.internship || internships.find((item) => item._id === values.internshipId)
  const today = new Date().toISOString().slice(0, 10)
  const maxDate = selected?.endDate?.slice(0, 10) < today ? selected.endDate.slice(0, 10) : today
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="report-form-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="report-form-heading" className="text-base font-semibold">{editing ? 'Edit daily report' : 'New daily report'}</h2>
        {editing && <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel} disabled={saving}>
          <X size={16} aria-hidden="true" /> Cancel edit
        </button>}
      </div>
      {!editing && loading && <p role="status" className="mt-4 text-sm text-base-content/70">Loading active internships...</p>}
      {!editing && optionsError && <p role="alert" className="mt-4 break-words text-sm text-error">{optionsError}</p>}
      {!editing && !loading && !optionsError && !internships.length && <p role="status" className="mt-4 text-sm text-base-content/70">No active internships available.</p>}
      <form className="mt-5 max-w-3xl" aria-label={editing ? 'Edit daily report' : 'New daily report'} aria-busy={saving} onSubmit={onSubmit} noValidate>
        <fieldset className="grid min-w-0 gap-5 sm:grid-cols-2" disabled={disabled || saving}>
          <legend className="sr-only">Daily report details</legend>
          {!editing && <div className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="report-internshipId">Internship</label>
            <select id="report-internshipId" name="internshipId" className={`select w-full ${errors.internshipId ? 'select-error' : ''}`}
              value={values.internshipId} onChange={onChange} required disabled={loading || Boolean(optionsError) || !internships.length}
              aria-invalid={Boolean(errors.internshipId)} aria-describedby={errors.internshipId ? 'report-internshipId-error' : undefined}>
              <option value="" disabled>Choose an active internship</option>
              {values.internshipId && !internships.some((item) => item._id === values.internshipId)
                && <option value={values.internshipId} disabled>Internship no longer available</option>}
              {internships.map((item) => <option key={item._id} value={item._id}>
                {item.opportunity?.title || 'Internship'} - {item.company?.name || 'Company unavailable'} ({item.startDate.slice(0, 10)} to {item.endDate.slice(0, 10)})
              </option>)}
            </select>
            {errors.internshipId && <p id="report-internshipId-error" className="mt-2 text-xs text-error">{errors.internshipId}</p>}
          </div>}
          {['date', 'hours'].map((name) => <div key={name} className="min-w-0">
            <label className="mb-2 block text-sm font-medium" htmlFor={`report-${name}`}>{name === 'date' ? 'Report date' : 'Hours worked'}</label>
            <input id={`report-${name}`} name={name} type={name === 'date' ? 'date' : 'number'} className={`input w-full min-w-0 ${errors[name] ? 'input-error' : ''}`}
              value={values[name]} onChange={onChange} required readOnly={name === 'date' && Boolean(editing)}
              min={name === 'date' ? selected?.startDate?.slice(0, 10) : 0.25} max={name === 'date' ? maxDate : 24} step={name === 'hours' ? 'any' : undefined}
              aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `report-${name}-error` : undefined} />
            {errors[name] && <p id={`report-${name}-error`} className="mt-2 text-xs text-error">{errors[name]}</p>}
          </div>)}
          {[['tasks', 'Tasks completed', 5000], ['learning', 'What I learned', 3000], ['challenges', 'Challenges (optional)', 2000]].map(([name, label, max]) => <div key={name} className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor={`report-${name}`}>{label}</label>
            <textarea id={`report-${name}`} name={name} rows={name === 'tasks' ? 4 : 3} maxLength={max} required={name !== 'challenges'}
              className={`textarea w-full min-w-0 leading-6 ${errors[name] ? 'textarea-error' : ''}`} value={values[name]} onChange={onChange}
              aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `report-${name}-error` : undefined} />
            {errors[name] && <p id={`report-${name}-error`} className="mt-2 text-xs text-error">{errors[name]}</p>}
          </div>)}
        </fieldset>
        <button className="btn btn-primary mt-6 min-w-40" type="submit" disabled={disabled || saving}>
          {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Saving...</>
            : <><Save size={17} aria-hidden="true" /> {editing ? 'Save changes' : 'Save draft'}</>}
        </button>
      </form>
    </section>
  )
}
