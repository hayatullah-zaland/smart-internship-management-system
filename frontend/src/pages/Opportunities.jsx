import { useContext, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { createOpportunity, fetchOpportunities, MAX_OPPORTUNITIES_PAGE, validateOpportunity } from '../context/opportunityApi'
import DashboardLayout from '../components/DashboardLayout'
import OpportunityList from '../components/OpportunityList'
import OpportunityApply from '../components/OpportunityApply'
import OpportunityForm from '../components/OpportunityForm'

const emptyValues = { companyId: '', title: '', description: '', deadline: '', capacity: '' }

export default function Opportunities() {
  const { user, token } = useContext(AuthContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('page') || 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= MAX_OPPORTUNITIES_PAGE ? requestedPage : 1
  return <OpportunitiesWorkspace key={`${user.id}:${token}:${page}`} page={page}
    onPageChange={(next) => setSearchParams(next === 1 ? {} : { page: String(next) })} />
}

export function OpportunitiesWorkspace({ page, onPageChange }) {
  const { user, token, signOut } = useContext(AuthContext)
  const [refreshCount, setRefreshCount] = useState(0)
  const [result, setResult] = useState({ key: null, opportunities: [], hasNextPage: false, error: '' })
  const requestKey = `${user.id}:${token}:${page}:${refreshCount}`
  const loading = result.key !== requestKey
  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState({})
  const [write, setWrite] = useState({ saving: false, message: '', error: false, needsRefresh: false, publishedId: null })
  const requestRef = useRef(null)
  const blocked = user.role !== 'company_representative' || loading || Boolean(result.error) || write.saving || write.needsRefresh

  useEffect(() => () => requestRef.current?.abort(), [])

  useEffect(() => {
    const controller = new AbortController()
    async function loadOpportunities() {
      try {
        const data = await fetchOpportunities(token, page, controller.signal)
        if (controller.signal.aborted) return
        setResult({ key: requestKey, ...data, error: '' })
        setWrite((current) => current.needsRefresh ? { ...current, needsRefresh: false, error: false,
          message: 'Opportunities refreshed. Check the list before trying to publish again.' } : current)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) {
          signOut()
          return
        }
        let message = error.message || 'Unable to load opportunities. Please try again.'
        if (error.name === 'TypeError') message = 'Could not connect. Please try again in a moment.'
        if (error.name === 'TimeoutError' || error.name === 'AbortError') message = 'Loading took too long. Please try again.'
        setResult({ key: requestKey, opportunities: [], hasNextPage: false, error: message })
      }
    }
    loadOpportunities()
    return () => controller.abort()
  }, [token, page, requestKey, signOut])

  function refreshOpportunities() {
    if (!write.saving && !requestRef.current) setRefreshCount((count) => count + 1)
  }

  function changePage(nextPage) {
    if (!write.saving && !requestRef.current) onPageChange(nextPage)
  }

  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: name === 'companyId' ? value.trim() : value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function publish(event) {
    event.preventDefault()
    if (blocked || requestRef.current) return
    const fieldErrors = validateOpportunity(values)
    setErrors(fieldErrors)
    const first = Object.keys(fieldErrors)[0]
    if (first) return event.currentTarget.elements.namedItem(first)?.focus()
    const controller = new AbortController()
    requestRef.current = controller
    setWrite({ saving: true, message: '', error: false, needsRefresh: false, publishedId: null })
    try {
      const opportunity = await createOpportunity(token, values, user, controller.signal)
      if (controller.signal.aborted) return
      setValues(emptyValues)
      setWrite({ saving: false, message: `Opportunity published: ${opportunity.title}.`, error: false, needsRefresh: false, publishedId: opportunity._id })
      setRefreshCount((count) => count + 1)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) return signOut()
      const uncertain = !error.status || error.status >= 500
      const needsRefresh = uncertain || error.status === 404 || error.status === 409
      setWrite({ saving: false, error: true, needsRefresh, publishedId: null,
        message: uncertain ? 'Publication could not be confirmed. Refresh opportunities and check the list before trying again.'
          : `${error.message || 'Unable to publish this opportunity.'}${needsRefresh ? ' Refresh opportunities before trying again.' : ''}` })
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7">
        <p className="mb-2 text-sm font-medium text-primary">Internships</p>
        <h1 className="text-2xl font-semibold">Opportunities</h1>
      </div>
      {write.message && <div role={write.error ? 'alert' : 'status'}
        className={`mt-6 break-words rounded-md border p-3 text-sm leading-6 ${write.error ? 'border-error/40 bg-error/10 text-error' : 'border-success/40 bg-success/10 text-success'}`}>
        <p>{write.message}</p>
        {write.publishedId && <p className="mt-2">Opportunity ID: <span className="break-all font-mono text-xs">{write.publishedId}</span></p>}
      </div>}
      {user.role === 'company_representative' && <OpportunityForm values={values} errors={errors} disabled={blocked} saving={write.saving}
        onChange={changeField} onSubmit={publish} />}
      <OpportunityList opportunities={loading ? [] : result.opportunities} page={page}
        hasNextPage={!loading && result.hasNextPage} loading={loading} error={loading ? '' : result.error}
        disabled={write.saving} onRefresh={refreshOpportunities} onPageChange={changePage}
        renderActions={user.role === 'student' ? (opportunity) => (
          <OpportunityApply key={`${user.id}:${token}:${opportunity._id}`} opportunityId={opportunity._id} opportunityTitle={opportunity.title} />
        ) : undefined} />
    </DashboardLayout>
  )
}
