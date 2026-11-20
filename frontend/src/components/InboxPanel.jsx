import { Bell, CheckCheck, MessageSquare, RotateCw, X } from 'lucide-react'
import { Link } from 'react-router'

const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kabul', dateStyle: 'medium', timeStyle: 'short' })

export default function InboxPanel({ channel, data, loading, error, saving, writeError, onClose, onRefresh, onMarkRead }) {
  const messages = channel === 'messages'
  const title = messages ? 'Messages' : 'Notifications'
  const Icon = messages ? MessageSquare : Bell
  const items = data?.[channel] || []
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-base-300 p-4">
        <h2 id="inbox-heading" className="flex items-center gap-2 text-base font-semibold"><Icon size={19} aria-hidden="true" />{title}</h2>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-square btn-sm" type="button" aria-label="Refresh inbox" title="Refresh inbox"
            disabled={loading || saving} onClick={onRefresh}><RotateCw size={18} aria-hidden="true" /></button>
          <button className="btn btn-ghost btn-square btn-sm" type="button" aria-label="Mark all read" title="Mark all read"
            disabled={loading || saving || Boolean(error) || !data?.unread[channel]} onClick={onMarkRead}>
            {saving ? <span className="loading loading-spinner loading-xs" aria-hidden="true" /> : <CheckCheck size={18} aria-hidden="true" />}
          </button>
          <button className="btn btn-ghost btn-square btn-sm" type="button" aria-label="Close inbox" title="Close inbox" autoFocus onClick={onClose}><X size={19} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain" aria-busy={loading || saving}>
        {writeError && <p role="alert" className="m-4 break-words text-sm leading-6 text-error">{writeError}</p>}
        {error ? <div className="p-5"><p role="alert" className="break-words text-sm leading-6 text-error">{error}</p>
          <button type="button" className="btn btn-outline btn-sm mt-3" onClick={onRefresh} disabled={loading}><RotateCw size={16} aria-hidden="true" /> Retry</button></div>
          : !data ? <p role="status" className="p-5 text-sm text-base-content/75">Loading {channel}...</p>
            : items.length === 0 ? <p className="p-6 text-sm text-base-content/75">No {channel} yet.</p>
              : <ul className="divide-y divide-base-300" aria-label={`${title} activity`}>
                {items.map((item) => <li key={item.id}>
                  <Link to={item.href} onClick={onClose} className={`block min-w-0 p-4 hover:bg-base-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${item.read ? '' : 'bg-primary/5'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? 'bg-base-300' : 'bg-primary'}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <span className="sr-only">{item.read ? 'Read.' : 'Unread.'}</span>
                        <h3 className="break-words text-sm leading-6 font-semibold">{item.title}</h3>
                        <p className="mt-1 break-words text-sm leading-6 whitespace-pre-wrap">{item.body}</p>
                        <time dateTime={item.occurredAt} className="mt-2 block text-xs leading-5 text-base-content/65">{formatter.format(new Date(item.occurredAt))} Kabul</time>
                      </div>
                    </div>
                  </Link>
                </li>)}
              </ul>}
      </div>
      {data && !error && <p className="shrink-0 border-t border-base-300 px-4 py-3 text-xs text-base-content/65">Recent {channel} ({items.length}/30)</p>}
    </>
  )
}
