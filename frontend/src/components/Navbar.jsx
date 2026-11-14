import { useContext } from 'react'
import { LogOut } from 'lucide-react'
import { Link } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import Brand from './Brand'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const { user, signOut } = useContext(AuthContext)
  const role = user.role.replaceAll('_', ' ')

  return (
    <header className="border-b border-base-300 bg-base-100 text-base-content">
      <nav className="navbar mx-auto max-w-6xl flex-wrap gap-x-4 gap-y-3 px-5 py-4 sm:px-8" aria-label="Main navigation">
        <div className="min-w-0 flex-1">
          <Link className="inline-flex max-w-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            to="/dashboard" aria-label="SIMS dashboard">
            <Brand />
          </Link>
        </div>
        <div className="order-last w-full min-w-0 border-t border-base-300 pt-3 sm:order-none sm:w-auto sm:max-w-48 sm:border-0 sm:pt-0">
          <p className="truncate text-sm font-medium" title={user.name}>{user.name}</p>
          <p className="truncate text-xs leading-5 text-base-content/65 capitalize" title={role}>{role}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <div className="tooltip tooltip-bottom" data-tip="Sign out">
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
