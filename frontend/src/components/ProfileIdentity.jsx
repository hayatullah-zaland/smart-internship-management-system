import { USER_ROLES } from '../context/userApi'
import ProfileAvatar from './ProfileAvatar'

export default function ProfileIdentity({ user, children }) {
  return (
    <aside className="min-w-0 border-b border-base-300 pb-7 md:border-r md:border-b-0 md:pr-7 md:pb-0" aria-label="Profile identity">
      <div className="flex min-w-0 items-center gap-4 md:flex-col md:gap-5 md:text-center">
        <ProfileAvatar user={user} className="size-24 border-4 border-base-100 text-3xl ring-1 ring-base-300" />
        <div className="min-w-0">
          <p className="break-words text-base font-semibold leading-6">{user.name}</p>
          <span className="mt-2 inline-block max-w-full rounded-md bg-info/10 px-2 py-1 text-xs font-medium text-info">{USER_ROLES[user.role]}</span>
          <p className="mt-3 break-all text-xs leading-5 text-base-content/65">{user.email}</p>
        </div>
      </div>
      {children && <div className="mt-5">{children}</div>}
    </aside>
  )
}
