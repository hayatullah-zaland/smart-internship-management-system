import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { USER_ROLES } from '../context/userApi'

export default function UserForm({ values, errors, disabled, saving, showPassword, onTogglePassword, onChange, onSubmit }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="new-user-heading">
      <h2 id="new-user-heading" className="scroll-mt-44 text-base font-semibold">New user</h2>
      <form className="mt-6 max-w-3xl" onSubmit={onSubmit} noValidate aria-busy={saving}>
        <fieldset className="grid min-w-0 gap-6 sm:grid-cols-2" disabled={disabled || saving}>
          <legend className="sr-only">New account details</legend>
          {['name', 'email'].map((name) => <div key={name} className="min-w-0">
            <label className="mb-2 block text-sm font-medium" htmlFor={`user-${name}`}>{name === 'name' ? 'Full name' : 'Email address'}</label>
            <input id={`user-${name}`} name={name} type={name === 'email' ? 'email' : 'text'}
              className={`input w-full ${errors[name] ? 'input-error' : ''}`} autoComplete="off" required
              minLength={name === 'name' ? 2 : undefined} maxLength={name === 'name' ? 100 : 254}
              value={values[name]} onChange={onChange} aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `user-${name}-error` : undefined} />
            {errors[name] && <p id={`user-${name}-error`} className="mt-2 text-xs text-error">{errors[name]}</p>}
          </div>)}
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="user-role">Role</label>
            <select id="user-role" name="role" className={`select w-full sm:max-w-sm ${errors.role ? 'select-error' : ''}`}
              value={values.role} required onChange={onChange} aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? 'user-role-error' : undefined}>
              <option value="" disabled>Choose a role</option>
              {Object.entries(USER_ROLES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            {errors.role && <p id="user-role-error" className="mt-2 text-xs text-error">{errors.role}</p>}
            {values.role === 'admin' && <p role="status" className="mt-2 text-sm text-warning">This account will have administrator access.</p>}
          </div>
          {['password', 'confirmPassword'].map((name) => <div key={name} className="min-w-0">
            <label className="mb-2 block text-sm font-medium" htmlFor={`user-${name}`}>{name === 'password' ? 'Password' : 'Confirm password'}</label>
            <div className="relative">
              <input id={`user-${name}`} name={name} type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                className={`input w-full ${name === 'password' ? 'pr-12' : ''} ${errors[name] ? 'input-error' : ''}`}
                value={values[name]} onChange={onChange} required minLength={8} aria-invalid={Boolean(errors[name])}
                aria-describedby={errors[name] ? `user-${name}-error` : undefined} />
              {name === 'password' && <button className="btn btn-ghost btn-square btn-sm absolute top-1 right-1 z-10" type="button"
                disabled={disabled || saving} onClick={onTogglePassword} aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} title={showPassword ? 'Hide passwords' : 'Show passwords'}>
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>}
            </div>
            {errors[name] && <p id={`user-${name}-error`} className="mt-2 text-xs text-error">{errors[name]}</p>}
          </div>)}
        </fieldset>
        <button className="btn btn-primary mt-6 min-w-40" type="submit" disabled={disabled || saving}>
          {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Creating...</>
            : <><UserPlus size={18} aria-hidden="true" /> Create user</>}
        </button>
      </form>
    </section>
  )
}
