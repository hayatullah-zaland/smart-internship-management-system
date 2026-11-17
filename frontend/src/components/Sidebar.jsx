import { useContext } from 'react'
import { BriefcaseBusiness, ClipboardList, GraduationCap, LayoutDashboard, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { AuthContext } from '../context/AuthContext'

export default function Sidebar({ onNavigate }) {
  const { user } = useContext(AuthContext)
  const { pathname, hash } = useLocation()
  const links = [
    { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, current: pathname === '/dashboard' && hash !== '#account' },
    { to: '/opportunities', label: 'Opportunities', Icon: BriefcaseBusiness, current: pathname === '/opportunities' },
    { to: '/dashboard#account', label: 'Account details', Icon: UserRound, current: pathname === '/dashboard' && hash === '#account' },
  ]
  if (user.role === 'student') {
    links.push({ to: '/applications', label: 'My applications', Icon: ClipboardList, current: pathname === '/applications' })
    links.push({ to: '/profile', label: 'My profile', Icon: GraduationCap, current: pathname === '/profile' })
  }
  if (user.role === 'admin') {
    links.push({ to: '/admin/applications', label: 'Applications', Icon: ClipboardList, current: pathname === '/admin/applications' })
    links.push({ to: '/departments', label: 'Departments', Icon: GraduationCap, current: pathname === '/departments' })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label="Workspace navigation">
        <p className="mb-3 px-3 text-xs font-medium text-base-content/70">Workspace</p>
        <ul className="space-y-1.5">
          {links.map(({ to, label, Icon, current }) => (
            <li key={to}>
              <Link to={to} onClick={onNavigate} aria-current={current ? 'location' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${current ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-base-content/70 hover:bg-base-200 hover:text-base-content'}`}>
                <Icon size={19} className="shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex items-center gap-3 border-t border-base-300 px-6 py-5">
        <ShieldCheck size={19} className="shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs font-medium">University portal</p>
          <p className="mt-1 text-xs text-base-content/70">Internship management</p>
        </div>
      </div>
    </div>
  )
}
