import { useContext, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { fetchInternships, MAX_INTERNSHIPS_PAGE, updateInternshipStatus } from '../context/internshipApi'
import DashboardLayout from '../components/DashboardLayout'
import InternshipAssignmentForm from '../components/InternshipAssignmentForm'
import InternshipList from '../components/InternshipList'
import InternshipStatusForm from '../components/InternshipStatusForm'

export default function Internships() {
  const { user, token, signOut } = useContext(AuthContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('page') || 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= MAX_INTERNSHIPS_PAGE ? requestedPage : 1
  const [refreshCount, setRefreshCount] = useState(0)
  const [result, setResult] = useState({ key: null, internships: [], hasNextPage: false, error: '' })
  const [assigning, setAssigning] = useState(false)
  const [changeState, setChangeState] = useState({ key: null, savingId: null, message: '', error: false, needsRefresh: false })
  const statusRef = useRef(null)
  const scopeKey = `${user.id}:${token}:${page}`
  const requestKey = `${scopeKey}:${refreshCount}`
  const loading = result.key !== requestKey
  const currentChange = changeState.key === scopeKey ? changeState : null
  const statusSaving = Boolean(currentChange?.savingId)
  const busy = assigning || statusSaving

  useEffect(() => () => {
    const controller = statusRef.current
    if (!controller) return
    controller.abort()
    statusRef.current = null
    // An aborted client request may already have saved a server-side change.
    setChangeState((current) => current.savingId ? { ...current, savingId: null, needsRefresh: true, error: true,
      message: 'The status change could not be confirmed. Refresh internships before trying again.' } : current)
  }, [scopeKey])

  useEffect(() => {
    const controller = new AbortController()
    async function loadInternships() {
      try {
        const data = await fetchInternships(token, page, controller.signal)
        if (controller.signal.aborted) return
        setResult({ key: requestKey, ...data, error: '' })
        setChangeState((current) => current.key === scopeKey && current.needsRefresh
          ? { ...current, needsRefresh: false, message: '', error: false } : current)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) {
          signOut()
          return
        }
        let message = error.message || 'Unable to load internships. Please try again.'
        if (error.name === 'TypeError') message = 'Could not connect. Please try again in a moment.'
        if (error.name === 'TimeoutError' || error.name === 'AbortError') message = 'Loading took too long. Please try again.'
        setResult({ key: requestKey, internships: [], hasNextPage: false, error: message })
      }
    }
    loadInternships()
    return () => controller.abort()
  }, [token, page, requestKey, scopeKey, signOut])

  function refreshInternships() { if (!busy) setRefreshCount((count) => count + 1) }
  function changePage(nextPage) { if (!busy) setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) }) }
  function assigned() {
    setSearchParams({})
    setRefreshCount((count) => count + 1)
  }

  async function saveStatus(internship, values) {
    if (user.role !== 'admin' || assigning || loading || result.error || currentChange?.needsRefresh
      || (statusRef.current && !statusRef.current.signal.aborted)) return
    const controller = new AbortController()
    statusRef.current = controller
    setChangeState({ key: scopeKey, savingId: internship._id, message: '', error: false, needsRefresh: false })
    try {
      const updated = await updateInternshipStatus(token, internship, values, controller.signal)
      if (controller.signal.aborted) return
      setChangeState({ key: scopeKey, savingId: null, message: `Internship marked as ${updated.status}.`, error: false, needsRefresh: false })
      setRefreshCount((count) => count + 1)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) {
        signOut()
        return
      }
      const uncertain = !error.status || error.status >= 500
      const needsRefresh = uncertain || error.status === 404 || error.status === 409
      const message = uncertain ? 'The status change could not be confirmed. Refresh internships before trying again.'
        : `${error.message || 'Unable to update this internship.'}${needsRefresh ? ' Refresh internships before trying again.' : ''}`
      setChangeState({ key: scopeKey, savingId: null, message, error: true, needsRefresh })
    } finally {
      if (statusRef.current === controller) statusRef.current = null
    }
  }

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7">
        <p className="mb-2 text-sm font-medium text-primary">Placements</p>
        <h1 className="text-2xl font-semibold">Internships</h1>
      </div>
      {user.role === 'admin' && <InternshipAssignmentForm key={`${user.id}:${token}`} onAssigned={assigned}
        disabled={statusSaving || Boolean(currentChange?.needsRefresh)} onSavingChange={setAssigning} />}
      {currentChange?.message && <p role={currentChange.error ? 'alert' : 'status'}
        className={`mt-6 break-words rounded-md border p-3 text-sm leading-6 ${currentChange.error ? 'border-error/40 bg-error/10 text-error' : 'border-success/40 bg-success/10 text-success'}`}>
        {currentChange.message}
      </p>}
      <InternshipList internships={loading ? [] : result.internships} page={page}
        hasNextPage={!loading && result.hasNextPage} loading={loading} error={loading ? '' : result.error}
        disabled={busy} onRefresh={refreshInternships} onPageChange={changePage}
        renderActions={user.role === 'admin' ? (internship) => <InternshipStatusForm key={`${scopeKey}:${internship._id}:${internship.status}`}
          internship={internship} disabled={busy || Boolean(currentChange?.needsRefresh)}
          saving={currentChange?.savingId === internship._id} onSave={saveStatus} /> : undefined} />
    </DashboardLayout>
  )
}
