import { useContext, useEffect, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, ClipboardList, NotebookTabs, SquarePen } from 'lucide-react'
import { Link } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { fetchDashboardStats } from '../context/dashboardApi'
import DashboardLayout from '../components/DashboardLayout'
import DashboardStats from '../components/DashboardStats'
import DashboardWorkspace from '../components/DashboardWorkspace'
import ProfileAvatar from '../components/ProfileAvatar'
import { USER_ROLES } from '../context/userApi'

const primaryActions = {
  admin: { to: '/admin/applications', label: 'Review applications', Icon: ClipboardList },
  student: { to: '/opportunities', label: 'Find opportunities', Icon: BriefcaseBusiness },
  academic_supervisor: { to: '/internships', label: 'View internships', Icon: NotebookTabs },
  company_representative: { to: '/opportunities', label: 'Manage opportunities', Icon: BriefcaseBusiness },
}

export default function Dashboard() {
  const { user, token, signOut } = useContext(AuthContext)
  const role = user.role
  const [refreshCount, setRefreshCount] = useState(0)
  const [summary, setSummary] = useState({ key: null, stats: null, error: '' })
  const requestKey = `${token}:${role}:${refreshCount}`
  // Never show a previous account's results or an earlier refresh attempt.
  const loading = summary.key !== requestKey
  const action = primaryActions[role]

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
      <div className="dashboard-enter flex flex-wrap items-end justify-between gap-5 border-b border-base-300 pb-7">
        <div className="min-w-0 flex-1 basis-64">
          <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium">
            <span className="text-base-content/65">Workspace overview</span>
            <span className="inline-flex items-center gap-2 rounded-md bg-info/10 px-2 py-1 text-info"><span className="size-1.5 shrink-0 rounded-full bg-info" aria-hidden="true" />{USER_ROLES[role]}</span>
          </p>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-3 break-words text-sm leading-6 text-base-content/70">Welcome back, <span className="font-medium text-base-content">{user.name}</span>.</p>
        </div>
        {action && <Link to={action.to} className="btn btn-primary min-h-11 max-w-full shrink-0 gap-2 px-4 text-sm">
          <action.Icon size={17} className="shrink-0" aria-hidden="true" />{action.label}<ArrowRight size={16} className="shrink-0" aria-hidden="true" />
        </Link>}
      </div>
      <DashboardStats role={role} stats={loading ? null : summary.stats} loading={loading}
        error={loading ? '' : summary.error} onRefresh={refreshStats} />
      <DashboardWorkspace role={role} stats={loading ? null : summary.stats} loading={loading} error={loading ? '' : summary.error} />
      <section id="account" tabIndex={-1} aria-labelledby="account-heading"
        className="scroll-mt-44 border-b border-base-300 py-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:scroll-mt-36 xl:scroll-mt-28">
        <div className="flex flex-wrap items-center gap-3">
          <ProfileAvatar user={user} className="size-10 text-sm" />
          <div className="min-w-0 flex-1">
            <h2 id="account-heading" className="text-base font-semibold">Account details</h2>
            <p className="mt-1 text-xs text-base-content/65">{USER_ROLES[role]}</p>
          </div>
          <Link className="btn btn-ghost btn-sm" to="/account"><SquarePen size={16} aria-hidden="true" /> Edit account</Link>
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
            <dd className="break-words font-medium">{USER_ROLES[role]}</dd>
          </div>
        </dl>
      </section>
    </DashboardLayout>
  )
}
