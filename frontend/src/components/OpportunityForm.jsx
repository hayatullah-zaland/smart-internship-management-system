import { Send } from 'lucide-react'

export default function OpportunityForm({ values, errors, disabled, saving, onChange, onSubmit }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="new-opportunity-heading">
      <h2 id="new-opportunity-heading" className="text-base font-semibold">New opportunity</h2>
      <form className="mt-6 max-w-3xl" onSubmit={onSubmit} noValidate aria-busy={saving}>
        <fieldset className="grid min-w-0 gap-6 sm:grid-cols-2" disabled={disabled || saving}>
          <legend className="sr-only">Opportunity details</legend>
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="opportunity-companyId">Company ID</label>
            <input id="opportunity-companyId" name="companyId" type="text" required minLength={24} maxLength={24}
              className={`input w-full min-w-0 font-mono text-sm ${errors.companyId ? 'input-error' : ''}`} autoComplete="off" autoCapitalize="none" spellCheck={false}
              value={values.companyId} onChange={onChange} aria-invalid={Boolean(errors.companyId)}
              aria-describedby={errors.companyId ? 'opportunity-companyId-error' : undefined} />
            {errors.companyId && <p id="opportunity-companyId-error" className="mt-2 text-xs text-error">{errors.companyId}</p>}
          </div>
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="opportunity-title">Title</label>
            <input id="opportunity-title" name="title" type="text" required minLength={2} maxLength={150}
              className={`input w-full ${errors.title ? 'input-error' : ''}`} value={values.title} onChange={onChange}
              aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'opportunity-title-error' : undefined} />
            {errors.title && <p id="opportunity-title-error" className="mt-2 text-xs text-error">{errors.title}</p>}
          </div>
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="opportunity-description">Description</label>
            <textarea id="opportunity-description" name="description" rows={5} maxLength={5000} required
              className={`textarea w-full leading-6 ${errors.description ? 'textarea-error' : ''}`} value={values.description} onChange={onChange}
              aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'opportunity-description-error' : undefined} />
            {errors.description && <p id="opportunity-description-error" className="mt-2 text-xs text-error">{errors.description}</p>}
          </div>
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium" htmlFor="opportunity-deadline">Deadline (Kabul, UTC+04:30)</label>
            <input id="opportunity-deadline" name="deadline" type="datetime-local" step={60} max="9999-12-31T23:59" required
              className={`input w-full min-w-0 ${errors.deadline ? 'input-error' : ''}`} value={values.deadline} onChange={onChange}
              aria-invalid={Boolean(errors.deadline)} aria-describedby={errors.deadline ? 'opportunity-deadline-error' : undefined} />
            {errors.deadline && <p id="opportunity-deadline-error" className="mt-2 text-xs text-error">{errors.deadline}</p>}
          </div>
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium" htmlFor="opportunity-capacity">Capacity</label>
            <input id="opportunity-capacity" name="capacity" type="number" inputMode="numeric" min={1} max={1000} step={1} required
              className={`input w-full min-w-0 ${errors.capacity ? 'input-error' : ''}`} value={values.capacity} onChange={onChange}
              aria-invalid={Boolean(errors.capacity)} aria-describedby={errors.capacity ? 'opportunity-capacity-error' : undefined} />
            {errors.capacity && <p id="opportunity-capacity-error" className="mt-2 text-xs text-error">{errors.capacity}</p>}
          </div>
        </fieldset>
        <button className="btn btn-primary mt-6 min-w-44" type="submit" disabled={disabled || saving}>
          {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Publishing...</>
            : <><Send size={17} aria-hidden="true" /> Publish opportunity</>}
        </button>
      </form>
    </section>
  )
}
