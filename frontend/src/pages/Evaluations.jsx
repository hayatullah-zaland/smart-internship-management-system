import { useContext, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { createEvaluation, EVALUATOR_ROLES, fetchCompletedEvaluationInternships, fetchEvaluations, MAX_EVALUATIONS_PAGE, validateEvaluation } from '../context/evaluationApi'
import DashboardLayout from '../components/DashboardLayout'
import EvaluationForm from '../components/EvaluationForm'
import EvaluationList from '../components/EvaluationList'

const emptyValues = { internshipId: '', score: '', comments: '' }

export default function Evaluations() {
  const { user, token } = useContext(AuthContext)
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(requested) && requested >= 1 && requested <= MAX_EVALUATIONS_PAGE ? requested : 1
  return <EvaluationsWorkspace key={`${user.id}:${token}:${page}`} page={page}
    onPageChange={(next) => setParams(next === 1 ? {} : { page: String(next) })} />
}

export function EvaluationsWorkspace({ page, onPageChange }) {
  const { user, token, signOut } = useContext(AuthContext)
  const academic = user.role === 'academic_supervisor'
  const evaluator = EVALUATOR_ROLES.includes(user.role)
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState({ key: null, evaluations: [], hasNextPage: false, error: '' })
  const [choices, setChoices] = useState({ key: null, internships: [], error: '' })
  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)
  const [write, setWrite] = useState({ saving: false, message: '', error: false, needsRefresh: false })
  const requestRef = useRef(null)
  const formRef = useRef(null)
  const loading = result.key !== refresh
  const loadingChoices = academic && choices.key !== refresh
  const selected = choices.internships.find((item) => item._id === values.internshipId)
  const blocked = write.saving || loading || Boolean(result.error) || write.needsRefresh
  const formBlocked = blocked || (academic && (loadingChoices || Boolean(choices.error) || !choices.internships.length))

  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    async function loadEvaluations() {
      try {
        const data = await fetchEvaluations(token, page, controller.signal)
        if (controller.signal.aborted) return
        setResult({ key: refresh, ...data, error: '' })
        setWrite((current) => current.needsRefresh ? { ...current, needsRefresh: false, error: false,
          message: 'Evaluations refreshed. Check the current records before retrying.' } : current)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) return signOut()
        setResult({ key: refresh, evaluations: [], hasNextPage: false, error: error.name === 'TypeError'
          ? 'Could not connect. Please try again.' : error.message || 'Unable to load evaluations.' })
      }
    }
    async function loadChoices() {
      try {
        const internships = await fetchCompletedEvaluationInternships(token, user.id, controller.signal)
        if (!controller.signal.aborted) setChoices({ key: refresh, internships, error: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) return signOut()
        setChoices({ key: refresh, internships: [], error: 'Unable to load completed internships. Refresh evaluations to try again.' })
      }
    }
    loadEvaluations()
    if (academic) loadChoices()
    return () => controller.abort()
  }, [token, user.id, academic, page, refresh, signOut])

  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: name === 'internshipId' ? value.trim() : value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }
  function checkFields() {
    const fieldErrors = validateEvaluation(values)
    if (academic && !selected) fieldErrors.internshipId = 'Choose an available completed internship.'
    setErrors(fieldErrors)
    return Object.keys(fieldErrors)[0]
  }
  function review(event) {
    event.preventDefault()
    if (!evaluator || formBlocked || requestRef.current) return
    const first = checkFields()
    if (first) return event.currentTarget.elements.namedItem(first)?.focus()
    setConfirming(true)
    formRef.current?.focus()
  }
  function refreshEvaluations() {
    if (write.saving || requestRef.current) return
    setConfirming(false)
    setRefresh((count) => count + 1)
  }
  function backToFields() {
    if (write.saving || requestRef.current) return
    setConfirming(false)
    formRef.current?.focus()
  }
  async function record(event) {
    event.preventDefault()
    if (!evaluator || !confirming || formBlocked || requestRef.current) return
    if (checkFields()) { backToFields(); return }
    const controller = new AbortController()
    requestRef.current = controller
    setWrite({ saving: true, message: '', error: false, needsRefresh: false })
    try {
      await createEvaluation(token, values, user, selected, controller.signal)
      if (controller.signal.aborted) return
      setValues(emptyValues)
      setConfirming(false)
      formRef.current?.focus()
      setWrite({ saving: false, message: 'Final evaluation recorded.', error: false, needsRefresh: false })
      setRefresh((count) => count + 1)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) return signOut()
      const uncertain = !error.status || error.status >= 500
      const needsRefresh = uncertain || error.status === 404 || error.status === 409
      setConfirming(false)
      formRef.current?.focus()
      setWrite({ saving: false, error: true, needsRefresh,
        message: uncertain ? 'The evaluation could not be confirmed. Refresh evaluations before trying again.'
          : `${error.message || 'Unable to record this evaluation.'}${needsRefresh ? ' Refresh evaluations before trying again.' : ''}` })
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7"><p className="mb-2 text-sm font-medium text-primary">Final assessments</p>
        <h1 className="text-2xl font-semibold">Evaluations</h1>
      </div>
      {write.message && <p role={write.error ? 'alert' : 'status'} className={`mt-6 break-words rounded-md border p-3 text-sm leading-6 ${write.error ? 'border-error/40 bg-error/10 text-error' : 'border-success/40 bg-success/10 text-success'}`}>
        {write.message}
      </p>}
      {evaluator && <div ref={formRef} tabIndex={-1} className="scroll-mt-44 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:scroll-mt-36 xl:scroll-mt-24">
        <EvaluationForm values={values} errors={errors} internships={choices.internships} academic={academic} loading={loadingChoices}
          optionsError={choices.error} confirming={confirming} disabled={Boolean(formBlocked)} saving={write.saving}
          onChange={changeField} onReview={review} onConfirm={record} onBack={backToFields} />
      </div>}
      <EvaluationList evaluations={result.evaluations} page={page} hasNextPage={!loading && result.hasNextPage} loading={loading}
        error={loading ? '' : result.error} disabled={write.saving} onRefresh={refreshEvaluations}
        onPageChange={(next) => { if (!write.saving && !requestRef.current) onPageChange(next) }} />
    </DashboardLayout>
  )
}
