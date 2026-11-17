import { useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { fetchInternships, MAX_INTERNSHIPS_PAGE } from '../context/internshipApi'
import DashboardLayout from '../components/DashboardLayout'
import InternshipAssignmentForm from '../components/InternshipAssignmentForm'
import InternshipList from '../components/InternshipList'

export default function Internships() {
  const { user, token, signOut } = useContext(AuthContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('page') || 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= MAX_INTERNSHIPS_PAGE ? requestedPage : 1
  const [refreshCount, setRefreshCount] = useState(0)
  const [result, setResult] = useState({ key: null, internships: [], hasNextPage: false, error: '' })
  const requestKey = `${user.id}:${token}:${page}:${refreshCount}`
  const loading = result.key !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    async function loadInternships() {
      try {
        const data = await fetchInternships(token, page, controller.signal)
        if (!controller.signal.aborted) setResult({ key: requestKey, ...data, error: '' })
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
  }, [token, page, requestKey, signOut])

  function refreshInternships() { setRefreshCount((count) => count + 1) }
  function changePage(nextPage) { setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) }) }
  function assigned() {
    setSearchParams({})
    refreshInternships()
  }

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7">
        <p className="mb-2 text-sm font-medium text-primary">Placements</p>
        <h1 className="text-2xl font-semibold">Internships</h1>
      </div>
      {user.role === 'admin' && <InternshipAssignmentForm key={`${user.id}:${token}`} onAssigned={assigned} />}
      <InternshipList internships={loading ? [] : result.internships} page={page}
        hasNextPage={!loading && result.hasNextPage} loading={loading} error={loading ? '' : result.error}
        onRefresh={refreshInternships} onPageChange={changePage} />
    </DashboardLayout>
  )
}
