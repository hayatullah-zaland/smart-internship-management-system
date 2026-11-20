import { useContext } from 'react'
import { Moon, Sun, SunMoon, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { ThemeContext } from '../context/ThemeContext'
import DashboardLayout from '../components/DashboardLayout'
import PasswordSettings from '../components/PasswordSettings'
import ProfileAvatar from '../components/ProfileAvatar'

export default function Settings() {
  const { user, token } = useContext(AuthContext)
  const { theme, toggleTheme } = useContext(ThemeContext)
  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7">
        <p className="mb-2 text-sm font-medium text-primary">Preferences</p>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>
      <section className="grid min-w-0 gap-6 border-b border-base-300 py-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-8" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="flex items-start gap-2.5 text-base font-semibold"><SunMoon size={19} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />Appearance</h2>
        <fieldset className="min-w-0 max-w-xl">
          <legend className="mb-5 text-sm font-semibold">Color theme</legend>
          <div className="grid grid-cols-2 gap-3">
            {[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([value, label, Icon]) => <label key={value}
              className={`flex min-h-14 min-w-0 cursor-pointer flex-wrap items-center gap-2 rounded-md border p-3 text-sm font-medium sm:gap-3 sm:p-4 ${theme === value ? 'border-primary bg-primary/5' : 'border-base-300 bg-base-100'}`}>
              <input className="radio radio-primary radio-sm shrink-0" type="radio" name="colorTheme" value={value} checked={theme === value}
                onChange={() => { if (theme !== value) toggleTheme() }} />
              <Icon size={18} className="shrink-0" aria-hidden="true" />{label}
            </label>)}
          </div>
        </fieldset>
      </section>
      <PasswordSettings key={`${user.id}:${token}`} />
      <section className="grid min-w-0 gap-6 py-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-8" aria-labelledby="settings-account-heading">
        <h2 id="settings-account-heading" className="flex items-start gap-2.5 text-base font-semibold"><UserRound size={19} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />Account</h2>
        <div className="min-w-0 max-w-xl">
          <div className="flex min-w-0 items-center gap-3">
            <ProfileAvatar user={user} className="size-11 shrink-0 text-sm" />
            <div className="min-w-0"><p className="break-words text-sm font-semibold">{user.name}</p><p className="mt-1 break-all text-sm leading-6 text-base-content/70">{user.email}</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/account" className="btn btn-outline min-h-11"><UserRound size={17} aria-hidden="true" />Edit my account</Link>
            {user.role === 'student' && <Link to="/profile" className="btn btn-ghost min-h-11">My academic profile</Link>}
          </div>
        </div>
      </section>
    </DashboardLayout>
  )
}
