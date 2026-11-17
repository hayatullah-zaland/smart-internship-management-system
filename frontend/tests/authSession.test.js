import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearSessionToken, fetchSessionUser, isValidSessionUser, readSessionToken, saveSessionToken } from '../src/context/authSession.js'

const user = { id: 'student-id', name: 'Test Student', email: 'student@example.com', role: 'student', isActive: true }

function mockStorage(t) {
  const values = new Map()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      },
    },
  })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else delete globalThis.window
  })
  return values
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

test('a saved token survives a new read and sign-out removes only the auth entry', (t) => {
  const values = mockStorage(t)
  values.set('unrelated-setting', 'keep')
  assert.equal(readSessionToken(), null)
  saveSessionToken('access-token')
  assert.equal(readSessionToken(), 'access-token')
  assert.deepEqual([...values.keys()].sort(), ['sims-access-token', 'unrelated-setting'])
  assert.equal(values.get('sims-access-token'), 'access-token')
  clearSessionToken()
  assert.equal(readSessionToken(), null)
  assert.equal(values.get('unrelated-setting'), 'keep')
})

test('empty storage entries and unavailable storage do not crash authentication', (t) => {
  const values = mockStorage(t)
  for (const value of ['', '   ']) {
    values.set('sims-access-token', value)
    assert.equal(readSessionToken(), null)
  }
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    t.mock.method(window.sessionStorage, method, () => { throw new Error('Storage blocked') })
  }
  assert.equal(readSessionToken(), null)
  assert.doesNotThrow(() => saveSessionToken('access-token'))
  assert.doesNotThrow(clearSessionToken)
})

test('session users must have current account fields, a supported role and active status', () => {
  for (const role of ['student', 'admin', 'academic_supervisor', 'company_representative']) {
    assert.equal(isValidSessionUser({ ...user, role }), true)
  }
  for (const invalid of [null, {}, [], { ...user, name: ' ' }, { ...user, email: null },
    { ...user, id: '' }, { ...user, role: 'owner' }, { ...user, isActive: false }]) {
    assert.equal(isValidSessionUser(invalid), false)
  }
})

test('restoration fetches the current user from /me with the saved bearer token', async (t) => {
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/auth/me')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer access-token')
    assert.equal(options.headers.Accept, 'application/json')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.body, undefined)
    assert.ok(options.signal instanceof AbortSignal)
    return jsonResponse({ success: true, data: { user } })
  })
  assert.deepEqual(await fetchSessionUser('access-token', controller.signal), user)
})

test('JSON and non-JSON 401 responses both invalidate the saved session', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const value of [jsonResponse({ success: false }, 401), new Response('Unauthorized', { status: 401 })]) {
    response = value
    await assert.rejects(fetchSessionUser('access-token', new AbortController().signal), (error) => error.status === 401)
  }
})

test('temporary server errors, forbidden responses and invalid data do not pretend to be logout', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const value of [
    jsonResponse({ success: false }, 500),
    jsonResponse({ success: false }, 403),
    new Response('Bad gateway', { status: 502 }),
    new Response('{bad json', { headers: { 'Content-Type': 'application/json' } }),
    jsonResponse(null),
    jsonResponse({ success: 'true', data: { user } }),
    jsonResponse({ success: true, data: { user: { ...user, role: 'owner' } } }),
    jsonResponse({ success: true, data: {} }),
  ]) {
    response = value
    await assert.rejects(fetchSessionUser('access-token', new AbortController().signal),
      (error) => error.status !== 401 && /Unable to check your session/.test(error.message))
  }
})

test('network errors remain retryable and request cancellation is forwarded', async (t) => {
  const controller = new AbortController()
  let requestSignal
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requestSignal = options.signal
    throw new TypeError('Network unavailable')
  })
  await assert.rejects(fetchSessionUser('access-token', controller.signal), TypeError)
  assert.equal(requestSignal.aborted, false)
  controller.abort()
  assert.equal(requestSignal.aborted, true)
})

test('session verification has a 15-second timeout', async (t) => {
  const timeout = new AbortController()
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return timeout.signal
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    timeout.abort(new DOMException('Timed out', 'TimeoutError'))
    options.signal.throwIfAborted()
  })
  await assert.rejects(fetchSessionUser('access-token', new AbortController().signal), { name: 'TimeoutError' })
})
