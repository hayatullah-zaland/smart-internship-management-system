import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server, AuthProvider, AuthContext
const account = { id: '507f1f77bcf86cd799439011', name: 'Test Student', email: 'student@example.com', role: 'student', isActive: true }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  AuthProvider = (await server.ssrLoadModule('/src/context/AuthProvider.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
})
after(async () => { await server?.close() })

function session(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const stored = new Map()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage: {
    getItem(key) { return stored.get(key) ?? null }, setItem(key, value) { stored.set(key, value) }, removeItem(key) { stored.delete(key) },
  } } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window })
  let context
  function Capture() { context = useContext(AuthContext); return h('p', null, 'Session probe') }
  renderToStaticMarkup(h(AuthProvider, null, h(Capture)))
  return { context, stored }
}

test('sign-in rejects non-boolean success without storing a token', async (t) => {
  const { context, stored } = session(t)
  t.mock.method(globalThis, 'fetch', async () => json({ success: 'false', data: { user: account, token: 'test-token' } }))
  await assert.rejects(context.signIn(account.email, 'test-only-password'))
  assert.equal(stored.size, 0)
})

test('sign-in verifies the returned email before changing the saved session', async (t) => {
  const { context, stored } = session(t)
  t.mock.method(globalThis, 'fetch', async () => json({ success: true, data: { user: { ...account, email: 'other@example.com' }, token: 'test-token' } }))
  await assert.rejects(context.signIn(account.email, 'test-only-password'))
  assert.equal(stored.size, 0)
})

test('successful sign-in retains only the token and sends normalized credentials without a role', async (t) => {
  const { context, stored } = session(t)
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/auth/signin')
    assert.deepEqual(JSON.parse(options.body), { email: account.email, password: 'test-only-password' })
    return json({ success: true, data: { user: account, token: 'test-token' } })
  })
  await context.signIn(' STUDENT@example.com ', 'test-only-password')
  assert.deepEqual([...stored.entries()], [['sims-access-token', 'test-token']])
})

test('signup rejects malformed, inactive, wrong-role and mismatched accounts instead of showing created', async (t) => {
  const { context, stored } = session(t)
  let result
  t.mock.method(globalThis, 'fetch', async () => json(result, 201))
  for (const body of [{ success: 'true', data: { user: account } }, { success: true, data: { user: {} } },
    { success: true, data: { user: { ...account, role: 'admin' } } }, { success: true, data: { user: { ...account, isActive: false } } },
    { success: true, data: { user: { ...account, email: 'other@example.com' } } },
    { success: true, data: { user: { ...account, name: 'Other Student' } } }]) {
    result = body
    await assert.rejects(context.signUp(account.name, account.email, 'test-only-password'))
  }
  assert.equal(stored.size, 0)
})

test('a confirmed public signup remains student-only and never signs in automatically', async (t) => {
  const { context, stored } = session(t)
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/auth/signup')
    assert.deepEqual(JSON.parse(options.body), { name: account.name, email: account.email, password: 'test-only-password' })
    return json({ success: true, data: { user: account } }, 201)
  })
  await context.signUp(' Test Student ', ' STUDENT@example.com ', 'test-only-password')
  assert.equal(stored.size, 0)
  assert.equal(context.user, null)
})

test('auth errors preserve backend messages and invalid responses never write browser storage', async (t) => {
  const { context, stored } = session(t)
  let mode
  t.mock.method(globalThis, 'fetch', async () => {
    if (mode === 'network') throw new TypeError('Connection lost')
    if (mode === 'html') return new Response('Bad gateway', { status: 502 })
    if (mode === 'syntax') return new Response('{invalid', { headers: { 'Content-Type': 'application/json' } })
    if (mode === 'null') return json(null)
    return json({ success: false, message: 'Account unavailable.' }, 403)
  })
  for (const value of ['network', 'html', 'syntax', 'null', 'forbidden']) {
    mode = value
    for (const action of [() => context.signIn(account.email, 'test-only-password'), () => context.signUp(account.name, account.email, 'test-only-password')]) {
      await assert.rejects(action(), value === 'forbidden' ? /Account unavailable/ : undefined)
    }
  }
  assert.equal(stored.size, 0)
})
