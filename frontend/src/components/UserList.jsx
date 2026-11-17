import { ChevronLeft, ChevronRight, RotateCw, TriangleAlert, UsersRound } from 'lucide-react'
import { USER_ROLES } from '../context/userApi'

const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kabul', year: 'numeric', month: 'short', day: '2-digit' })

export default function UserList({ users, page, hasNextPage, loading, error, disabled, onRefresh, onPageChange, renderActions }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="users-heading" aria-busy={loading || disabled}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="users-heading" className="text-base font-semibold">Registered users</h2>
        <button className="btn btn-ghost btn-square btn-sm" type="button" disabled={loading || disabled} onClick={onRefresh}
          aria-label="Refresh users" title="Refresh users"><RotateCw size={17} aria-hidden="true" /></button>
      </div>
      {loading ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Loading users...
      </p> : error ? <div role="alert" className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
        <div className="min-w-0"><p className="text-sm font-semibold">Unable to load users</p>
          <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{error}</p>
          <button className="btn btn-outline btn-sm mt-3" type="button" disabled={disabled} onClick={onRefresh}><RotateCw size={15} aria-hidden="true" /> Retry</button>
        </div>
      </div> : !users.length ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <UsersRound size={21} className="shrink-0" aria-hidden="true" /> {page === 1 ? 'No users yet.' : 'No users on this page.'}
      </p> : <ul className="divide-y divide-base-300">
        {users.map((account) => <li key={account.id} className="grid min-w-0 gap-4 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)]">
          <div className="min-w-0"><h3 className="break-words text-sm font-semibold">{account.name}</h3>
            <p className="mt-1 break-all text-sm leading-6 text-base-content/70">{account.email}</p>
            <p className="mt-2 text-xs leading-5 text-base-content/60">Joined <time dateTime={account.createdAt}>{dateFormatter.format(new Date(account.createdAt))} Kabul</time></p>
          </div>
          <p className="min-w-0 break-words text-sm leading-6">{USER_ROLES[account.role]}</p>
          <div className="min-w-0">
            <p className="mb-3 text-xs text-base-content/65">Saved status: {account.isActive ? 'Active' : 'Inactive'}</p>
            {renderActions?.(account)}
          </div>
        </li>)}
      </ul>}
      <nav className="mt-6 flex items-center justify-center gap-2" aria-label="User pages">
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page - 1)} disabled={loading || disabled || page <= 1}
          aria-label="Previous page" title="Previous page"><ChevronLeft size={18} aria-hidden="true" /></button>
        <span className="w-32 text-center text-sm tabular-nums" aria-current="page">Page {page}</span>
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page + 1)} disabled={loading || disabled || Boolean(error) || !hasNextPage}
          aria-label="Next page" title="Next page"><ChevronRight size={18} aria-hidden="true" /></button>
      </nav>
    </section>
  )
}
