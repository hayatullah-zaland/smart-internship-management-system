import { useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { createDepartment, validateDepartment } from '../context/departmentApi'

export default function DepartmentForm({ onCreated }) {
  const { token, signOut } = useContext(AuthContext)
  const [values, setValues] = useState({ name: '', code: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [saving, setSaving] = useState(false)
  const requestRef = useRef(null)

  useEffect(() => () => requestRef.current?.abort(), [token])

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: name === 'code' ? value.toUpperCase() : value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setError('')
    setCreated(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return
    const fieldErrors = validateDepartment(values)
    setErrors(fieldErrors)
    setError('')
    setCreated(null)
    const firstInvalid = Object.keys(fieldErrors)[0]
    if (firstInvalid) {
      event.currentTarget.elements.namedItem(firstInvalid)?.focus()
      return
    }

    const controller = new AbortController()
    requestRef.current = controller
    setSaving(true)
    try {
      const department = await createDepartment(token, values, controller.signal)
      if (controller.signal.aborted) return
      setValues({ name: '', code: '' })
      setCreated(department)
      onCreated()
    } catch (err) {
      if (controller.signal.aborted) return
      if (err.status === 401) {
        signOut()
        return
      }
      let message = err.message || 'Unable to add this department. Please try again.'
      if (err.name === 'TypeError' || err.name === 'TimeoutError' || err.name === 'AbortError') {
        message = 'The request could not be confirmed. Refresh the department list before trying again.'
      }
      setError(message)
    } finally {
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="new-department-heading">
      <h2 id="new-department-heading" className="text-base font-semibold">New department</h2>
      <form className="mt-6 max-w-3xl" onSubmit={handleSubmit} noValidate aria-busy={saving}>
        <fieldset disabled={saving} className="grid min-w-0 gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <legend className="sr-only">Department details</legend>
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium" htmlFor="department-name">Department name</label>
            <input className={`input w-full ${errors.name ? 'input-error' : ''}`} id="department-name" name="name"
              type="text" required minLength={2} maxLength={100} autoComplete="off" placeholder="Computer Science"
              value={values.name} onChange={updateField} aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'department-name-error' : undefined} />
            {errors.name && <p id="department-name-error" className="mt-2 text-xs text-error">{errors.name}</p>}
          </div>
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium" htmlFor="department-code">Code</label>
            <input className={`input w-full ${errors.code ? 'input-error' : ''}`} id="department-code" name="code"
              type="text" required maxLength={20} autoComplete="off" placeholder="CS"
              value={values.code} onChange={updateField} aria-invalid={Boolean(errors.code)}
              aria-describedby={errors.code ? 'department-code-error' : undefined} />
            {errors.code && <p id="department-code-error" className="mt-2 text-xs text-error">{errors.code}</p>}
          </div>
        </fieldset>
        {error && <p role="alert" className="mt-5 break-words rounded-md border border-error/40 bg-error/10 p-3 text-sm leading-6 text-error">{error}</p>}
        {created && <p role="status" className="mt-5 flex items-start gap-2 text-sm leading-6 text-success">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{created.name} ({created.code}) created successfully.</span>
        </p>}
        <button className="btn btn-primary mt-6 min-w-44" type="submit" disabled={saving}>
          {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Adding...</>
            : <><Plus size={18} aria-hidden="true" /> Add department</>}
        </button>
      </form>
    </section>
  )
}
