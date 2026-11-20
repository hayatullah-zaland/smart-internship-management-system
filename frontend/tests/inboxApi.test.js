import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchInbox, markInboxRead } from '../src/context/inboxApi.js'

const user = { id: '000000000000000000000001', role: 'student' }
const through = '2026-11-19T08:00:00.000Z'
const event = { id: 'daily-feedback:000000000000000000000010:1795071600000', title: 'Daily report feedback', body: 'Teacher: Explain the work.',
  href: '/daily-reports', occurredAt: '2026-11-19T07:00:00.000Z', read: false }
const data = () => ({ userId: user.id, role: user.role, through, messages: [{ ...event }], notifications: [], unread: { messages: 1, notifications: 0 } })
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('inbox uses a cancellable bearer request and confirms the current account, role and unread counts', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/inbox'); assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer token'); assert.equal(options.cache, 'no-store')
    assert.equal(options.body, undefined); assert.ok(options.signal instanceof AbortSignal)
    return response({ success: true, data: data() })
  })
  assert.deepEqual(await fetchInbox('token', user), data())
})

test('wrong-account and wrong-role activity cannot enter the navbar', async (t) => {
  let current = data()
  t.mock.method(globalThis, 'fetch', async () => response({ success: true, data: current }))
  for (const change of [{ userId: '000000000000000000000002' }, { role: 'admin' }, { through: 'bad' }]) {
    current = { ...data(), ...change }
    await assert.rejects(fetchInbox('token', user), /invalid account data/)
  }
})

test('malformed, duplicate, out-of-order and external-link activity is rejected', async (t) => {
  let current
  t.mock.method(globalThis, 'fetch', async () => response({ success: true, data: current }))
  const invalid = [null, {}, { ...event, id: 'bad' }, { ...event, title: '' }, { ...event, body: 'x'.repeat(1201) },
    { ...event, href: 'https://example.com' }, { ...event, href: 'javascript:alert(1)' }, { ...event, href: '/admin/users' },
    { ...event, read: 'false' }, { ...event, occurredAt: 'bad' }, { ...event, occurredAt: '2099-01-01T00:00:00.000Z' }]
  for (const item of invalid) {
    current = { ...data(), messages: [item] }
    await assert.rejects(fetchInbox('token', user), /invalid activity data/)
  }
  for (const changes of [{ messages: [event, event] }, { messages: Array(31).fill(event) }, { unread: { messages: 0, notifications: 0 } },
    { messages: [event, { ...event, id: 'daily-feedback:000000000000000000000011:1795071600001', occurredAt: through }], unread: { messages: 2, notifications: 0 } }]) {
    current = { ...data(), ...changes }
    await assert.rejects(fetchInbox('token', user), /invalid activity data/)
  }
})

test('each role can receive only permitted notification destinations and only students receive feedback', async (t) => {
  let current
  t.mock.method(globalThis, 'fetch', async () => response({ success: true, data: current }))
  for (const [role, href] of [['student', '/weekly-reports'], ['admin', '/admin/applications'], ['academic_supervisor', '/daily-reports'], ['company_representative', '/evaluations']]) {
    current = { ...data(), role, messages: [], notifications: [{ ...event, href }], unread: { messages: 0, notifications: 1 } }
    assert.equal((await fetchInbox('token', { ...user, role })).notifications.length, 1)
    if (role !== 'student') {
      current = { ...current, messages: [event], unread: { messages: 1, notifications: 1 } }
      await assert.rejects(fetchInbox('token', { ...user, role }), /invalid activity data/)
    }
  }
})

test('marking read sends only the selected channel and displayed snapshot and confirms a monotonic cursor', async (t) => {
  let returned = through
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/inbox/read'); assert.equal(options.method, 'PATCH')
    assert.deepEqual(JSON.parse(options.body), { channel: 'messages', through })
    return response({ success: true, data: { channel: 'messages', readAt: returned } })
  })
  assert.equal(await markInboxRead('token', 'messages', through), through)
  returned = '2026-11-19T08:00:01.000Z'
  assert.equal(await markInboxRead('token', 'messages', through), returned)
  for (const value of ['2026-11-19T07:59:59.000Z', 'bad', null]) {
    returned = value
    await assert.rejects(markInboxRead('token', 'messages', through), /could not be confirmed/)
  }
})

test('invalid account, channel and snapshot inputs cannot send requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const account of [null, { ...user, id: 'bad' }, { ...user, role: '__proto__' }]) await assert.rejects(fetchInbox('token', account))
  await assert.rejects(fetchInbox('', user), (error) => error.status === 401)
  await assert.rejects(markInboxRead('token', 'all', through))
  await assert.rejects(markInboxRead('token', 'messages', 'bad'))
  assert.equal(fetch.mock.callCount(), 0)
})

test('expired sessions, API failures and uncertain read writes remain failures', async (t) => {
  let current
  t.mock.method(globalThis, 'fetch', async () => { if (current instanceof Error) throw current; return current })
  for (const value of [response({}, 401), new Response('Unauthorized', { status: 401 })]) {
    current = value
    await assert.rejects(fetchInbox('token', user), (error) => error.status === 401)
  }
  current = response({ success: false, message: 'Inbox unavailable.' }, 500)
  await assert.rejects(fetchInbox('token', user), /Inbox unavailable/)
  current = new TypeError('Connection lost')
  await assert.rejects(markInboxRead('token', 'messages', through), /Connection lost/)
})

test('inbox requests retain caller cancellation and the shared timeout', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })))
  const controller = new AbortController()
  const pending = fetchInbox('token', user, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
})
