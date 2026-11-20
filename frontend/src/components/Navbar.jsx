import { useContext } from 'react'
import { ChevronRight, LogOut, Menu } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import Brand from './Brand'
import NavbarClock from './NavbarClock'
import ThemeToggle from './ThemeToggle'
import InboxTools from './InboxTools'
import NavbarAccount from './NavbarAccount'
import NavbarSearch from './NavbarSearch'
import { getWorkspaceLinks } from './workspaceNavigation'

export default function Navbar({ onOpenSidebar, sidebarOpen }) {
  const { user, signOut } = useContext(AuthContext)
  const { pathname, hash } = useLocation()
  const pageTitle = pathname === '/dashboard' && hash === '#account' ? 'Account details'
    : getWorkspaceLinks(user.role).find((link) => link.to === pathname)?.label || 'Dashboard'

  return (
    <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100 text-base-content">
      <nav className="navbar-shell min-w-0 px-3 sm:px-6 lg:px-8" aria-label="Top navigation">
        <div className="navbar-heading flex min-w-0 items-center gap-1.5 sm:gap-3">
          <button className="btn btn-ghost btn-square btn-sm size-9 shrink-0 lg:hidden" type="button"
            onClick={onOpenSidebar} aria-label="Open navigation" title="Open navigation"
            aria-controls="mobile-sidebar" aria-expanded={sidebarOpen} aria-haspopup="dialog">
            <Menu size={21} aria-hidden="true" />
          </button>
          <Link className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary lg:hidden"
            to="/dashboard" aria-label="SIMS dashboard">
            <Brand compact />
          </Link>
          <ol className="hidden min-w-0 max-w-56 items-center gap-2.5 text-sm lg:flex">
            <li className="shrink-0 text-base-content/60">Workspace</li>
            <li className="shrink-0" aria-hidden="true"><ChevronRight size={15} className="text-base-content/35" /></li>
            <li className="truncate font-medium" aria-current="location">
              {pageTitle}
            </li>
          </ol>
        </div>
        <div className="navbar-search min-w-0"><NavbarSearch key={`${user.id}:${user.role}:${pathname}`} role={user.role} /></div>
        <div className="navbar-clock min-w-0 border-t border-base-300 sm:border-0">
          <NavbarClock />
        </div>
        <div className="navbar-tools flex min-w-0 items-center justify-end gap-1" role="group" aria-label="Workspace tools">
          <InboxTools />
          <ThemeToggle />
        </div>
        <div className="navbar-account flex min-w-0 items-center justify-end gap-1 sm:gap-2">
          <NavbarAccount user={user} />
          <div className="tooltip tooltip-bottom tooltip-end" data-tip="Sign out">
            <button className="btn btn-ghost btn-square btn-sm size-8 sm:btn-md sm:size-10" type="button" onClick={signOut}
              aria-label="Sign out" title="Sign out">
              <LogOut size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>
    </header>
  )
}
