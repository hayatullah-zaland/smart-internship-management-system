import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createManagedUser, fetchManagedUsers, MAX_USERS_PAGE, updateManagedUserStatus, USER_ROLES, USERS_PAGE_SIZE, validateManagedUser } from '../src/context/userApi.js'

const id = '507f1f77bcf86cd799439011'
const user = { id, name: 'Test Teacher', email: 'teacher@example.com', role: 'academic_supervisor', isActive: true }
const listed = { _id: id, name: user.name, email: user.email, role: user.role, isActive: true, createdAt: '2026-11-16T22:00:00.000Z' }
const values = { name: ' Test Teacher ', email: ' TEACHER@example.com ', role: user.role, password: 'test-only-password', confirmPassword: 'test-only-password' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const listResponse = (users = [listed], page = 1, limit = USERS_PAGE_SIZE) => json({ success: true, data: { users, page, limit } })
const savedResponse = (account = user) => json({ success: true, data: { user: account } }, 201)

test('managed user validation accepts all four explicitly selected roles and backend name bounds', () => {
  for (const role of Object.keys(USER_ROLES)) {
    assert.deepEqual(validateManagedUser({ ...values, role }), {})
  }
  for (const name of ['AB', 'A'.repeat(100), '  Test Teacher  ']) {
    assert.deepEqual(validateManagedUser({ ...values, name }), {})
  }
  for (const name of ['', ' ', 'X', 'A'.repeat(101), null, 123]) assert.ok(validateManagedUser({ ...values, name }).name)
  for (const role of ['', 'teacher', '__proto__', 'toString', null]) assert.ok(validateManagedUser({ ...values, role }).role)
})

test('email and matching-password validation reject invalid input without trimming passwords', () => {
  for (const email of ['', 'abc', 'a@@example.com', 'a b@example.com', 'a@', 'x'.repeat(250) + '@example.com', null]) {
    assert.ok(validateManagedUser({ ...values, email }).email)
  }
  for (const password of ['', 'short', null, 123]) assert.ok(validateManagedUser({ ...values, password }).password)
  for (const confirmPassword of ['', null, 'different-password']) assert.ok(validateManagedUser({ ...values, confirmPassword }).confirmPassword)
  const password = '  test password  '
  assert.deepEqual(validateManagedUser({ ...values, password, confirmPassword: password }), {})
  assert.ok(validateManagedUser({ ...values, password, confirmPassword: password.trim() }).confirmPassword)
})

test('password validation counts UTF-8 bytes rather than only characters', () => {
  for (const password of ['x'.repeat(8), 'x'.repeat(72), '\u0627'.repeat(36)]) {
    assert.deepEqual(validateManagedUser({ ...values, password, confirmPassword: password }), {})
  }
  for (const password of ['x'.repeat(73), '\u0627'.repeat(37)]) {
    assert.ok(validateManagedUser({ ...values, password, confirmPassword: password }).password)
  }
})

test('user list uses authenticated server pagination and returns only safe account fields', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/users?page=2&limit=10')
    assert.equal(options.method, 'GET')
    assert.equal(options.body, undefined)
    assert.equal(options.headers.Authorization, 'Bearer admin-token')
    assert.equal(options.cache, 'no-store')
    return listResponse([{ ...listed, passwordHash: 'must-not-be-retained' }], 2)
  })
  assert.deepEqual(await fetchManagedUsers('admin-token', 2), { users: [{ ...user, createdAt: listed.createdAt }], hasNextPage: false })
})

test('full, empty and maximum pages never invent totals or users', async (t) => {
  let batch = []
  let page = 1
  t.mock.method(globalThis, 'fetch', async () => listResponse(batch, page))
  assert.deepEqual(await fetchManagedUsers('token'), { users: [], hasNextPage: false })
  batch = Array.from({ length: USERS_PAGE_SIZE }, (_, index) => ({ ...listed, _id: index.toString(16).padStart(24, '0') }))
  assert.equal((await fetchManagedUsers('token')).hasNextPage, true)
  page = MAX_USERS_PAGE
  assert.equal((await fetchManagedUsers('token', page)).hasNextPage, false)
})

test('invalid pagination and missing tokens never make requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const page of [0, -1, 1.5, '1', NaN, MAX_USERS_PAGE + 1]) await assert.rejects(fetchManagedUsers('token', page))
  for (const token of ['', null, undefined, 123]) {
    await assert.rejects(fetchManagedUsers(token), (error) => error.status === 401)
    await assert.rejects(createManagedUser(token, values), (error) => error.status === 401)
    await assert.rejects(updateManagedUserStatus(token, user, false), (error) => error.status === 401)
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('malformed list metadata, duplicate identities and invalid accounts are rejected', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  const badAccounts = [null, { ...listed, _id: 'invalid' }, { ...listed, name: '' }, { ...listed, email: 'invalid' },
    { ...listed, role: 'teacher' }, { ...listed, isActive: 'true' }, { ...listed, createdAt: null }, { ...listed, createdAt: 'invalid' }]
  for (const body of [
    { users: null, page: 1, limit: 10 }, { users: [listed], page: 2, limit: 10 }, { users: [listed], page: 1, limit: 20 },
    { users: Array(11).fill(listed), page: 1, limit: 10 }, { users: [listed, listed], page: 1, limit: 10 },
    ...badAccounts.map((account) => ({ users: [account], page: 1, limit: 10 })),
  ]) {
    response = json({ success: true, data: body })
    await assert.rejects(fetchManagedUsers('token'), /invalid user data/)
  }
})

test('create sends only normalized identity, chosen role and unchanged password to the admin endpoint', async (t) => {
  const password = '  test password  '
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/auth/create-user')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer admin-token')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), { name: user.name, email: user.email, role: user.role, password })
    return savedResponse({ ...user, token: 'must-not-replace-admin', passwordHash: 'must-not-be-retained' })
  })
  assert.deepEqual(await createManagedUser('admin-token', { ...values, password, confirmPassword: password, isActive: false, id: 'chosen-id' }), user)
})

test('each supported chosen role is confirmed without falling back to public student signup', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/auth/create-user')
    return savedResponse({ ...user, role: JSON.parse(options.body).role })
  })
  for (const role of Object.keys(USER_ROLES)) assert.equal((await createManagedUser('token', { ...values, role })).role, role)
})

test('invalid create forms never send requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const changed of [{ name: '' }, { email: 'invalid' }, { role: '' }, { password: 'short' }, { confirmPassword: 'different' }]) {
    await assert.rejects(createManagedUser('token', { ...values, ...changed }))
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('creation never confirms mismatched identity, role, status or malformed response data', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const account of [null, { ...user, id: 'bad' }, { ...user, name: 'Someone Else' }, { ...user, email: 'other@example.com' },
    { ...user, role: 'student' }, { ...user, isActive: false }, { ...user, isActive: undefined }]) {
    response = savedResponse(account)
    await assert.rejects(createManagedUser('token', values), /could not be confirmed/)
  }
})

test('status changes send only the explicit boolean and confirm the same account and role', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/v1/users/${id}/status`)
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer token')
    assert.deepEqual(JSON.parse(options.body), { isActive: false })
    return savedResponse({ ...user, isActive: false })
  })
  assert.deepEqual(await updateManagedUserStatus('token', user, false), { ...user, isActive: false })
})

test('inactive accounts can be activated without changing role or identity', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { isActive: true })
    return savedResponse(user)
  })
  assert.deepEqual(await updateManagedUserStatus('token', { ...user, isActive: false }, true), user)
})

test('admin status, unchanged status and malformed targets cannot send writes', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const account of [null, { ...user, id: 'bad' }, { ...user, role: 'admin' }]) await assert.rejects(updateManagedUserStatus('token', account, false))
  for (const status of [true, 'false', null, 0]) await assert.rejects(updateManagedUserStatus('token', user, status))
  assert.equal(fetch.mock.callCount(), 0)
})

test('wrong-account, wrong-role and unchanged-status responses cannot confirm a status write', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const account of [null, { ...user, isActive: false, id: '507f1f77bcf86cd799439012' },
    { ...user, isActive: false, role: 'admin' }, user, { ...user, isActive: 'false' }]) {
    response = savedResponse(account)
    await assert.rejects(updateManagedUserStatus('token', user, false), /could not be confirmed/)
  }
})

test('duplicates, permission failures, missing accounts and server errors preserve backend status/messages', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => json({ success: false, message: 'Backend rejected this request.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    for (const action of [() => fetchManagedUsers('token'), () => createManagedUser('token', values), () => updateManagedUserStatus('token', user, false)]) {
      await assert.rejects(action(), (error) => error.status === code && error.message === 'Backend rejected this request.')
    }
  }
})

test('JSON and non-JSON 401 responses request sign-in for all account operations', async (t) => {
  let html = false
  t.mock.method(globalThis, 'fetch', async () => html ? new Response('Unauthorized', { status: 401 }) : json({ success: false }, 401))
  for (const value of [false, true]) {
    html = value
    for (const action of [() => fetchManagedUsers('token'), () => createManagedUser('token', values), () => updateManagedUserStatus('token', user, false)]) {
      await assert.rejects(action(), (error) => error.status === 401)
    }
  }
})

test('malformed responses and uncertain networks never succeed or automatically repeat writes', async (t) => {
  let mode = 'html'
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    if (mode === 'network') throw new TypeError('Connection lost')
    if (mode === 'html') return new Response('Bad gateway', { status: 502 })
    if (mode === 'syntax') return new Response('{invalid', { headers: { 'Content-Type': 'application/json' } })
    return json({ success: 'true', data: { user } })
  })
  for (const value of ['html', 'syntax', 'false-success', 'network']) {
    mode = value
    const before = fetch.mock.callCount()
    await assert.rejects(createManagedUser('token', values))
    await assert.rejects(updateManagedUserStatus('token', user, false))
    assert.equal(fetch.mock.callCount(), before + 2)
  }
})

test('list and writes support page/account cancellation and retain the shared timeout', async (t) => {
  const durations = []
  t.mock.method(AbortSignal, 'timeout', (duration) => {
    durations.push(duration)
    return new AbortController().signal
  })
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) reject(options.signal.reason)
    else options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  for (const action of [(signal) => fetchManagedUsers('token', 1, signal),
    (signal) => createManagedUser('token', values, signal), (signal) => updateManagedUserStatus('token', user, false, signal)]) {
    const controller = new AbortController()
    const request = action(controller.signal)
    controller.abort()
    await assert.rejects(request, { name: 'AbortError' })
  }
  assert.deepEqual(durations, [15000, 15000, 15000])
})
