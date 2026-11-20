import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, InboxPanel
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  InboxPanel = (await server.ssrLoadModule('/src/components/InboxPanel.jsx')).default
})
after(async () => { await server?.close() })
const props = { channel: 'messages', data: null, loading: false, error: '', saving: false, writeError: '', onClose() {}, onRefresh() {}, onMarkRead() {} }
const render = (changes = {}) => renderToStaticMarkup(h(MemoryRouter, null, h(InboxPanel, { ...props, ...changes })))

test('inbox exposes named refresh, mark-read and close commands without a chat composer', () => {
  const html = render()
  for (const name of ['Refresh inbox', 'Mark all read', 'Close inbox']) assert.ok(html.includes(`aria-label="${name}"`))
  assert.doesNotMatch(html, /<form|<textarea|Send message|<input/)
  assert.match(html, /Loading messages/)
  assert.match(html, /disabled=""/)
})

test('empty, failed and loading inboxes do not invent activity', () => {
  assert.match(render({ data: { messages: [], unread: { messages: 0 } } }), /No messages yet/)
  assert.match(render({ channel: 'notifications', data: { notifications: [], unread: { notifications: 0 } } }), /No notifications yet/)
  const failed = render({ error: 'Cannot load inbox.' })
  assert.match(failed, /role="alert"/); assert.match(failed, /Retry/); assert.doesNotMatch(failed, /No messages yet/)
})

test('feedback is escaped, retains long text and shows an actual Kabul timestamp and read state', () => {
  const message = { id: 'one', title: 'Teacher feedback', body: '<script>unsafe</script>\n' + 'LongFeedback'.repeat(80), href: '/daily-reports', occurredAt: '2026-11-19T08:00:00.000Z', read: false }
  const html = render({ data: { messages: [message], unread: { messages: 1 } } })
  assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/); assert.doesNotMatch(html, /<script>/)
  assert.match(html, /href="\/daily-reports"/); assert.match(html, /12:30 PM/)
  assert.match(html, /Unread\./); assert.match(html, /break-words/); assert.match(html, /whitespace-pre-wrap/)
  assert.match(render({ data: { messages: [{ ...message, read: true }], unread: { messages: 0 } } }), /Read\./)
})
