import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInternship, fetchInternships, fetchApprovedApplications, fetchAcademicSupervisors, validateInternshipAssignment, MAX_INTERNSHIPS_PAGE } from './internshipApi.js'

const student = { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' }
const supervisor = { _id: '507f1f77bcf86cd799439016', name: 'Supervisor One', email: 'supervisor@example.com' }
const company = { _id: '507f1f77bcf86cd799439012', name: 'Example Company', address: 'Kabul, Afghanistan' }
const opportunity = { _id: '507f1f77bcf86cd799439011', title: 'Frontend Intern' }
const internship = {
  _id: '507f1f77bcf86cd799439017', application: '507f1f77bcf86cd799439013', createdBy: '507f1f77bcf86cd799439015',
  student, supervisor, company, opportunity, startDate: '2026-12-01T00:00:00.000Z', endDate: '2027-02-01T00:00:00.000Z', status: 'assigned', isOngoing: true,
}
const values = { applicationId: internship.application, supervisorId: supervisor._id, startDate: '2026-12-01', endDate: '2027-02-01' }
const created = { ...internship, student: student._id, supervisor: supervisor._id, company: company._id, opportunity: opportunity._id }
const approved = { _id: internship.application, student, opportunity: { ...opportunity, company, deadline: '2027-01-01T00:00:00.000Z', status: 'open' },
  status: 'approved', createdAt: '2026-11-17T08:00:00.000Z', rejectionReason: '' }
function jsonResponse(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }) }
function pageResponse(internships = [internship], page = 1, limit = 10) { return jsonResponse({ success: true, data: { internships, page, limit } }) }
function usersResponse(users, page = 1) { return jsonResponse({ success: true, data: { users, page, limit: 100 } }) }

test('assignment validates real calendar dates, leap years and an end strictly after the start', () => {
  assert.deepEqual(validateInternshipAssignment(values), {})
  assert.deepEqual(validateInternshipAssignment({ ...values, startDate: '2028-02-29', endDate: '2028-03-01' }), {})
  for (const date of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-2-01', '2026-12-01T00:00:00Z', '', null]) {
    assert.ok(validateInternshipAssignment({ ...values, startDate: date }).startDate)
    assert.ok(validateInternshipAssignment({ ...values, endDate: date }).endDate)
  }
  for (const date of ['2026-12-01', '2026-11-30']) assert.ok(validateInternshipAssignment({ ...values, endDate: date }).endDate)
  assert.ok(validateInternshipAssignment({ ...values, applicationId: 'bad' }).applicationId)
  assert.ok(validateInternshipAssignment({ ...values, supervisorId: 'bad' }).supervisorId)
  assert.equal(Object.keys(validateInternshipAssignment(null)).length, 4)
})

test('POST sends only application, supervisor and date-only values with bearer authentication', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/internships')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer admin-token')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.equal(options.cache, 'no-store')
    assert.deepEqual(JSON.parse(options.body), values)
    return jsonResponse({ success: true, data: { internship: created } }, 201)
  })
  assert.deepEqual(await createInternship('admin-token', { ...values, student: 'other-student', slot: 99, status: 'active' }), created)
})

test('invalid assignments and missing tokens cannot create records', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const value of [null, {}, { ...values, applicationId: 'bad' }, { ...values, startDate: '2026-02-30' }, { ...values, endDate: values.startDate }]) {
    await assert.rejects(createInternship('admin-token', value))
  }
  await assert.rejects(createInternship('', values), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('confirmed assignment must match the selected application, supervisor, dates and assigned status', async (t) => {
  let item
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: true, data: { internship: item } }, 201))
  for (const value of [null, {}, { ...created, application: opportunity._id }, { ...created, supervisor: student._id },
    { ...created, student }, { ...created, company: null }, { ...created, opportunity },
    { ...created, startDate: '2026-12-02T00:00:00.000Z' }, { ...created, endDate: '2027-02-02T00:00:00.000Z' },
    { ...created, status: 'active' }, { ...created, isOngoing: false }]) {
    item = value
    await assert.rejects(createInternship('admin-token', values), /invalid assignment data/)
  }
})

test('capacity, duplicate placement, inactive-user and permission errors retain backend messages', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'Backend assignment explanation.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    await assert.rejects(createInternship('admin-token', values), (error) => error.status === code && error.message === 'Backend assignment explanation.')
  }
})

test('network failures never automatically repeat a POST', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network unavailable') })
  await assert.rejects(createInternship('admin-token', values), TypeError)
  assert.equal(fetch.mock.callCount(), 1)
})

test('internship list requests real pagination without supplying a student, company or supervisor scope', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/internships?page=2&limit=10')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.equal(options.body, undefined)
    assert.equal(options.cache, 'no-store')
    return pageResponse([internship], 2)
  })
  assert.deepEqual(await fetchInternships('test-token', 2), { internships: [internship], hasNextPage: false })
})

test('invalid list pages never send requests and empty/full pages do not invent totals', async (t) => {
  let items = []
  let page = 1
  const fetch = t.mock.method(globalThis, 'fetch', async () => pageResponse(items, page))
  for (const value of [0, -1, '2', 1.5, NaN, Infinity, MAX_INTERNSHIPS_PAGE + 1]) await assert.rejects(fetchInternships('test-token', value))
  assert.equal(fetch.mock.callCount(), 0)
  assert.deepEqual(await fetchInternships('test-token'), { internships: [], hasNextPage: false })
  items = Array.from({ length: 10 }, (_, index) => ({ ...internship, _id: (index + 1).toString(16).padStart(24, '0') }))
  const full = await fetchInternships('test-token')
  assert.equal(full.hasNextPage, true)
  assert.equal(full.total, undefined)
  page = MAX_INTERNSHIPS_PAGE
  assert.equal((await fetchInternships('test-token', page)).hasNextPage, false)
})

test('all four real statuses and deleted references remain valid history', async (t) => {
  let item
  t.mock.method(globalThis, 'fetch', async () => pageResponse([item]))
  for (const status of ['assigned', 'active', 'completed', 'cancelled']) {
    item = { ...internship, status, isOngoing: ['assigned', 'active'].includes(status) }
    assert.equal((await fetchInternships('test-token')).internships[0].status, status)
  }
  item = { ...internship, student: null, supervisor: null, opportunity: null, company: null }
  assert.deepEqual((await fetchInternships('test-token')).internships[0], item)
})

test('malformed internship fields, unpopulated references and bad metadata are rejected', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const item of [pageResponse(null), pageResponse([internship], 2), pageResponse([internship], 1, 20),
    pageResponse([internship, internship]), pageResponse(Array(11).fill(internship)),
    ...[{ _id: 'bad' }, { application: null }, { createdBy: null }, { status: 'pending' }, { isOngoing: false },
      { startDate: 'bad' }, { endDate: internship.startDate }, { student: student._id }, { supervisor: {} },
      { company: { ...company, address: '' } }, { opportunity: { ...opportunity, title: '' } }].map((patch) => pageResponse([{ ...internship, ...patch }]))]) {
    response = item
    await assert.rejects(fetchInternships('test-token'), /invalid internship data/)
  }
})

test('approved application choices follow every page and omit missing references', async (t) => {
  const calls = []
  const first = Array.from({ length: 10 }, (_, index) => ({ ...approved, _id: (index + 100).toString(16).padStart(24, '0') }))
  t.mock.method(globalThis, 'fetch', async (url) => {
    const query = new URL(url, 'http://localhost').searchParams
    assert.equal(query.get('status'), 'approved')
    const page = Number(query.get('page'))
    calls.push(page)
    return jsonResponse({ success: true, data: { applications: page === 1 ? first : [approved, { ...approved, _id: student._id, student: null }], page, limit: 10 } })
  })
  const options = await fetchApprovedApplications('admin-token')
  assert.equal(options.length, 11)
  assert.ok(options.some((item) => item._id === approved._id))
  assert.deepEqual(calls, [1, 2])
})

test('supervisor choices scan every user page and include only active academic supervisors', async (t) => {
  const calls = []
  const first = Array.from({ length: 100 }, (_, index) => ({ ...student, _id: (index + 100).toString(16).padStart(24, '0'), role: 'student', isActive: true }))
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const query = new URL(url, 'http://localhost').searchParams
    assert.equal(query.get('limit'), '100')
    assert.equal(query.get('role'), null)
    assert.equal(options.headers.Authorization, 'Bearer admin-token')
    const page = Number(query.get('page'))
    calls.push(page)
    return usersResponse(page === 1 ? first : [{ ...supervisor, role: 'academic_supervisor', isActive: true },
      { ...student, role: 'academic_supervisor', isActive: false }, { ...student, role: 'admin', isActive: true }], page)
  })
  assert.deepEqual(await fetchAcademicSupervisors('admin-token'), [{ ...supervisor, role: 'academic_supervisor', isActive: true }])
  assert.deepEqual(calls, [1, 2])
})

test('empty option collections stay empty without creating supervisors or applications', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => url.startsWith('/api/v1/users') ? usersResponse([])
    : jsonResponse({ success: true, data: { applications: [], page: 1, limit: 10 } }))
  assert.deepEqual(await fetchApprovedApplications('admin-token'), [])
  assert.deepEqual(await fetchAcademicSupervisors('admin-token'), [])
})

test('malformed user pages cannot become supervisor choices', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const item of [usersResponse(null), usersResponse([], 2), usersResponse([null]), usersResponse([supervisor]),
    usersResponse([{ ...supervisor, role: 'unknown', isActive: true }]), usersResponse([{ ...supervisor, role: 'academic_supervisor', isActive: 'true' }]),
    usersResponse([{ ...supervisor, name: '', role: 'academic_supervisor', isActive: true }])]) {
    response = item
    await assert.rejects(fetchAcademicSupervisors('admin-token'), /invalid supervisor data/)
  }
})

test('every operation handles JSON and non-JSON 401 before parsing', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const request of [() => fetchInternships('token'), () => fetchApprovedApplications('token'), () => fetchAcademicSupervisors('token'), () => createInternship('token', values)]) {
    for (const makeResponse of [() => jsonResponse({ success: false }, 401), () => new Response('Unauthorized', { status: 401 })]) {
      response = makeResponse()
      await assert.rejects(request(), (error) => error.status === 401)
    }
  }
})

test('failed and malformed responses never pretend to be an empty list or a saved assignment', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const request of [() => fetchInternships('token'), () => createInternship('token', values)]) {
    for (const makeResponse of [() => jsonResponse({ success: false }, 403), () => jsonResponse({ success: 'true' }),
      () => new Response('Bad gateway', { status: 502 }), () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } })]) {
      response = makeResponse()
      await assert.rejects(request())
    }
  }
})

test('page and form cleanup can abort list, options and creation requests', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  for (const request of [(signal) => fetchInternships('token', 1, signal), (signal) => fetchApprovedApplications('token', signal),
    (signal) => fetchAcademicSupervisors('token', signal), (signal) => createInternship('token', values, signal)]) {
    const controller = new AbortController()
    const pending = request(controller.signal)
    controller.abort()
    await assert.rejects(pending, { name: 'AbortError' })
  }
})

test('every operation keeps the shared 15-second timeout', async (t) => {
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => options.signal.throwIfAborted())
  for (const request of [() => fetchInternships('token'), () => fetchApprovedApplications('token'), () => fetchAcademicSupervisors('token'), () => createInternship('token', values)]) {
    await assert.rejects(request(), { name: 'TimeoutError' })
  }
})
