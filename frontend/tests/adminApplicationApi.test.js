import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchAdminApplications, reviewApplication, validateApplicationReview, MAX_APPLICATIONS_PAGE } from '../src/context/applicationApi.js'

const opportunity = {
  _id: '507f1f77bcf86cd799439011', title: 'Frontend Intern',
  company: { _id: '507f1f77bcf86cd799439012', name: 'Example Company' },
  deadline: '2027-01-31T23:59:00.000Z', status: 'open',
}
const student = { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' }
const application = {
  _id: '507f1f77bcf86cd799439013', student, opportunity,
  status: 'pending', createdAt: '2026-11-17T08:00:00.000Z', rejectionReason: '',
}
const reviewed = {
  ...application, student: student._id, opportunity: opportunity._id, status: 'approved',
  reviewedBy: '507f1f77bcf86cd799439015', reviewedAt: '2026-11-17T09:00:00.000Z',
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
function pageResponse(applications = [application], page = 1, limit = 10) {
  return jsonResponse({ success: true, data: { applications, page, limit } })
}
function reviewResponse(value = reviewed) {
  return jsonResponse({ success: true, data: { application: value } })
}

test('admin browsing uses the admin list endpoint with bearer auth and no invented student scope', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/applications?page=2&limit=10')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer admin-token')
    assert.equal(options.headers.Accept, 'application/json')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.body, undefined)
    return pageResponse([application], 2)
  })
  assert.deepEqual(await fetchAdminApplications('admin-token', 2), { applications: [application], hasNextPage: false })
})

test('every supported status filter is sent to the backend and its results are checked', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(new URL(url, 'http://localhost').searchParams.get('status'), status)
    return pageResponse([{ ...application, status }])
  })
  for (const value of ['pending', 'under_review', 'approved', 'rejected', 'withdrawn']) {
    status = value
    assert.equal((await fetchAdminApplications('admin-token', 1, status)).applications[0].status, status)
  }
})

test('invalid filters, pages and missing tokens never send admin list requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const status of [null, {}, 'all', 'accepted', 'pending&limit=100']) {
    await assert.rejects(fetchAdminApplications('admin-token', 1, status), /valid status filter/)
  }
  for (const page of [0, -1, 1.5, '2', NaN, MAX_APPLICATIONS_PAGE + 1]) {
    await assert.rejects(fetchAdminApplications('admin-token', page), /valid applications page/)
  }
  await assert.rejects(fetchAdminApplications(''), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('populated student fields are validated while a deleted student remains explicitly null', async (t) => {
  let value = null
  t.mock.method(globalThis, 'fetch', async () => pageResponse([{ ...application, student: value }]))
  assert.equal((await fetchAdminApplications('admin-token')).applications[0].student, null)
  for (const item of [undefined, student._id, {}, { ...student, _id: 'bad' }, { ...student, name: '' },
    { ...student, name: 'A'.repeat(101) }, { ...student, email: null }, { ...student, email: 'A'.repeat(255) }]) {
    value = item
    await assert.rejects(fetchAdminApplications('admin-token'), /invalid application data/)
  }
})

test('missing opportunity and company references remain visible in admin results', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => pageResponse([{ ...application, opportunity: value }]))
  for (const item of [null, { ...opportunity, company: null }, { ...opportunity, status: 'closed' }]) {
    value = item
    assert.deepEqual((await fetchAdminApplications('admin-token')).applications[0].opportunity, item)
  }
})

test('incorrect metadata, duplicate IDs, oversized lists and wrong filtered statuses are errors', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const item of [pageResponse(null), pageResponse([application], 2), pageResponse([application], 1, 20),
    pageResponse([application, application]), pageResponse(Array(11).fill(application)),
    pageResponse([{ ...application, status: 'approved' }]), pageResponse([{ ...application, createdAt: 'bad' }]),
    pageResponse([{ ...application, opportunity: {} }]), jsonResponse({ success: true, data: {} })]) {
    response = item
    await assert.rejects(fetchAdminApplications('admin-token', 1, 'pending'), /invalid application data/)
  }
})

test('empty, partial, full and last admin pages follow the existing no-total pagination contract', async (t) => {
  let items = []
  let page = 1
  t.mock.method(globalThis, 'fetch', async () => pageResponse(items, page))
  assert.deepEqual(await fetchAdminApplications('admin-token'), { applications: [], hasNextPage: false })
  items = [application]
  assert.equal((await fetchAdminApplications('admin-token')).hasNextPage, false)
  items = Array.from({ length: 10 }, (_, index) => ({ ...application, _id: (index + 1).toString(16).padStart(24, '0') }))
  const result = await fetchAdminApplications('admin-token')
  assert.equal(result.hasNextPage, true)
  assert.equal(result.total, undefined)
  page = MAX_APPLICATIONS_PAGE
  assert.equal((await fetchAdminApplications('admin-token', page)).hasNextPage, false)
})

test('review validation permits only backend decisions and requires a trimmed bounded rejection reason', () => {
  for (const status of ['under_review', 'approved']) assert.deepEqual(validateApplicationReview({ status }), {})
  for (const reason of ['Reason', ' A ', 'A'.repeat(1000)]) {
    assert.deepEqual(validateApplicationReview({ status: 'rejected', rejectionReason: reason }), {})
  }
  for (const status of ['', 'pending', 'withdrawn', 'accepted', null]) assert.ok(validateApplicationReview({ status }).status)
  assert.ok(validateApplicationReview(null).status)
  for (const reason of ['', '  ', null, {}, 'A'.repeat(1001)]) {
    assert.ok(validateApplicationReview({ status: 'rejected', rejectionReason: reason }).rejectionReason)
  }
})

test('approval and under-review PATCH requests send only the decision, not student or reviewer fields', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/v1/applications/${application._id}/decision`)
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer admin-token')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.equal(options.cache, 'no-store')
    assert.deepEqual(JSON.parse(options.body), { status })
    return reviewResponse({ ...reviewed, status })
  })
  for (const value of ['under_review', 'approved']) {
    status = value
    const result = await reviewApplication('admin-token', application._id, { status, rejectionReason: 'Old text', student: 'other-user', reviewedBy: 'other-admin' })
    assert.equal(result.status, status)
  }
})

test('rejection PATCH sends only the decision and trimmed reason and validates the saved reason', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { status: 'rejected', rejectionReason: 'Not suitable this time.' })
    return reviewResponse({ ...reviewed, status: 'rejected', rejectionReason: 'Not suitable this time.' })
  })
  const result = await reviewApplication('admin-token', application._id, { status: 'rejected', rejectionReason: ' Not suitable this time. ' })
  assert.equal(result.rejectionReason, 'Not suitable this time.')
})

test('invalid review input and missing tokens never send PATCH requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  await assert.rejects(reviewApplication('admin-token', 'bad', { status: 'approved' }), /valid application/)
  for (const values of [null, {}, { status: 'pending' }, { status: 'rejected', rejectionReason: ' ' }]) {
    await assert.rejects(reviewApplication('admin-token', application._id, values))
  }
  await assert.rejects(reviewApplication('', application._id, { status: 'approved' }), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('review success requires the matching application, decision, timestamp, reviewer and raw references', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => reviewResponse(value))
  for (const item of [null, {}, { ...reviewed, _id: opportunity._id }, { ...reviewed, status: 'pending' },
    { ...reviewed, student }, { ...reviewed, opportunity }, { ...reviewed, reviewedBy: null },
    { ...reviewed, reviewedAt: 'bad' }, { ...reviewed, rejectionReason: 'Unexpected reason' }]) {
    value = item
    await assert.rejects(reviewApplication('admin-token', application._id, { status: 'approved' }), /invalid application review data/)
  }
  value = { ...reviewed, status: 'rejected', rejectionReason: 'Different reason' }
  await assert.rejects(reviewApplication('admin-token', application._id, { status: 'rejected', rejectionReason: 'Reason' }), /invalid application review data/)
})

test('conflict, missing record, forbidden and backend validation responses preserve real statuses', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'Backend explanation.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    await assert.rejects(reviewApplication('admin-token', application._id, { status: 'approved' }),
      (error) => error.status === code && error.message === 'Backend explanation.')
  }
})

test('both admin operations handle JSON and non-JSON 401 before parsing', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const request of [() => fetchAdminApplications('admin-token'), () => reviewApplication('admin-token', application._id, { status: 'approved' })]) {
    for (const makeResponse of [() => jsonResponse({ success: false }, 401), () => new Response('Unauthorized', { status: 401 })]) {
      response = makeResponse()
      await assert.rejects(request(), (error) => error.status === 401)
    }
  }
})

test('failed reads and malformed responses are not empty lists or saved reviews', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const request of [() => fetchAdminApplications('admin-token'), () => reviewApplication('admin-token', application._id, { status: 'approved' })]) {
    for (const makeResponse of [() => jsonResponse({ success: false }, 403), () => jsonResponse({ success: 'true' }),
      () => jsonResponse(null), () => new Response('Bad gateway', { status: 502 }),
      () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } })]) {
      response = makeResponse()
      await assert.rejects(request())
    }
  }
})

test('an uncertain review is not automatically retried', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network unavailable') })
  await assert.rejects(reviewApplication('admin-token', application._id, { status: 'approved' }), TypeError)
  assert.equal(fetch.mock.callCount(), 1)
})

test('obsolete admin reads and writes can be aborted', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  for (const request of [(signal) => fetchAdminApplications('admin-token', 1, '', signal),
    (signal) => reviewApplication('admin-token', application._id, { status: 'approved' }, signal)]) {
    const controller = new AbortController()
    const pending = request(controller.signal)
    controller.abort()
    await assert.rejects(pending, { name: 'AbortError' })
  }
})

test('admin requests retain the shared 15-second timeout', async (t) => {
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => options.signal.throwIfAborted())
  await assert.rejects(fetchAdminApplications('admin-token'), { name: 'TimeoutError' })
  await assert.rejects(reviewApplication('admin-token', application._id, { status: 'approved' }), { name: 'TimeoutError' })
})
