import { useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { fetchAdminStudentProfiles, MAX_STUDENTS_PAGE } from '../context/studentProfileApi'
import DashboardLayout from '../components/DashboardLayout'
import StudentList from '../components/StudentList'

export default function Students() {
  const { user, token, signOut } = useContext(AuthContext)
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(requested) && requested >= 1 && requested <= MAX_STUDENTS_PAGE ? requested : 1
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState({ key: null, profiles: [], hasNextPage: false, error: '' })
  const requestKey = `${user.id}:${token}:${page}:${refresh}`
  const loading = result.key !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    async function loadStudents() {
      try {
        const data = await fetchAdminStudentProfiles(token, page, controller.signal)
        if (!controller.signal.aborted) setResult({ key: requestKey, ...data, error: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) return signOut()
        let message = error.message || 'Unable to load student profiles.'
        if (error.name === 'TypeError') message = 'Could not connect. Please try again.'
        if (error.name === 'TimeoutError' || error.name === 'AbortError') message = 'Loading took too long. Please try again.'
        setResult({ key: requestKey, profiles: [], hasNextPage: false, error: message })
      }
    }
    loadStudents()
    return () => controller.abort()
  }, [token, page, requestKey, signOut])

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7">
        <p className="mb-2 text-sm font-medium text-primary">Administration</p>
        <h1 className="text-2xl font-semibold">Students</h1>
      </div>
      <StudentList profiles={loading ? [] : result.profiles} page={page} hasNextPage={!loading && result.hasNextPage}
        loading={loading} error={loading ? '' : result.error} onRefresh={() => setRefresh((count) => count + 1)}
        onPageChange={(next) => setParams(next === 1 ? {} : { page: String(next) })} />
    </DashboardLayout>
  )
}
