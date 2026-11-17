import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApplication, fetchMyApplications, APPLICATIONS_PAGE_SIZE, MAX_APPLICATIONS_PAGE } from '../src/context/applicationApi.js'

const opportunity = {
  _id: '507f1f77bcf86cd799439011', title: 'Frontend Intern',
  company: { _id: '507f1f77bcf86cd799439012', name: 'Example Company' },
  deadline: '2027-01-31T23:59:00.000Z', status: 'open',
}
const application = {
  _id: '507f1f77bcf86cd799439013', student: '507f1f77bcf86cd799439014',
  opportunity, status: 'pending', createdAt: '2026-11-16T19:30:00.000Z', rejectionReason: '',
}
const created = { ...application, opportunity: opportunity._id }

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
function pageResponse(applications = [application], page = 1, limit = APPLICATIONS_PAGE_SIZE) {
  return jsonResponse({ success: true, data: { applications, page, limit } })
}
function createdResponse(value = created) {
  return jsonResponse({ success: true, data: { application: value } }, 201)
}

test('submission sends only the opportunity ID, not identity, status or review fields', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/applications')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { opportunityId: opportunity._id })
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.equal(options.headers.Accept, 'application/json')
    assert.equal(options.cache, 'no-store')
    assert.ok(options.signal instanceof AbortSignal)
    return createdResponse()
  })
  assert.deepEqual(await createApplication('test-token', opportunity._id), created)
})

test('invalid opportunity IDs and absent tokens do not send submissions', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const id of ['', null, undefined, {}, 'not-an-id']) {
    await assert.rejects(createApplication('test-token', id), /valid opportunity/)
  }
  for (const token of ['', null, undefined, 123]) {
    await assert.rejects(createApplication(token, opportunity._id), (error) => error.status === 401)
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('submission requires a confirmed pending application for exactly the selected opportunity', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => createdResponse(value))
  for (const item of [null, {}, { ...created, _id: 'bad' }, { ...created, student: null },
    { ...created, status: 'approved' }, { ...created, opportunity: '507f1f77bcf86cd799439099' },
    { ...created, opportunity }, { ...created, createdAt: 'bad-date' }, { ...created, rejectionReason: null }]) {
    value = item
    await assert.rejects(createApplication('test-token', opportunity._id), /invalid application data/)
  }
})

test('duplicate, closed, missing and forbidden submissions preserve backend status and message', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'Backend explanation.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    await assert.rejects(createApplication('test-token', opportunity._id),
      (error) => error.status === code && error.message === 'Backend explanation.')
  }
})

test('submission never retries a network failure automatically', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network unavailable') })
  await assert.rejects(createApplication('test-token', opportunity._id), TypeError)
  assert.equal(fetch.mock.callCount(), 1)
})

test('my applications uses the student-scoped paginated endpoint without a supplied student ID', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/applications/me?page=2&limit=10')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.equal(options.body, undefined)
    assert.equal(options.cache, 'no-store')
    return pageResponse([application], 2)
  })
  assert.deepEqual(await fetchMyApplications('test-token', 2), { applications: [application], hasNextPage: false })
})

test('empty, partial, full and final pages do not invent total counts', async (t) => {
  let items = []
  let page = 1
  t.mock.method(globalThis, 'fetch', async () => pageResponse(items, page))
  assert.deepEqual(await fetchMyApplications('test-token'), { applications: [], hasNextPage: false })
  items = [application]
  assert.equal((await fetchMyApplications('test-token')).hasNextPage, false)
  items = Array.from({ length: 10 }, (_, index) => ({ ...application, _id: (index + 1).toString(16).padStart(24, '0') }))
  const full = await fetchMyApplications('test-token')
  assert.equal(full.hasNextPage, true)
  assert.equal(full.total, undefined)
  page = MAX_APPLICATIONS_PAGE
  assert.equal((await fetchMyApplications('test-token', page)).hasNextPage, false)
})

test('invalid pages and missing tokens cannot request application histories', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const page of [0, -1, 1.5, '2', NaN, Infinity, MAX_APPLICATIONS_PAGE + 1]) {
    await assert.rejects(fetchMyApplications('test-token', page), /valid applications page/)
  }
  await assert.rejects(fetchMyApplications(''), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('incorrect pagination, oversized pages, missing arrays and duplicate IDs are rejected', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const value of [pageResponse(null), pageResponse([application], 2), pageResponse([application], 1, 20),
    pageResponse(Array(11).fill(application)), pageResponse([application, application]),
    jsonResponse({ success: true, data: {} })]) {
    response = value
    await assert.rejects(fetchMyApplications('test-token'), /invalid application data/)
  }
})

test('all backend application statuses, closed opportunities and missing references remain visible', async (t) => {
  let item
  t.mock.method(globalThis, 'fetch', async () => pageResponse([item]))
  for (const status of ['pending', 'under_review', 'approved', 'rejected', 'withdrawn']) {
    item = { ...application, status, rejectionReason: status === 'rejected' ? 'Not suitable this time.' : '' }
    assert.equal((await fetchMyApplications('test-token')).applications[0].status, status)
  }
  for (const value of [null, { ...opportunity, company: null }, { ...opportunity, status: 'closed' }, { ...opportunity, status: 'archived' }]) {
    item = { ...application, opportunity: value }
    assert.deepEqual((await fetchMyApplications('test-token')).applications[0].opportunity, value)
  }
})

test('invalid application IDs, students, statuses, timestamps and reasons cannot enter history', async (t) => {
  let item
  t.mock.method(globalThis, 'fetch', async () => pageResponse([item]))
  const invalid = {
    _id: [null, 'bad'], student: [null, {}, 'bad'], status: [null, 'accepted', 'open'],
    createdAt: [null, 123, 'invalid'], rejectionReason: [null, {}, 'A'.repeat(1001)],
  }
  for (const [field, values] of Object.entries(invalid)) {
    for (const value of values) {
      item = { ...application, [field]: value }
      await assert.rejects(fetchMyApplications('test-token'), /invalid application data/, `${field}: ${value}`)
    }
  }
})

test('populated opportunities and companies are validated without requiring unselected fields', async (t) => {
  let item
  t.mock.method(globalThis, 'fetch', async () => pageResponse([{ ...application, opportunity: item }]))
  for (const value of [undefined, opportunity._id, {}, { ...opportunity, _id: 'bad' },
    { ...opportunity, title: '' }, { ...opportunity, title: 'A'.repeat(151) },
    { ...opportunity, deadline: 'bad' }, { ...opportunity, status: 'unknown' },
    { ...opportunity, company: undefined }, { ...opportunity, company: {} },
    { ...opportunity, company: { ...opportunity.company, name: '' } }]) {
    item = value
    await assert.rejects(fetchMyApplications('test-token'), /invalid application data/)
  }
  item = opportunity
  assert.deepEqual((await fetchMyApplications('test-token')).applications[0].opportunity, opportunity)
})

test('401 responses require sign-in for both reading and submitting, including non-JSON responses', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const request of [() => fetchMyApplications('test-token'), () => createApplication('test-token', opportunity._id)]) {
    for (const makeResponse of [() => jsonResponse({ success: false }, 401), () => new Response('Unauthorized', { status: 401 })]) {
      response = makeResponse()
      await assert.rejects(request(), (error) => error.status === 401)
    }
  }
})

test('forbidden and failed reads never become successful empty histories', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'Read failed.' }, status))
  for (const code of [403, 404, 500]) {
    status = code
    await assert.rejects(fetchMyApplications('test-token'), (error) => error.status === code && error.message === 'Read failed.')
  }
})

test('malformed JSON, non-JSON and false-success responses never confirm writes or reads', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const request of [() => fetchMyApplications('test-token'), () => createApplication('test-token', opportunity._id)]) {
    for (const makeResponse of [
      () => new Response('Bad gateway', { status: 502 }),
      () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } }),
      () => jsonResponse(null), () => jsonResponse({ success: 'true' }),
    ]) {
      response = makeResponse()
      await assert.rejects(request())
    }
  }
})

test('leaving a page can abort both application reads and submissions', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  for (const request of [
    (signal) => fetchMyApplications('test-token', 1, signal),
    (signal) => createApplication('test-token', opportunity._id, signal),
  ]) {
    const controller = new AbortController()
    const pending = request(controller.signal)
    controller.abort()
    await assert.rejects(pending, { name: 'AbortError' })
  }
})

test('both application operations retain the shared 15-second timeout', async (t) => {
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => options.signal.throwIfAborted())
  await assert.rejects(fetchMyApplications('test-token'), { name: 'TimeoutError' })
  await assert.rejects(createApplication('test-token', opportunity._id), { name: 'TimeoutError' })
})
