import { BookOpenCheck, Building2, GraduationCap, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { USER_ROLES } from '../context/userApi'
import ProfileAvatar from './ProfileAvatar'

const roles = {
  student: { short: 'Student', Icon: GraduationCap, color: 'text-primary' },
  admin: { short: 'Admin', Icon: ShieldCheck, color: 'text-secondary' },
  academic_supervisor: { short: 'Teacher', Icon: BookOpenCheck, color: 'text-info' },
  company_representative: { short: 'Company', Icon: Building2, color: 'text-primary' },
}

export default function NavbarAccount({ user }) {
  const { short, Icon, color } = roles[user.role] || roles.student
  const role = USER_ROLES[user.role] || user.role
  return (
    <Link to="/account" aria-label="Open my account" aria-describedby="navbar-account-identity" title={`${user.name} - ${role}`}
      className="flex min-w-0 items-center gap-2 rounded-md border border-transparent bg-base-200/60 p-1.5 hover:border-base-300 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:gap-3">
      <ProfileAvatar user={user} className="size-8 bg-primary/10 text-sm text-primary ring-2 ring-base-100 sm:size-10" />
      <span id="navbar-account-identity" className="sr-only">{user.name}, {role}</span>
      <span className="w-14 min-w-0 sm:w-28 xl:w-36" aria-hidden="true">
        <span className="block truncate text-xs leading-5 font-semibold sm:text-sm" title={user.name}>{user.name}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-4 text-base-content/70" title={role}>
          <Icon size={13} className={`hidden shrink-0 sm:block ${color}`} aria-hidden="true" />
          <span className="truncate sm:hidden">{short}</span><span className="hidden truncate sm:block">{role}</span>
        </span>
      </span>
    </Link>
  )
}
