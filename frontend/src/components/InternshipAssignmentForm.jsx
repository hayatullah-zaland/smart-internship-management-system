import { useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Plus, RotateCw } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { createInternship, fetchAcademicSupervisors, fetchApprovedApplications, validateInternshipAssignment } from '../context/internshipApi'

const emptyValues = { applicationId: '', supervisorId: '', startDate: '', endDate: '' }

export function InternshipAssignmentFields({ values, errors, applications, supervisors, loadingOptions, optionsError, saving, onChange, onSubmit }) {
  const unavailable = loadingOptions || Boolean(optionsError)
  return (
    <form className="mt-5 max-w-3xl" onSubmit={onSubmit} noValidate aria-label="Assign internship" aria-busy={saving}>
      <fieldset disabled={saving} className="grid min-w-0 gap-5 sm:grid-cols-2">
        <legend className="sr-only">Internship assignment details</legend>
        <div className="min-w-0 sm:col-span-2">
          <label className="mb-2 block text-sm font-medium" htmlFor="assignment-application">Approved application</label>
          <select id="assignment-application" name="applicationId" className={`select w-full ${errors.applicationId ? 'select-error' : ''}`}
            value={values.applicationId} onChange={onChange} required disabled={unavailable || !applications.length}
            aria-invalid={Boolean(errors.applicationId)} aria-describedby={errors.applicationId ? 'assignment-application-error' : undefined}>
            <option value="" disabled>Choose an application</option>
            {values.applicationId && !applications.some((item) => item._id === values.applicationId)
              && <option value={values.applicationId} disabled>Unavailable application</option>}
            {applications.map((item) => <option key={item._id} value={item._id}>
              {item.student.name} ({item.student.email}) - {item.opportunity.title} - {item.opportunity.company.name}
            </option>)}
          </select>
          {errors.applicationId && <p id="assignment-application-error" className="mt-2 text-xs text-error">{errors.applicationId}</p>}
          {!unavailable && !applications.length && <p className="mt-2 text-xs text-base-content/70">No approved applications available.</p>}
        </div>
        <div className="min-w-0 sm:col-span-2">
          <label className="mb-2 block text-sm font-medium" htmlFor="assignment-supervisor">Academic supervisor</label>
          <select id="assignment-supervisor" name="supervisorId" className={`select w-full ${errors.supervisorId ? 'select-error' : ''}`}
            value={values.supervisorId} onChange={onChange} required disabled={unavailable || !supervisors.length}
            aria-invalid={Boolean(errors.supervisorId)} aria-describedby={errors.supervisorId ? 'assignment-supervisor-error' : undefined}>
            <option value="" disabled>Choose a supervisor</option>
            {values.supervisorId && !supervisors.some((item) => item._id === values.supervisorId)
              && <option value={values.supervisorId} disabled>Unavailable supervisor</option>}
            {supervisors.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.email})</option>)}
          </select>
          {errors.supervisorId && <p id="assignment-supervisor-error" className="mt-2 text-xs text-error">{errors.supervisorId}</p>}
          {!unavailable && !supervisors.length && <p className="mt-2 text-xs text-base-content/70">No active academic supervisors available.</p>}
        </div>
        {['startDate', 'endDate'].map((name) => <div key={name} className="min-w-0">
          <label className="mb-2 block text-sm font-medium" htmlFor={`assignment-${name}`}>{name === 'startDate' ? 'Start date' : 'End date'}</label>
          <input id={`assignment-${name}`} name={name} type="date" required className={`input w-full min-w-0 ${errors[name] ? 'input-error' : ''}`}
            value={values[name]} onChange={onChange} aria-invalid={Boolean(errors[name])}
            aria-describedby={errors[name] ? `assignment-${name}-error` : undefined} />
          {errors[name] && <p id={`assignment-${name}-error`} className="mt-2 text-xs text-error">{errors[name]}</p>}
        </div>)}
      </fieldset>
      <button className="btn btn-primary mt-6 min-w-44" type="submit" disabled={saving || unavailable || !applications.length || !supervisors.length}>
        {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Assigning...</>
          : <><Plus size={17} aria-hidden="true" /> Assign internship</>}
      </button>
    </form>
  )
}

export default function InternshipAssignmentForm({ onAssigned }) {
  const { user, token, signOut } = useContext(AuthContext)
  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [assigned, setAssigned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)
  const [options, setOptions] = useState({ key: null, applications: [], supervisors: [], error: '' })
  const requestRef = useRef(null)
  const optionsKey = `${token}:${refreshCount}`
  const loadingOptions = options.key !== optionsKey

  useEffect(() => () => requestRef.current?.abort(), [token])
  useEffect(() => {
    if (user.role !== 'admin') return
    const controller = new AbortController()
    async function loadOptions() {
      try {
        const [applications, supervisors] = await Promise.all([
          fetchApprovedApplications(token, controller.signal), fetchAcademicSupervisors(token, controller.signal),
        ])
        if (!controller.signal.aborted) setOptions({ key: optionsKey, applications, supervisors, error: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) {
          signOut()
          return
        }
        setOptions({ key: optionsKey, applications: [], supervisors: [], error: 'Unable to load assignment choices. Refresh choices to try again.' })
      }
    }
    loadOptions()
    return () => controller.abort()
  }, [user.role, token, optionsKey, signOut])

  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
    setAssigned(false)
  }

  async function submit(event) {
    event.preventDefault()
    if (user.role !== 'admin' || requestRef.current || saving || loadingOptions || options.error) return
    const fieldErrors = validateInternshipAssignment(values)
    if (!options.applications.some((item) => item._id === values.applicationId)) fieldErrors.applicationId = 'Choose an available approved application.'
    if (!options.supervisors.some((item) => item._id === values.supervisorId)) fieldErrors.supervisorId = 'Choose an available academic supervisor.'
    setErrors(fieldErrors)
    setMessage('')
    setAssigned(false)
    const firstInvalid = Object.keys(fieldErrors)[0]
    if (firstInvalid) {
      event.currentTarget.elements.namedItem(firstInvalid)?.focus()
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    setSaving(true)
    try {
      await createInternship(token, values, controller.signal)
      if (controller.signal.aborted) return
      setAssigned(true)
      setValues(emptyValues)
      onAssigned()
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) {
        signOut()
        return
      }
      setMessage(!error.status || error.status >= 500
        ? 'Assignment could not be confirmed. Refresh the internship list before trying again.'
        : error.message || 'Unable to assign this internship.')
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  if (user.role !== 'admin') return null
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="assignment-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="assignment-heading" className="text-base font-semibold">Assign internship</h2>
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => setRefreshCount((count) => count + 1)}
          disabled={saving || loadingOptions} title="Refresh assignment choices" aria-label="Refresh assignment choices">
          <RotateCw size={17} aria-hidden="true" />
        </button>
      </div>
      {loadingOptions && <p role="status" className="mt-4 text-sm text-base-content/70">Loading assignment choices...</p>}
      {!loadingOptions && options.error && <p role="alert" className="mt-4 text-sm leading-6 text-error">{options.error}</p>}
      <InternshipAssignmentFields values={values} errors={errors} applications={options.applications} supervisors={options.supervisors}
        loadingOptions={loadingOptions} optionsError={options.error} saving={saving} onChange={changeField} onSubmit={submit} />
      {message && <p role="alert" className="mt-4 break-words text-sm leading-6 text-error">{message}</p>}
      {assigned && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-success">
        <CheckCircle2 size={17} aria-hidden="true" /> Internship assigned successfully.
      </p>}
    </section>
  )
}
