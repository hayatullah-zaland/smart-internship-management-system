import { useContext } from 'react'
import { Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { getWorkspaceLinks } from './workspaceNavigation'

export default function Sidebar({ onNavigate }) {
  const { user } = useContext(AuthContext)
  const { pathname, hash } = useLocation()
  const links = getWorkspaceLinks(user.role).filter((link) => !link.footer)
    .map((link) => ({ ...link, current: pathname === link.to && !(link.to === '/dashboard' && hash === '#account') }))

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
      <nav className="shrink-0 border-t border-base-300 p-4" aria-label="Account navigation">
        <Link to="/settings" onClick={onNavigate} aria-current={pathname === '/settings' ? 'location' : undefined}
          className={`flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${pathname === '/settings' ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-base-content/70 hover:bg-base-200 hover:text-base-content'}`}>
          <Settings size={19} className="shrink-0" aria-hidden="true" />Settings
        </Link>
      </nav>
    </div>
  )
}
