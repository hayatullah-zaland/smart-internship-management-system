import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchAdminStudentProfiles, MAX_STUDENTS_PAGE, STUDENTS_PAGE_SIZE } from '../src/context/studentProfileApi.js'

const profile = { _id: '507f1f77bcf86cd799439011', studentNumber: 'STU-001', semester: 7, phone: '+93 700 123 456',
  user: { _id: '507f1f77bcf86cd799439012', name: 'Test Student', email: 'student@example.com', isActive: true },
  department: { _id: '507f1f77bcf86cd799439013', name: 'Computer Science', code: 'CS' } }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const response = (profiles = [profile], page = 1, limit = STUDENTS_PAGE_SIZE) => json({ success: true, data: { profiles, page, limit } })

test('admin student directory uses a read-only authenticated paginated request without identity filters', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/students?page=2&limit=10')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer admin-token')
    assert.equal(options.body, undefined)
    assert.equal(options.cache, 'no-store')
    return response([profile], 2)
  })
  assert.deepEqual(await fetchAdminStudentProfiles('admin-token', 2), { profiles: [profile], hasNextPage: false })
})

test('empty, full and maximum pages do not invent student accounts, counts or totals', async (t) => {
  let profiles = []
  let page = 1
  t.mock.method(globalThis, 'fetch', async () => response(profiles, page))
  assert.deepEqual(await fetchAdminStudentProfiles('token'), { profiles: [], hasNextPage: false })
  profiles = Array.from({ length: 10 }, (_, index) => ({ ...profile, _id: index.toString(16).padStart(24, '0') }))
  assert.equal((await fetchAdminStudentProfiles('token')).hasNextPage, true)
  page = MAX_STUDENTS_PAGE
  assert.equal((await fetchAdminStudentProfiles('token', page)).hasNextPage, false)
})

test('deleted user or department references remain null without losing academic records', async (t) => {
  let saved
  t.mock.method(globalThis, 'fetch', async () => response([saved]))
  for (const changes of [{ user: null }, { department: null }, { user: null, department: null }, { user: { ...profile.user, isActive: false } }]) {
    saved = { ...profile, ...changes }
    assert.deepEqual((await fetchAdminStudentProfiles('token')).profiles, [saved])
  }
})

test('the directory retains only displayed academic and populated reference fields', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response([{ ...profile, privateField: 'not-retained',
    user: { ...profile.user, passwordHash: 'not-retained', role: 'student' }, department: { ...profile.department, extra: 'not-retained' } }]))
  assert.deepEqual((await fetchAdminStudentProfiles('token')).profiles, [profile])
})

test('invalid pages and missing tokens never make a directory request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const page of [0, -1, 1.5, '1', NaN, MAX_STUDENTS_PAGE + 1]) await assert.rejects(fetchAdminStudentProfiles('token', page))
  for (const token of ['', null, undefined, 123]) await assert.rejects(fetchAdminStudentProfiles(token), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('invalid academic values and malformed populated references cannot enter the directory', async (t) => {
  let saved
  t.mock.method(globalThis, 'fetch', async () => response([saved]))
  for (const changes of [{ _id: 'bad' }, { studentNumber: '' }, { studentNumber: 'bad number' }, { semester: '7' }, { semester: 13 },
    { semester: 1.5 }, { phone: '-------' }, { user: undefined }, { user: profile.user._id },
    { user: { ...profile.user, isActive: 'true' } }, { user: { ...profile.user, name: '' } }, { user: { ...profile.user, email: 'invalid' } },
    { department: undefined }, { department: profile.department._id }, { department: { ...profile.department, code: 'bad code' } }, { department: { ...profile.department, name: '' } }]) {
    saved = { ...profile, ...changes }
    await assert.rejects(fetchAdminStudentProfiles('token'), /invalid student profiles/)
  }
})

test('wrong pagination, oversized responses and duplicate profile identities are rejected', async (t) => {
  let result
  t.mock.method(globalThis, 'fetch', async () => result)
  for (const value of [response(null), response([profile], 2), response([profile], 1, 20), response(Array(11).fill(profile)), response([profile, profile])]) {
    result = value
    await assert.rejects(fetchAdminStudentProfiles('token'), /invalid student profiles/)
  }
})

test('forbidden, missing-endpoint and server responses stay errors instead of empty lists', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => json({ success: false, message: 'Backend rejected this request.' }, status))
  for (const code of [400, 403, 404, 500]) {
    status = code
    await assert.rejects(fetchAdminStudentProfiles('token'), (error) => error.status === code && error.message === 'Backend rejected this request.')
  }
})

test('both JSON and non-JSON 401 responses require sign-in', async (t) => {
  let html = false
  t.mock.method(globalThis, 'fetch', async () => html ? new Response('Unauthorized', { status: 401 }) : json({ success: false }, 401))
  for (const value of [false, true]) {
    html = value
    await assert.rejects(fetchAdminStudentProfiles('token'), (error) => error.status === 401)
  }
})

test('network failures and malformed responses cannot report a successful directory load', async (t) => {
  let mode
  t.mock.method(globalThis, 'fetch', async () => {
    if (mode === 'network') throw new TypeError('Connection lost')
    if (mode === 'html') return new Response('Bad gateway', { status: 502 })
    if (mode === 'syntax') return new Response('{invalid', { headers: { 'Content-Type': 'application/json' } })
    return json({ success: 'true', data: { profiles: [profile], page: 1, limit: 10 } })
  })
  for (const value of ['network', 'html', 'syntax', 'false-success']) {
    mode = value
    await assert.rejects(fetchAdminStudentProfiles('token'))
  }
})

test('directory navigation cancels obsolete work and retains the shared 15-second timeout', async (t) => {
  t.mock.method(AbortSignal, 'timeout', (duration) => { assert.equal(duration, 15000); return new AbortController().signal })
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) reject(options.signal.reason)
    else options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  const controller = new AbortController()
  const request = fetchAdminStudentProfiles('token', 1, controller.signal)
  controller.abort()
  await assert.rejects(request, { name: 'AbortError' })
})
