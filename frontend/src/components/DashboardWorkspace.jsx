import {
  ArrowUpRight, Award, BookOpen, BriefcaseBusiness, Building2, ClipboardList,
  FileText, GraduationCap, UserRound, UsersRound,
} from 'lucide-react'
import { Link } from 'react-router'

const shortcuts = {
  admin: [
    { to: '/admin/students', label: 'Students', detail: 'Academic profiles', Icon: GraduationCap, color: 'text-info' },
    { to: '/admin/users', label: 'Users', detail: 'Accounts and access', Icon: UsersRound, color: 'text-primary' },
    { to: '/admin/companies', label: 'Companies', detail: 'Partner directory', Icon: Building2, color: 'text-secondary' },
    { to: '/departments', label: 'Departments', detail: 'University departments', Icon: BookOpen, color: 'text-warning' },
  ],
  student: [
    { to: '/applications', label: 'My applications', detail: 'Application decisions', Icon: ClipboardList, color: 'text-info' },
    { to: '/daily-reports', label: 'Daily reports', detail: 'Daily work and feedback', Icon: FileText, color: 'text-primary' },
    { to: '/weekly-reports', label: 'Weekly reports', detail: 'Weekly summaries', Icon: BookOpen, color: 'text-secondary' },
    { to: '/profile', label: 'Academic profile', detail: 'Student and department details', Icon: GraduationCap, color: 'text-warning' },
  ],
  academic_supervisor: [
    { to: '/internships', label: 'Internships', detail: 'Assigned placements', Icon: BriefcaseBusiness, color: 'text-primary' },
    { to: '/daily-reports', label: 'Daily reports', detail: 'Student work and reviews', Icon: FileText, color: 'text-info' },
    { to: '/evaluations', label: 'Evaluations', detail: 'Academic assessments', Icon: Award, color: 'text-warning' },
    { to: '/account', label: 'My account', detail: 'Personal details', Icon: UserRound, color: 'text-secondary' },
  ],
  company_representative: [
    { to: '/opportunities', label: 'Opportunities', detail: 'Company openings', Icon: BriefcaseBusiness, color: 'text-info' },
    { to: '/evaluations', label: 'Evaluations', detail: 'Company assessments', Icon: Award, color: 'text-warning' },
    { to: '/account', label: 'My account', detail: 'Personal details', Icon: UserRound, color: 'text-secondary' },
  ],
}

const reportMetrics = [
  { key: 'dailyReports', label: 'Daily reports', color: 'bg-info' },
  { key: 'weeklyReports', label: 'Weekly reports', color: 'bg-secondary' },
]
const submittedMetrics = [
  { key: 'submittedDailyReports', label: 'Submitted daily reports', color: 'bg-info' },
  { key: 'submittedWeeklyReports', label: 'Submitted weekly reports', color: 'bg-secondary' },
]
const internshipMetrics = [
  { key: 'activeInternships', label: 'Active internships', color: 'bg-primary' },
  { key: 'completedInternships', label: 'Completed internships', color: 'bg-info' },
]

export default function DashboardWorkspace({ role, stats, loading, error }) {
  const reports = role === 'student' || role === 'academic_supervisor'
  const metrics = role === 'student' ? reportMetrics : role === 'academic_supervisor' ? submittedMetrics : internshipMetrics
  const available = !loading && !error && stats
  const maximum = available ? Math.max(...metrics.map(({ key }) => stats[key])) : 0
  const scope = role === 'admin' ? 'Across the university'
    : role === 'company_representative' ? 'Your represented companies'
      : role === 'academic_supervisor' ? 'Your assigned internships' : 'Your reports, all statuses'

  return (
    <div className="grid min-w-0 gap-8 border-y border-base-300 py-7 xl:grid-cols-2 xl:gap-10">
      <section aria-labelledby="snapshot-heading" className="dashboard-enter min-w-0" style={{ '--dashboard-delay': '180ms' }}>
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {reports ? <FileText size={19} aria-hidden="true" /> : <BriefcaseBusiness size={19} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <h2 id="snapshot-heading" className="text-base font-semibold">{reports ? 'Report snapshot' : 'Internship snapshot'}</h2>
            <p className="mt-1 text-xs leading-5 text-base-content/65">{scope}</p>
          </div>
        </div>
        {available ? (
          <>
            <ul className="mt-7 space-y-6" aria-label={reports ? 'Report counts' : 'Internship counts'}>
              {metrics.map(({ key, label, color }) => (
                <li key={key}>
                  <div className="mb-2 flex items-start justify-between gap-4 text-sm">
                    <span className="min-w-0 break-words text-base-content/75">{label}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{stats[key].toLocaleString('en-US')}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-base-300/65" aria-hidden="true">
                    <div className={`dashboard-meter h-full rounded-sm ${color}`} style={{ width: `${maximum ? stats[key] / maximum * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs leading-5 text-base-content/65">
              {maximum === 0
                ? role === 'academic_supervisor' ? 'No submitted reports.'
                  : reports ? 'No reports yet.' : 'No active or completed internships yet.'
                : role === 'academic_supervisor' ? 'Submitted reports across your placements.'
                  : reports ? 'Daily and weekly report totals.' : 'Active and completed placements.'}
            </p>
          </>
        ) : loading ? (
          <div className="mt-7 space-y-6" aria-hidden="true">
            {[0, 1].map((key) => <div key={key} className="space-y-3"><div className="skeleton h-4 w-40 max-w-full motion-reduce:animate-none" /><div className="skeleton h-2 w-full motion-reduce:animate-none" /></div>)}
          </div>
        ) : <p className="mt-7 text-sm text-base-content/65">Snapshot unavailable.</p>}
      </section>
      <nav aria-labelledby="quick-access-heading" className="dashboard-enter min-w-0 xl:border-l xl:border-base-300 xl:pl-10" style={{ '--dashboard-delay': '225ms' }}>
        <h2 id="quick-access-heading" className="mb-3 text-base font-semibold">Quick access</h2>
        <ul className="divide-y divide-base-300">
          {(shortcuts[role] || []).map(({ to, label, detail, Icon, color }) => (
            <li key={to}>
              <Link to={to} className="dashboard-shortcut group flex min-h-18 items-center gap-3 rounded-md py-3 pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-md bg-current/8 ${color}`}><Icon size={18} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium group-hover:text-primary">{label}</span>
                  <span className="mt-1 block break-words text-xs leading-5 text-base-content/65">{detail}</span>
                </span>
                <ArrowUpRight size={17} className="shrink-0 text-base-content/50 group-hover:text-primary" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
