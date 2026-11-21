import { useContext, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BriefcaseBusiness } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { canReapplyApplication, fetchMyApplications, MAX_APPLICATIONS_PAGE } from '../context/applicationApi'
import DashboardLayout from '../components/DashboardLayout'
import ApplicationList from '../components/ApplicationList'
import OpportunityApply from '../components/OpportunityApply'

export default function MyApplications() {
  const { user, token, signOut } = useContext(AuthContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('page') || 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= MAX_APPLICATIONS_PAGE ? requestedPage : 1
  const [refreshCount, setRefreshCount] = useState(0)
  const [result, setResult] = useState({ key: null, applications: [], hasNextPage: false, error: '' })
  const requestKey = `${user.id}:${token}:${page}:${refreshCount}`
  const loading = result.key !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    async function loadApplications() {
      try {
        const data = await fetchMyApplications(token, page, controller.signal)
        if (!controller.signal.aborted) setResult({ key: requestKey, ...data, error: '' })
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
  }, [token, page, requestKey, signOut])

  function refreshApplications() {
    setRefreshCount((count) => count + 1)
  }

  function changePage(nextPage) {
    setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) })
  }

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-base-300 pb-7">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">Internships</p>
          <h1 className="text-2xl font-semibold">My applications</h1>
        </div>
        <Link className="btn btn-outline btn-sm" to="/opportunities">
          <BriefcaseBusiness size={16} aria-hidden="true" /> Opportunities
        </Link>
      </div>
      <ApplicationList applications={loading ? [] : result.applications} page={page}
        hasNextPage={!loading && result.hasNextPage} loading={loading} error={loading ? '' : result.error}
        onRefresh={refreshApplications} onPageChange={changePage}
        renderActions={(application) => canReapplyApplication(application) ? <OpportunityApply
          key={`${user.id}:${token}:${application._id}:${application.status}`} reapply
          opportunityId={application.opportunity._id} opportunityTitle={application.opportunity.title}
          onSubmitted={refreshApplications} /> : null} />
    </DashboardLayout>
  )
}
