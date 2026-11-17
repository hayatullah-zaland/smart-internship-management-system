import { useId, useState } from 'react'
import { UserRoundCheck } from 'lucide-react'
import { validateCompanyRepresentative } from '../context/companyApi'

export function CompanyRepresentativeFields({ id, company, representatives, representativeId, error, unavailable, disabled, saving, onChange, onSubmit }) {
  const active = representatives.filter((person) => person.isActive && person.role === 'company_representative')
  const selected = active.find((person) => person.id === representativeId)
  const unchanged = selected && selected.id.toLowerCase() === company.representative?.toLowerCase()
  return (
    <form onSubmit={onSubmit} noValidate aria-label={`Representative for ${company.name}`} aria-busy={saving}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">{company.representative ? 'New representative' : 'Representative'}</label>
      <select id={id} name="representativeId" className={`select w-full ${error ? 'select-error' : ''}`}
        value={representativeId} required disabled={disabled || saving || unavailable || !active.length} onChange={onChange}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
        <option value="" disabled>Choose a representative</option>
        {representativeId && !selected && <option value={representativeId} disabled>Representative unavailable</option>}
        {active.map((person) => <option value={person.id} key={person.id}>{person.name} ({person.email})</option>)}
      </select>
      {error && <p id={`${id}-error`} className="mt-2 text-xs text-error">{error}</p>}
      {!unavailable && !active.length && <p className="mt-2 text-xs text-base-content/70">No active company representatives available.</p>}
      {company.representative && selected && !unchanged && <p className="mt-2 text-sm leading-6 text-warning">This replaces the current representative.</p>}
      <button className="btn btn-outline btn-sm mt-3" type="submit" disabled={disabled || saving || unavailable || !selected || Boolean(unchanged)}>
        {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Saving...</>
          : <><UserRoundCheck size={16} aria-hidden="true" /> {company.representative ? 'Replace representative' : 'Assign representative'}</>}
      </button>
    </form>
  )
}

export default function CompanyRepresentativeForm({ company, representatives, unavailable, disabled, saving, onSave }) {
  const id = useId()
  const [representativeId, setRepresentativeId] = useState('')
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault()
    if (disabled || saving || unavailable) return
    const selected = representatives.find((person) => person.id === representativeId)
    const errors = validateCompanyRepresentative(company, selected)
    setError(errors.representativeId || '')
    if (errors.representativeId) return event.currentTarget.elements.namedItem('representativeId')?.focus()
    onSave(company, selected)
  }
  return <CompanyRepresentativeFields id={id} company={company} representatives={representatives} representativeId={representativeId}
    error={error} unavailable={unavailable} disabled={disabled} saving={saving} onSubmit={submit}
    onChange={(event) => { setRepresentativeId(event.target.value); setError('') }} />
}
