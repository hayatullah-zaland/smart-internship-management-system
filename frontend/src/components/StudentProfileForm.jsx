import { useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, RotateCcw, RotateCw, Save } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { saveStudentProfile, validateStudentProfile } from '../context/studentProfileApi'
import { fetchDepartments } from '../context/departmentApi'

const emptyProfile = { studentNumber: '', departmentId: '', semester: '', phone: '' }

export default function StudentProfileForm({ profile, departments }) {
  const { token, signOut } = useContext(AuthContext)
  const [values, setValues] = useState(profile || emptyProfile)
  const [savedValues, setSavedValues] = useState(profile || emptyProfile)
  const [availableDepartments, setAvailableDepartments] = useState(departments)
  const [refreshingDepartments, setRefreshingDepartments] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const requestRef = useRef(null)
  const departmentRequestRef = useRef(null)
  const hasDepartments = availableDepartments.length > 0
  const changed = Object.keys(emptyProfile).some((key) => String(values[key]) !== String(savedValues[key]))

  useEffect(() => () => {
    requestRef.current?.abort()
    departmentRequestRef.current?.abort()
  }, [token])

  async function refreshDepartments() {
    if (refreshingDepartments || saving) return
    const controller = new AbortController()
    departmentRequestRef.current = controller
    setRefreshingDepartments(true)
    setError('')
    try {
      const updatedDepartments = await fetchDepartments(token, controller.signal)
      // Refresh choices without resetting the student's unsaved form values.
      if (!controller.signal.aborted) setAvailableDepartments(updatedDepartments)
    } catch (err) {
      if (controller.signal.aborted) return
      if (err.status === 401) {
        signOut()
        return
      }
      let message = err.message || 'Unable to refresh departments. Please try again.'
      if (err.name === 'TypeError') message = 'Could not connect. Your edits are still here. Please try again.'
      if (err.name === 'TimeoutError' || err.name === 'AbortError') message = 'Refreshing departments took too long. Please try again.'
      setError(message)
    } finally {
      if (!controller.signal.aborted) setRefreshingDepartments(false)
    }
  }

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setError('')
    setSaved(false)
  }

  function resetChanges() {
    setValues(savedValues)
    setErrors({})
    setError('')
    setSaved(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving || refreshingDepartments || !hasDepartments) return
    const fieldErrors = validateStudentProfile(values)
    if (!availableDepartments.some((department) => department._id === values.departmentId)) {
      fieldErrors.departmentId = 'Choose an available department.'
    }
    setErrors(fieldErrors)
    setError('')
    setSaved(false)
    const firstInvalid = Object.keys(fieldErrors)[0]
    if (firstInvalid) {
      event.currentTarget.elements.namedItem(firstInvalid)?.focus()
      return
    }

    const controller = new AbortController()
    requestRef.current = controller
    setSaving(true)
    try {
      const updatedProfile = await saveStudentProfile(token, values, controller.signal)
      if (controller.signal.aborted) return
      setValues(updatedProfile)
      setSavedValues(updatedProfile)
      setSaved(true)
    } catch (err) {
      if (controller.signal.aborted) return
      if (err.status === 401) {
        signOut()
        return
      }
      let message = err.message || 'Unable to save your profile. Please try again.'
      if (err.name === 'TypeError') message = 'Could not connect. Your changes have not been confirmed. Please try again.'
      if (err.name === 'TimeoutError' || err.name === 'AbortError') message = 'Saving took too long. Please try again.'
      setError(message)
    } finally {
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="academic-heading">
      <h2 id="academic-heading" className="text-base font-semibold">Academic details</h2>
      {!hasDepartments && (
        <div className="mt-5 border-l-2 border-warning bg-warning/10 p-4">
          <p role="status" className="min-w-0 text-sm leading-6">No departments available. Please contact your administrator.</p>
        </div>
      )}
      <form className="mt-6 max-w-3xl" onSubmit={handleSubmit} noValidate aria-busy={saving}>
        <fieldset disabled={saving} className="grid min-w-0 gap-6 sm:grid-cols-2">
          <legend className="sr-only">Student profile</legend>
          <div className="min-w-0">
            <label className="mb-2 flex min-h-6 items-center text-sm font-medium" htmlFor="student-number">Student number</label>
            <input className={`input w-full ${errors.studentNumber ? 'input-error' : ''}`} id="student-number"
              name="studentNumber" type="text" required maxLength={30} placeholder="STU-001" autoComplete="off"
              value={values.studentNumber} onChange={updateField} aria-invalid={Boolean(errors.studentNumber)}
              aria-describedby={errors.studentNumber ? 'student-number-error' : undefined} />
            {errors.studentNumber && <p id="student-number-error" className="mt-2 text-xs text-error">{errors.studentNumber}</p>}
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
              <label className="text-sm font-medium" htmlFor="student-department">Department</label>
              <div className="tooltip tooltip-left" data-tip="Refresh departments">
                <button className="btn btn-ghost btn-square btn-xs" type="button" onClick={refreshDepartments}
                  disabled={saving || refreshingDepartments} aria-label="Refresh departments" title="Refresh departments">
                  {refreshingDepartments ? <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                    : <RotateCw size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <select className={`select w-full ${errors.departmentId ? 'select-error' : ''}`} id="student-department"
              name="departmentId" required value={values.departmentId} onChange={updateField}
              disabled={!hasDepartments || refreshingDepartments} aria-busy={refreshingDepartments}
              aria-invalid={Boolean(errors.departmentId)} aria-describedby={errors.departmentId ? 'department-error' : undefined}>
              <option value="">Choose a department</option>
              {values.departmentId && !availableDepartments.some((department) => department._id === values.departmentId)
                && <option value={values.departmentId} disabled>Unavailable department</option>}
              {availableDepartments.map((department) => (
                <option key={department._id} value={department._id}>{department.name} ({department.code})</option>
              ))}
            </select>
            {errors.departmentId && <p id="department-error" className="mt-2 text-xs text-error">{errors.departmentId}</p>}
          </div>
          <div className="min-w-0">
            <label className="mb-2 flex min-h-6 items-center text-sm font-medium" htmlFor="student-semester">Semester</label>
            <input className={`input w-full ${errors.semester ? 'input-error' : ''}`} id="student-semester"
              name="semester" type="number" required min={1} max={12} step={1} inputMode="numeric"
              value={values.semester} onChange={updateField} aria-invalid={Boolean(errors.semester)}
              aria-describedby={errors.semester ? 'semester-error' : undefined} />
            {errors.semester && <p id="semester-error" className="mt-2 text-xs text-error">{errors.semester}</p>}
          </div>
          <div className="min-w-0">
            <label className="mb-2 flex min-h-6 items-center text-sm font-medium" htmlFor="student-phone">Phone number</label>
            <input className={`input w-full ${errors.phone ? 'input-error' : ''}`} id="student-phone"
              name="phone" type="tel" required minLength={7} maxLength={25} autoComplete="tel" placeholder="+93 700 123 456"
              value={values.phone} onChange={updateField} aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'phone-error' : undefined} />
            {errors.phone && <p id="phone-error" className="mt-2 text-xs text-error">{errors.phone}</p>}
          </div>
        </fieldset>
        {error && <p role="alert" className="mt-6 break-words rounded-md border border-error/40 bg-error/10 p-3 text-sm leading-6 text-error">{error}</p>}
        {saved && <p role="status" className="mt-6 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" /> Profile saved successfully.
        </p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <button className="btn btn-primary min-w-36" type="submit" disabled={saving || refreshingDepartments || !hasDepartments || !changed}>
            {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Saving...</>
              : <><Save size={18} aria-hidden="true" /> Save profile</>}
          </button>
          <button className="btn btn-ghost" type="button" onClick={resetChanges} disabled={saving || !changed}>
            <RotateCcw size={17} aria-hidden="true" /> Reset changes
          </button>
        </div>
      </form>
    </section>
  )
}
