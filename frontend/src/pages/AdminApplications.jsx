import { useContext, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { APPLICATION_STATUSES, fetchAdminApplications, MAX_APPLICATIONS_PAGE, reviewApplication } from '../context/applicationApi'
import DashboardLayout from '../components/DashboardLayout'
import ApplicationList from '../components/ApplicationList'
import ApplicationReviewForm from '../components/ApplicationReviewForm'

export default function AdminApplications() {
  const { user, token, signOut } = useContext(AuthContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('page') || 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= MAX_APPLICATIONS_PAGE ? requestedPage : 1
  const status = APPLICATION_STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : ''
  const [refreshCount, setRefreshCount] = useState(0)
  const [result, setResult] = useState({ key: null, applications: [], hasNextPage: false, error: '' })
  const [reviewState, setReviewState] = useState({ key: null, savingId: null, message: '', error: false, needsRefresh: false })
  const reviewRef = useRef(null)
  const scopeKey = `${user.id}:${token}:${page}:${status}`
  const requestKey = `${scopeKey}:${refreshCount}`
  const loading = result.key !== requestKey
  const currentReview = reviewState.key === scopeKey ? reviewState : null
  const saving = Boolean(currentReview?.savingId)

  useEffect(() => () => {
    const controller = reviewRef.current
    if (!controller) return
    controller.abort()
    reviewRef.current = null
    // Cancelling the client request cannot undo a decision already saved by the server.
    setReviewState((current) => current.savingId ? { ...current, savingId: null, needsRefresh: true, error: true,
      message: 'The review could not be confirmed. Refresh applications before trying again.' } : current)
  }, [scopeKey])

  useEffect(() => {
    const controller = new AbortController()
    async function loadApplications() {
      try {
        const data = await fetchAdminApplications(token, page, status, controller.signal)
        if (controller.signal.aborted) return
        setResult({ key: requestKey, ...data, error: '' })
        setReviewState((current) => current.key === scopeKey && current.needsRefresh
          ? { ...current, needsRefresh: false, message: '', error: false } : current)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) {
          signOut()
          return
        }
        let message = error.message || 'Unable to load applications. Please try again.'
        if (error.name === 'TypeError') message = 'Could not connect. Please try again in a moment.'
        if (error.name === 'TimeoutError' || error.name === 'AbortError') message = 'Loading took too long. Please try again.'
        setResult({ key: requestKey, applications: [], hasNextPage: false, error: message })
      }
    }
    loadApplications()
    return () => controller.abort()
  }, [token, page, status, requestKey, scopeKey, signOut])

  function refreshApplications() {
    if (!saving) setRefreshCount((count) => count + 1)
  }

  function changeQuery(nextPage, nextStatus = status) {
    if (saving) return
    const query = {}
    if (nextPage > 1) query.page = String(nextPage)
    if (nextStatus) query.status = nextStatus
    setSearchParams(query)
  }

  async function saveDecision(applicationId, values) {
    if (user.role !== 'admin' || loading || result.error || currentReview?.needsRefresh
      || (reviewRef.current && !reviewRef.current.signal.aborted)) return
    const controller = new AbortController()
    reviewRef.current = controller
    setReviewState({ key: scopeKey, savingId: applicationId, message: '', error: false, needsRefresh: false })
    try {
      const application = await reviewApplication(token, applicationId, values, controller.signal)
      if (controller.signal.aborted) return
      setReviewState({ key: scopeKey, savingId: null, message: `Application marked as ${application.status.replaceAll('_', ' ')}.`, error: false, needsRefresh: false })
      setRefreshCount((count) => count + 1)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) {
        signOut()
        return
      }
      const uncertain = !error.status || error.status >= 500
      const needsRefresh = uncertain || error.status === 404 || error.status === 409
      const message = uncertain ? 'The review could not be confirmed. Refresh applications before trying again.'
        : `${error.message || 'Unable to save this decision.'}${needsRefresh ? ' Refresh applications before reviewing again.' : ''}`
      setReviewState({ key: scopeKey, savingId: null, message, error: true, needsRefresh })
    } finally {
      if (reviewRef.current === controller) reviewRef.current = null
    }
  }

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7">
        <p className="mb-2 text-sm font-medium text-primary">Administration</p>
        <h1 className="text-2xl font-semibold">Applications</h1>
      </div>
      <div className="pt-6">
        <label className="mb-2 block text-sm font-medium" htmlFor="application-status">Status</label>
        <select id="application-status" className="select w-full sm:w-56" value={status} disabled={saving}
          onChange={(event) => changeQuery(1, event.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        {currentReview?.message && <p role={currentReview.error ? 'alert' : 'status'}
          className={`mt-5 break-words rounded-md border p-3 text-sm leading-6 ${currentReview.error ? 'border-error/40 bg-error/10 text-error' : 'border-success/40 bg-success/10 text-success'}`}>
          {currentReview.message}
        </p>}
      </div>
      <ApplicationList applications={loading ? [] : result.applications} page={page} showStudent
        hasNextPage={!loading && result.hasNextPage} loading={loading} error={loading ? '' : result.error}
        disabled={saving} onRefresh={refreshApplications} onPageChange={changeQuery}
        renderActions={(application) => <ApplicationReviewForm key={`${scopeKey}:${application._id}:${application.status}`}
          application={application} disabled={saving || Boolean(currentReview?.needsRefresh)}
          saving={currentReview?.savingId === application._id} onReview={saveDecision} />} />
    </DashboardLayout>
  )
}
