import { useContext, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { fetchReportInternships } from '../context/dailyReportApi'
import { canEditWeeklyReport, fetchWeeklyReports, MAX_WEEKLY_REPORT_PAGE, saveWeeklyReport, submitWeeklyReport, validateWeeklyReport } from '../context/weeklyReportApi'
import DashboardLayout from '../components/DashboardLayout'
import WeeklyReportForm from '../components/WeeklyReportForm'
import WeeklyReportList from '../components/WeeklyReportList'

const emptyValues = { internshipId: '', weekNumber: '', summary: '', learning: '', challenges: '' }

export default function WeeklyReports() {
  const { user, token } = useContext(AuthContext)
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(requested) && requested >= 1 && requested <= MAX_WEEKLY_REPORT_PAGE ? requested : 1
  return <WeeklyReportsWorkspace key={`${user.id}:${token}:${page}`} page={page}
    onPageChange={(next) => setParams(next === 1 ? {} : { page: String(next) })} />
}

export function WeeklyReportsWorkspace({ page, onPageChange }) {
  const { user, token, signOut } = useContext(AuthContext)
  const student = user.role === 'student'
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState({ key: null, reports: [], hasNextPage: false, error: '' })
  const [choices, setChoices] = useState({ key: null, internships: [], error: '' })
  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [write, setWrite] = useState({ action: '', id: null, message: '', error: false, needsRefresh: false })
  const requestRef = useRef(null)
  const formRef = useRef(null)
  const loading = result.key !== refresh
  const loadingChoices = choices.key !== refresh
  const busy = Boolean(write.action)
  const editing = editingId ? result.reports.find((report) => report._id === editingId) : null
  const internship = editing?.internship || choices.internships.find((item) => item._id === values.internshipId)
  const blocked = busy || loading || Boolean(result.error) || write.needsRefresh
  const formBlocked = blocked || (editingId ? !canEditWeeklyReport(editing)
    : loadingChoices || Boolean(choices.error) || !choices.internships.length)

  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    async function loadReports() {
      try {
        const data = await fetchWeeklyReports(token, page, controller.signal)
        if (controller.signal.aborted) return
        setResult({ key: refresh, ...data, error: '' })
        setWrite((current) => current.needsRefresh ? { ...current, needsRefresh: false, error: false,
          message: 'Reports refreshed. Check the current report before retrying.' } : current)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) return signOut()
        setResult({ key: refresh, reports: [], hasNextPage: false, error: error.name === 'TypeError'
          ? 'Could not connect. Please try again.' : error.message || 'Unable to load weekly reports.' })
      }
    }
    async function loadChoices() {
      try {
        const internships = await fetchReportInternships(token, controller.signal)
        if (!controller.signal.aborted) setChoices({ key: refresh, internships, error: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) return signOut()
        setChoices({ key: refresh, internships: [], error: 'Unable to load active internships. Refresh weekly reports to try again.' })
      }
    }
    loadReports()
    if (student) loadChoices()
    return () => controller.abort()
  }, [token, page, student, refresh, signOut])

  function clearEditor() { setEditingId(null); setValues(emptyValues); setErrors({}) }
  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value, ...(name === 'internshipId' ? { weekNumber: '' } : {}) }))
    setErrors((current) => ({ ...current, [name]: undefined, ...(name === 'internshipId' ? { weekNumber: undefined } : {}) }))
  }
  function editReport(report) {
    if (blocked || editingId || !student || !canEditWeeklyReport(report)) return
    setEditingId(report._id)
    setValues({ internshipId: report.internship._id, weekNumber: String(report.weekNumber), summary: report.summary, learning: report.learning, challenges: report.challenges })
    setErrors({})
    formRef.current?.focus()
  }

  async function runWrite(action, report) {
    if (!student || blocked || requestRef.current || !['save', 'submit'].includes(action)) return
    const controller = new AbortController()
    requestRef.current = controller
    setWrite({ action, id: report?._id || null, message: '', error: false, needsRefresh: false })
    try {
      if (action === 'save') await saveWeeklyReport(token, internship, values, editing, controller.signal)
      else await submitWeeklyReport(token, report, controller.signal)
      if (controller.signal.aborted) return
      if (action === 'save') clearEditor()
      setWrite({ action: '', id: null, message: action === 'save' ? 'Weekly report saved.' : 'Weekly report submitted.', error: false, needsRefresh: false })
      setRefresh((count) => count + 1)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) return signOut()
      const uncertain = !error.status || error.status >= 500
      const needsRefresh = uncertain || error.status === 404 || error.status === 409
      setWrite({ action: '', id: null, error: true, needsRefresh,
        message: uncertain ? 'The report change could not be confirmed. Refresh weekly reports before trying again.'
          : `${error.message || 'Unable to update this report.'}${needsRefresh ? ' Refresh weekly reports before trying again.' : ''}` })
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }
  function save(event) {
    event.preventDefault()
    if (formBlocked) return
    const fieldErrors = validateWeeklyReport(values, internship)
    setErrors(fieldErrors)
    const first = Object.keys(fieldErrors)[0]
    if (first) return event.currentTarget.elements.namedItem(first)?.focus()
    runWrite('save')
  }

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7"><p className="mb-2 text-sm font-medium text-primary">Internship journal</p>
        <h1 className="text-2xl font-semibold">Weekly reports</h1>
      </div>
      {write.message && <p role={write.error ? 'alert' : 'status'} className={`mt-6 break-words rounded-md border p-3 text-sm leading-6 ${write.error ? 'border-error/40 bg-error/10 text-error' : 'border-success/40 bg-success/10 text-success'}`}>
        {write.message}
      </p>}
      {student && <div ref={formRef} tabIndex={-1} className="scroll-mt-44 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:scroll-mt-36 xl:scroll-mt-24">
        {editingId && !loading && !result.error && !canEditWeeklyReport(editing) && <p role="alert" className="mt-6 text-sm text-error">This report is no longer editable. Cancel edit to start another report.</p>}
        <WeeklyReportForm values={values} errors={errors} internships={choices.internships} editing={editingId ? editing || { internship: null } : null}
          loading={loadingChoices} optionsError={choices.error} disabled={Boolean(formBlocked)} saving={write.action === 'save'}
          onChange={changeField} onSubmit={save} onCancel={clearEditor} />
      </div>}
      <WeeklyReportList reports={result.reports} page={page} hasNextPage={!loading && result.hasNextPage} loading={loading}
        error={loading ? '' : result.error} disabled={busy} actionsDisabled={Boolean(blocked)} student={student} editingId={editingId}
        submittingId={write.action === 'submit' ? write.id : null} onRefresh={() => { if (!busy) setRefresh((count) => count + 1) }}
        onPageChange={(next) => { if (!busy) onPageChange(next) }} onEdit={editReport}
        onSubmit={(report) => { if (!editingId) runWrite('submit', report) }} />
    </DashboardLayout>
  )
}
