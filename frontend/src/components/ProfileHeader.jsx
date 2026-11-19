import { CircleCheck, GraduationCap, UserRound } from 'lucide-react'
import { Link } from 'react-router'

export default function ProfileHeader({ user, academic = false }) {
  return (
    <div className="border-b border-base-300">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase text-base-content/60">Account settings</p>
          <h1 className="text-2xl font-semibold">{academic ? 'My profile' : 'My account'}</h1>
        </div>
        {user.isActive === true && <span className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <CircleCheck size={14} aria-hidden="true" /> Active account
        </span>}
      </div>
      {user.role === 'student' && <nav className="flex min-w-0 gap-5" aria-label="Profile sections">
        {[
          { to: '/account', label: 'My account', Icon: UserRound, current: !academic },
          { to: '/profile', label: 'Academic profile', Icon: GraduationCap, current: academic },
        ].map(({ to, label, Icon, current }) => <Link key={to} to={to} aria-current={current ? 'page' : undefined}
          className={`flex min-w-0 items-center gap-2 border-b-2 pb-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${current ? 'border-primary text-primary' : 'border-transparent text-base-content/65 hover:text-base-content'}`}>
          <Icon className="shrink-0" size={17} aria-hidden="true" /><span>{label}</span>
        </Link>)}
      </nav>}
    </div>
  )
}
