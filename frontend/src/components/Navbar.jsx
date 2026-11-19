import { useContext } from 'react'
import { Bell, ChevronRight, LogOut, Menu, MessageSquare } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import Brand from './Brand'
import NavbarClock from './NavbarClock'
import ThemeToggle from './ThemeToggle'
import ProfileAvatar from './ProfileAvatar'

export default function Navbar({ onOpenSidebar, sidebarOpen }) {
  const { user, signOut } = useContext(AuthContext)
  const { pathname, hash } = useLocation()
  let pageTitle = hash === '#account' ? 'Account details' : 'Dashboard'
  if (pathname === '/profile') pageTitle = 'My profile'
  if (pathname === '/account') pageTitle = 'My account'
  if (pathname === '/departments') pageTitle = 'Departments'
  if (pathname === '/opportunities') pageTitle = 'Opportunities'
  if (pathname === '/applications') pageTitle = 'My applications'
  if (pathname === '/admin/applications') pageTitle = 'Applications'
  if (pathname === '/admin/users') pageTitle = 'Users'
  if (pathname === '/admin/students') pageTitle = 'Students'
  if (pathname === '/admin/companies') pageTitle = 'Companies'
  if (pathname === '/internships') pageTitle = 'Internships'
  if (pathname === '/daily-reports') pageTitle = 'Daily reports'
  if (pathname === '/weekly-reports') pageTitle = 'Weekly reports'
  if (pathname === '/evaluations') pageTitle = 'Evaluations'
  const role = user.role.replaceAll('_', ' ')

  return (
    <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100 text-base-content">
      <nav className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1 px-3 sm:gap-x-3 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:gap-x-6" aria-label="Top navigation">
        <div className="col-span-2 col-start-1 row-start-1 flex h-20 min-w-0 items-center gap-2 sm:col-span-1 sm:gap-4">
          <button className="btn btn-ghost btn-square shrink-0 lg:hidden" type="button"
            onClick={onOpenSidebar} aria-label="Open navigation" title="Open navigation"
            aria-controls="mobile-sidebar" aria-expanded={sidebarOpen} aria-haspopup="dialog">
            <Menu size={21} aria-hidden="true" />
          </button>
          <Link className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary lg:hidden"
            to="/dashboard" aria-label="SIMS dashboard">
            <Brand compact />
          </Link>
          <ol className="hidden min-w-0 items-center gap-3 text-sm lg:flex">
            <li className="text-base-content/70">Workspace</li>
            <li aria-hidden="true"><ChevronRight size={15} className="text-base-content/35" /></li>
            <li className="truncate font-medium" aria-current="location">
              {pageTitle}
            </li>
          </ol>
        </div>
        <div className="col-span-3 col-start-1 row-start-2 border-t border-base-300 xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:border-0">
          <NavbarClock />
        </div>
        <div className="col-span-3 col-start-1 row-start-3 flex h-11 items-center justify-end gap-1 border-t border-base-300 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:h-20 sm:border-0 xl:col-start-3" role="group" aria-label="Workspace tools">
          <div className="tooltip tooltip-bottom tooltip-end" data-tip="Messages (not available yet)" tabIndex={0} role="group" aria-label="Messages (not available yet)">
            <button className="btn btn-ghost btn-square" type="button" disabled aria-label="Messages (not available yet)">
              <MessageSquare size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="tooltip tooltip-bottom tooltip-end" data-tip="Notifications (not available yet)" tabIndex={0} role="group" aria-label="Notifications (not available yet)">
            <button className="btn btn-ghost btn-square" type="button" disabled aria-label="Notifications (not available yet)">
              <Bell size={20} aria-hidden="true" />
            </button>
          </div>
          <ThemeToggle />
        </div>
        <div className="col-start-3 row-start-1 flex shrink-0 items-center gap-1 sm:gap-3 xl:col-start-4">
          <span className="mx-1 hidden h-7 w-px bg-base-300 md:block" aria-hidden="true" />
          <Link to="/account" aria-label="Open my account" title="My account"
            className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <ProfileAvatar user={user} className="size-9 text-sm" />
            <span className="sr-only md:hidden">{user.name}, {role}</span>
            <div className="hidden min-w-0 max-w-44 md:block">
              <p className="truncate text-sm font-semibold" title={user.name}>{user.name}</p>
              <p className="truncate text-xs leading-5 text-base-content/70 capitalize" title={role}>{role}</p>
            </div>
          </Link>
          <div className="tooltip tooltip-bottom tooltip-end" data-tip="Sign out">
            <button className="btn btn-ghost btn-square" type="button" onClick={signOut}
              aria-label="Sign out" title="Sign out">
              <LogOut size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>
    </header>
  )
}
