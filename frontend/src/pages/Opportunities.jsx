import { useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { fetchOpportunities, MAX_OPPORTUNITIES_PAGE } from '../context/opportunityApi'
import DashboardLayout from '../components/DashboardLayout'
import OpportunityList from '../components/OpportunityList'
import OpportunityApply from '../components/OpportunityApply'

export default function Opportunities() {
  const { user, token, signOut } = useContext(AuthContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('page') || 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= MAX_OPPORTUNITIES_PAGE ? requestedPage : 1
  const [refreshCount, setRefreshCount] = useState(0)
  const [result, setResult] = useState({ key: null, opportunities: [], hasNextPage: false, error: '' })
  const requestKey = `${user.id}:${token}:${page}:${refreshCount}`
  const loading = result.key !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    async function loadOpportunities() {
      try {
        const data = await fetchOpportunities(token, page, controller.signal)
        if (!controller.signal.aborted) setResult({ key: requestKey, ...data, error: '' })
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
    setRefreshCount((count) => count + 1)
  }

  function changePage(nextPage) {
    setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) })
  }

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7">
        <p className="mb-2 text-sm font-medium text-primary">Internships</p>
        <h1 className="text-2xl font-semibold">Opportunities</h1>
      </div>
      <OpportunityList opportunities={loading ? [] : result.opportunities} page={page}
        hasNextPage={!loading && result.hasNextPage} loading={loading} error={loading ? '' : result.error}
        onRefresh={refreshOpportunities} onPageChange={changePage}
        renderActions={user.role === 'student' ? (opportunity) => (
          <OpportunityApply key={`${user.id}:${token}:${opportunity._id}`} opportunityId={opportunity._id} opportunityTitle={opportunity.title} />
        ) : undefined} />
    </DashboardLayout>
  )
}
