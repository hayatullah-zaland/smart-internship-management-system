import { Building2, GraduationCap, Presentation, ShieldCheck, UsersRound } from 'lucide-react'
import { Link } from 'react-router'

const categories = [
  { role: '', label: 'All accounts', Icon: UsersRound },
  { role: 'student', label: 'Students', Icon: GraduationCap },
  { role: 'academic_supervisor', label: 'Teachers', Icon: Presentation },
  { role: 'admin', label: 'Admins', Icon: ShieldCheck },
  { role: 'company_representative', label: 'Company accounts', Icon: Building2 },
]

export default function UserCategories({ role = '', disabled = false }) {
  return (
    <nav aria-label="Account categories" className="border-b border-base-300 py-5">
      <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {categories.map((category) => (
          <li key={category.role} className={category.role === '' ? 'col-span-2 sm:col-auto' : 'min-w-0'}>
            <Link to={category.role ? `/admin/users?role=${category.role}` : '/admin/users'}
              aria-current={role === category.role ? 'page' : undefined}
              aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined}
              onClick={(event) => { if (disabled) event.preventDefault() }}
              className={`flex h-full min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${role === category.role ? 'border-primary/35 bg-primary/10 text-primary' : 'border-base-300 bg-base-100 text-base-content/70 hover:border-primary/40 hover:text-base-content'} ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
              <category.Icon size={18} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words leading-5">{category.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
