import { useContext, useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { fetchDashboardStats } from '../context/dashboardApi'
import DashboardLayout from '../components/DashboardLayout'
import DashboardStats from '../components/DashboardStats'

export default function Dashboard() {
  const { user, token, signOut } = useContext(AuthContext)
  const role = user.role
  const [refreshCount, setRefreshCount] = useState(0)
  const [summary, setSummary] = useState({ key: null, stats: null, error: '' })
  const requestKey = `${token}:${role}:${refreshCount}`
  // Never show a previous account's results or an earlier refresh attempt.
  const loading = summary.key !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    async function loadStats() {
      try {
        const stats = await fetchDashboardStats(token, role, controller.signal)
        if (!controller.signal.aborted) setSummary({ key: requestKey, stats, error: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) {
          signOut()
          return
        }
        let message = error.message || 'Unable to load dashboard statistics.'
        if (error.name === 'TypeError') message = 'Could not connect. Please try again in a moment.'
        if (error.name === 'TimeoutError' || error.name === 'AbortError') message = 'Loading took too long. Please try again.'
        setSummary({ key: requestKey, stats: null, error: message })
      }
    }
    loadStats()
    return () => controller.abort()
  }, [token, role, requestKey, signOut])

  function refreshStats() {
    setRefreshCount((count) => count + 1)
  }

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7">
        <p className="mb-2 text-sm font-medium text-primary">Overview</p>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-3 break-words text-sm leading-6 text-base-content/70">Welcome back, {user.name}.</p>
      </div>
      <DashboardStats role={role} stats={loading ? null : summary.stats} loading={loading}
        error={loading ? '' : summary.error} onRefresh={refreshStats} />
      <section id="account" tabIndex={-1} aria-labelledby="account-heading"
        className="scroll-mt-44 border-b border-base-300 py-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:scroll-mt-36 xl:scroll-mt-28">
        <div className="flex items-center gap-3">
          <UserRound size={20} className="text-info" aria-hidden="true" />
          <h2 id="account-heading" className="text-base font-semibold">Account details</h2>
        </div>
        <dl className="mt-6 grid gap-x-8 gap-y-6 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0">
            <dt className="mb-2 text-base-content/70">Full name</dt>
            <dd className="break-words font-medium">{user.name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="mb-2 text-base-content/70">Email</dt>
            <dd className="break-all font-medium">{user.email}</dd>
          </div>
          <div className="min-w-0">
            <dt className="mb-2 text-base-content/70">Account role</dt>
            <dd className="break-words font-medium capitalize">{user.role.replaceAll('_', ' ')}</dd>
          </div>
        </dl>
      </section>
    </DashboardLayout>
  )
}
