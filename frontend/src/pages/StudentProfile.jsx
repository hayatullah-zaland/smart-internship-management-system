import { useContext, useEffect, useState } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { fetchStudentProfile } from '../context/studentProfileApi'
import { fetchDepartments } from '../context/departmentApi'
import DashboardLayout from '../components/DashboardLayout'
import StudentProfileForm from '../components/StudentProfileForm'

export default function StudentProfile() {
  const { user, token, signOut } = useContext(AuthContext)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ key: null, profile: null, departments: [], error: '' })
  const requestKey = `${user.id}:${token}:${attempt}`
  const loading = result.key !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    async function loadProfile() {
      try {
        const profile = await fetchStudentProfile(token, controller.signal)
        const departments = await fetchDepartments(token, controller.signal)
        if (!controller.signal.aborted) setResult({ key: requestKey, profile, departments, error: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) {
          signOut()
          return
        }
        let message = error.message || 'Unable to load your profile. Please try again.'
        if (error.name === 'TypeError') message = 'Could not connect. Please try again in a moment.'
        if (error.name === 'TimeoutError' || error.name === 'AbortError') message = 'Loading took too long. Please try again.'
        setResult({ key: requestKey, profile: null, departments: [], error: message })
      }
    }
    loadProfile()
    return () => controller.abort()
  }, [token, requestKey, signOut])

  function reloadProfile() {
    setAttempt((current) => current + 1)
  }

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7">
        <p className="mb-2 text-sm font-medium text-primary">Student</p>
        <h1 className="text-2xl font-semibold">My profile</h1>
        <p className="mt-3 break-words text-sm font-medium">{user.name}</p>
        <p className="mt-1 break-all text-sm text-base-content/70">{user.email}</p>
      </div>
      {loading ? (
        <p role="status" className="flex items-center gap-3 py-10 text-sm text-base-content/70">
          <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Loading your profile...
        </p>
      ) : result.error ? (
        <div role="alert" className="mt-8 flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
          <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Unable to load profile</p>
            <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{result.error}</p>
            <button className="btn btn-outline btn-sm mt-3" type="button" onClick={reloadProfile}>
              <RotateCw size={15} aria-hidden="true" /> Retry
            </button>
          </div>
        </div>
      ) : (
        <StudentProfileForm key={requestKey} profile={result.profile} departments={result.departments} />
      )}
    </DashboardLayout>
  )
}
