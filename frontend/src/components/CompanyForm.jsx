import { Building2 } from 'lucide-react'

export default function CompanyForm({ values, errors, disabled, saving, onChange, onSubmit }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="new-company-heading">
      <h2 id="new-company-heading" className="flex scroll-mt-44 items-center gap-2.5 text-base font-semibold"><Building2 size={20} className="text-primary" aria-hidden="true" /> New company</h2>
      <form className="mt-6 max-w-3xl" onSubmit={onSubmit} noValidate aria-busy={saving}>
        <fieldset className="grid min-w-0 gap-6 sm:grid-cols-2" disabled={disabled || saving}>
          <legend className="sr-only">Company details</legend>
          {['name', 'contactEmail'].map((name) => <div key={name} className="min-w-0">
            <label className="mb-2 block text-sm font-medium" htmlFor={`company-${name}`}>{name === 'name' ? 'Company name' : 'Contact email'}</label>
            <input id={`company-${name}`} name={name} type={name === 'contactEmail' ? 'email' : 'text'}
              className={`input h-11 w-full bg-base-100 ${errors[name] ? 'input-error' : ''}`} autoComplete="off" required
              minLength={name === 'name' ? 2 : undefined} maxLength={name === 'name' ? 150 : 254}
              value={values[name]} onChange={onChange} aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `company-${name}-error` : undefined} />
            {errors[name] && <p id={`company-${name}-error`} className="mt-2 text-xs text-error">{errors[name]}</p>}
          </div>)}
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="company-address">Address</label>
            <textarea id="company-address" name="address" rows={3} maxLength={300} required
              className={`textarea w-full bg-base-100 ${errors.address ? 'textarea-error' : ''}`} value={values.address} onChange={onChange}
              aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'company-address-error' : undefined} />
            {errors.address && <p id="company-address-error" className="mt-2 text-xs text-error">{errors.address}</p>}
          </div>
        </fieldset>
        <button className="btn btn-primary mt-6 min-w-44" type="submit" disabled={disabled || saving}>
          {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Creating...</>
            : <><Building2 size={18} aria-hidden="true" /> Create company</>}
        </button>
      </form>
    </section>
  )
}
