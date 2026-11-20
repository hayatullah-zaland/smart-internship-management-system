import { useContext, useEffect, useRef, useState } from 'react'
import { Bell, MessageSquare } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { fetchInbox, markInboxRead } from '../context/inboxApi'
import InboxPanel from './InboxPanel'

export default function InboxTools() {
  const { user, token, signOut } = useContext(AuthContext)
  return <InboxWorkspace key={`${user.id}:${token}`} user={user} token={token} signOut={signOut} />
}

function InboxWorkspace({ user, token, signOut }) {
  const { id, role } = user
  const [result, setResult] = useState({ data: null, loading: true, error: '' })
  const [channel, setChannel] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [saving, setSaving] = useState(false)
  const [writeError, setWriteError] = useState('')
  const dialogRef = useRef(null)
  const readRef = useRef(null)
  const writeRef = useRef(null)

  useEffect(() => {
    if (writeRef.current) return
    const controller = new AbortController()
    readRef.current = controller
    setResult((current) => ({ ...current, loading: true, error: '' }))
    fetchInbox(token, { id, role }, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ data, loading: false, error: '' })
    }).catch((error) => {
      if (controller.signal.aborted) return
      if (error.status === 401) return signOut()
      setResult({ data: null, loading: false, error: error.message || 'Unable to load the inbox. Please retry.' })
    })
    return () => controller.abort()
  }, [token, id, role, refresh, signOut])

  useEffect(() => {
    function update() { if (document.visibilityState === 'visible') setRefresh((count) => count + 1) }
    const interval = window.setInterval(update, 30000)
    window.addEventListener('focus', update)
    window.addEventListener('sims:inbox-refresh', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', update)
      window.removeEventListener('sims:inbox-refresh', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  useEffect(() => () => writeRef.current?.abort(), [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!channel) {
      if (dialog.open) dialog.close()
      return
    }
    if (!dialog.open) dialog.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [channel])

  async function markRead() {
    if (writeRef.current || result.loading || !result.data || !result.data.unread[channel]) return
    const controller = new AbortController()
    writeRef.current = controller
    readRef.current?.abort()
    setSaving(true)
    setWriteError('')
    try {
      const readAt = await markInboxRead(token, channel, result.data.through, controller.signal)
      if (controller.signal.aborted) return
      setResult((current) => {
        if (!current.data) return current
        const items = current.data[channel].map((item) => ({ ...item, read: item.read || item.occurredAt <= readAt }))
        return { ...current, data: { ...current.data, [channel]: items,
          unread: { ...current.data.unread, [channel]: items.filter((item) => !item.read).length } } }
      })
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) return signOut()
      setWriteError(error.message || 'The read status could not be confirmed. Refresh the inbox.')
    } finally {
      if (writeRef.current === controller) writeRef.current = null
      if (!controller.signal.aborted) {
        setSaving(false)
        setRefresh((count) => count + 1)
      }
    }
  }

  function open(next) {
    setWriteError('')
    setChannel(next)
    setRefresh((count) => count + 1)
  }

  return (
    <>
      {[['messages', MessageSquare, 'Messages'], ['notifications', Bell, 'Notifications']].map(([key, Icon, title]) => {
        const count = result.data?.unread[key] || 0
        return <div key={key} className="tooltip tooltip-bottom tooltip-end" data-tip={title}>
          <button className="btn btn-ghost btn-square relative" type="button" aria-label={title} aria-describedby={`${key}-count`}
            aria-haspopup="dialog" aria-controls="navbar-inbox" aria-expanded={channel === key} onClick={() => open(key)}>
            <Icon size={20} aria-hidden="true" />
            {count > 0 && <span aria-hidden="true" className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-bold text-primary-content tabular-nums">{count}</span>}
          </button>
          <span id={`${key}-count`} className="sr-only">{result.error ? `${title} unavailable` : result.data ? `${count} unread ${key}` : `Loading ${key}`}</span>
        </div>
      })}
      <dialog ref={dialogRef} id="navbar-inbox" aria-labelledby="inbox-heading" className="inbox-panel rounded-lg border border-base-300 bg-base-100 text-base-content shadow-xl"
        onClose={() => setChannel(null)} onClick={(event) => { if (event.target === event.currentTarget) setChannel(null) }}>
        <InboxPanel channel={channel || 'messages'} {...result} saving={saving} writeError={writeError}
          onClose={() => setChannel(null)} onRefresh={() => setRefresh((count) => count + 1)} onMarkRead={markRead} />
      </dialog>
    </>
  )
}
