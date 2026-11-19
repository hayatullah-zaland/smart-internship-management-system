import {
  BookOpen, BriefcaseBusiness, Building2, CalendarDays, CheckCheck, ClipboardCheck,
  ClipboardList, FileClock, FileText, GraduationCap, RefreshCw, Star, TriangleAlert, UsersRound,
} from 'lucide-react'
import { dashboardFields } from '../context/dashboardApi'

const metricDetails = {
  students: { label: 'Students', Icon: UsersRound, color: 'text-info' },
  companies: { label: 'Companies', Icon: Building2, color: 'text-secondary' },
  departments: { label: 'Departments', Icon: GraduationCap, color: 'text-info' },
  pendingApplications: { label: 'Pending applications', Icon: FileClock, color: 'text-warning' },
  activeInternships: { label: 'Active internships', Icon: BriefcaseBusiness, color: 'text-primary' },
  completedInternships: { label: 'Completed internships', Icon: CheckCheck, color: 'text-success' },
  applications: { label: 'Applications', Icon: ClipboardList, color: 'text-info' },
  dailyReports: { label: 'Daily reports', Icon: FileText, color: 'text-info' },
  weeklyReports: { label: 'Weekly reports', Icon: CalendarDays, color: 'text-secondary' },
  evaluations: { label: 'Evaluations', Icon: Star, color: 'text-warning' },
  assignedInternships: { label: 'Assigned internships', Icon: BookOpen, color: 'text-info' },
  submittedDailyReports: { label: 'Submitted daily reports', Icon: ClipboardCheck, color: 'text-info' },
  submittedWeeklyReports: { label: 'Submitted weekly reports', Icon: CalendarDays, color: 'text-secondary' },
  openOpportunities: { label: 'Open opportunities', Icon: BriefcaseBusiness, color: 'text-info' },
}

export default function DashboardStats({ role, stats, loading, error, onRefresh }) {
  const fields = Array.isArray(dashboardFields[role]) ? dashboardFields[role] : []

  return (
    <section className="py-7" aria-labelledby="summary-heading" aria-busy={loading}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="summary-heading" className="text-base font-semibold">At a glance</h2>
        <div className="tooltip tooltip-left" data-tip="Refresh summary">
          <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={onRefresh}
            disabled={loading} aria-label="Refresh dashboard statistics" title="Refresh summary">
            <RefreshCw size={17} className={loading ? 'motion-safe:animate-spin' : undefined} aria-hidden="true" />
          </button>
        </div>
      </div>
      {loading ? (
        <div role="status">
          <span className="sr-only">Loading dashboard statistics...</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
            {fields.map((key) => (
              <div key={key} className="min-h-36 min-w-0 rounded-lg border border-base-300 bg-base-100 p-5">
                <div className="h-10"><div className="skeleton h-4 w-32 max-w-full motion-reduce:animate-none" /></div>
                <div className="skeleton mt-3 h-9 w-20 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
          <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Unable to load summary</p>
            <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{error}</p>
            <button className="btn btn-outline btn-sm mt-3" type="button" onClick={onRefresh}>
              <RefreshCw size={15} aria-hidden="true" /> Retry
            </button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map((key, index) => {
            const { label, Icon, color } = metricDetails[key]
            const value = stats[key]
            const exactValue = value.toLocaleString('en-US')
            const displayValue = value >= 1000000
              ? value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })
              : exactValue
            return (
              <div key={key} className="dashboard-stat dashboard-enter min-h-36 min-w-0 rounded-lg border border-base-300 bg-base-100 p-5"
                style={{ '--dashboard-delay': `${index * 45}ms` }}>
                <dt className="flex min-h-11 items-start justify-between gap-3">
                  <span className="min-w-0 break-words pt-1 text-sm leading-5 text-base-content/70">{label}</span>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-md bg-current/8 ${color}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                </dt>
                <dd className="mt-3 break-all text-3xl leading-9 font-semibold tabular-nums" title={exactValue} aria-label={exactValue}>
                  {displayValue}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </section>
  )
}
