import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchInternships, updateInternshipStatus, validateInternshipStatus } from '../src/context/internshipApi.js'

const internship = {
  _id: '507f1f77bcf86cd799439017', application: '507f1f77bcf86cd799439013', createdBy: '507f1f77bcf86cd799439015',
  student: '507f1f77bcf86cd799439014', supervisor: '507f1f77bcf86cd799439016', company: '507f1f77bcf86cd799439012', opportunity: '507f1f77bcf86cd799439011',
  startDate: '2026-12-01T00:00:00.000Z', endDate: '2027-02-01T00:00:00.000Z', status: 'assigned', isOngoing: true,
}
const change = { from: 'assigned', to: 'active', changedBy: internship.createdBy, changedAt: '2026-11-17T19:30:00.000Z', reason: '' }
const updated = { ...internship, status: 'active', statusHistory: [change] }
function jsonResponse(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }) }
function savedResponse(value = updated) { return jsonResponse({ success: true, data: { internship: value } }) }
const populated = { ...updated, student: null, supervisor: null, company: null, opportunity: null }
function pageResponse(value = populated) { return jsonResponse({ success: true, data: { internships: [value], page: 1, limit: 10 } }) }

test('status validation follows only the backend lifecycle transitions', () => {
  for (const [from, to] of [['assigned', 'active'], ['assigned', 'cancelled'], ['active', 'completed'], ['active', 'cancelled']]) {
    assert.deepEqual(validateInternshipStatus(from, { status: to, reason: to === 'cancelled' ? 'Placement cancelled.' : '' }), {})
  }
  for (const [from, to] of [['assigned', 'completed'], ['active', 'assigned'], ['active', 'active'], ['completed', 'active'], ['cancelled', 'active'], ['unknown', 'active'], ['constructor', 'active'], ['__proto__', 'active'], [['assigned'], 'active']]) {
    assert.ok(validateInternshipStatus(from, { status: to }).status)
  }
  assert.ok(validateInternshipStatus('assigned', null).status)
})

test('cancellation needs a nonblank bounded reason; other transitions accept an optional bounded reason', () => {
  for (const reason of ['', '   ', null, {}, 'A'.repeat(1001)]) assert.ok(validateInternshipStatus('assigned', { status: 'cancelled', reason }).reason)
  for (const reason of ['Reason', ' A ', 'A'.repeat(1000)]) assert.deepEqual(validateInternshipStatus('assigned', { status: 'cancelled', reason }), {})
  assert.deepEqual(validateInternshipStatus('assigned', { status: 'active' }), {})
  assert.deepEqual(validateInternshipStatus('active', { status: 'completed', reason: '  ' }), {})
  for (const reason of [null, {}, 123, 'A'.repeat(1001)]) assert.ok(validateInternshipStatus('assigned', { status: 'active', reason }).reason)
})

test('PATCH sends only status and a trimmed reason with the existing bearer helper', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/v1/internships/${internship._id}/status`)
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer admin-token')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.equal(options.cache, 'no-store')
    assert.deepEqual(JSON.parse(options.body), { status: 'active', reason: 'Training started.' })
    return savedResponse({ ...updated, statusHistory: [{ ...change, reason: 'Training started.' }] })
  })
  const result = await updateInternshipStatus('admin-token', internship, { status: 'active', reason: ' Training started. ', changedBy: 'other-user', isOngoing: false })
  assert.equal(result.statusHistory[0].reason, 'Training started.')
})

test('empty optional reasons are omitted from PATCH and all permitted transitions validate saved history', async (t) => {
  let from, to
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const reason = to === 'cancelled' ? 'Cancelled by agreement.' : ''
    assert.deepEqual(JSON.parse(options.body), reason ? { status: to, reason } : { status: to })
    return savedResponse({ ...internship, status: to, isOngoing: to === 'active', statusHistory: [{ ...change, from, to, reason }] })
  })
  for (const pair of [['assigned', 'active'], ['assigned', 'cancelled'], ['active', 'completed'], ['active', 'cancelled']]) {
    from = pair[0]
    to = pair[1]
    const result = await updateInternshipStatus('admin-token', { ...internship, status: from }, { status: to, reason: to === 'cancelled' ? ' Cancelled by agreement. ' : '  ' })
    assert.equal(result.status, to)
    assert.equal(result.isOngoing, to === 'active')
  }
})

test('invalid IDs, impossible transitions, invalid reasons and missing tokens send no PATCH', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const value of [null, {}, { ...internship, _id: 'bad' }]) await assert.rejects(updateInternshipStatus('token', value, { status: 'active' }))
  for (const values of [null, {}, { status: 'completed' }, { status: 'cancelled', reason: ' ' }]) await assert.rejects(updateInternshipStatus('token', internship, values))
  await assert.rejects(updateInternshipStatus('', internship, { status: 'active' }), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('success requires a matching record, status, ongoing flag and unpopulated saved references', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => savedResponse(value))
  for (const item of [null, {}, { ...updated, _id: internship.student }, { ...updated, status: 'assigned' }, { ...updated, isOngoing: false },
    { ...updated, student: null }, { ...updated, supervisor: {} }, { ...updated, company: {} }, { ...updated, opportunity: null }]) {
    value = item
    await assert.rejects(updateInternshipStatus('token', internship, { status: 'active' }), /invalid internship status data/)
  }
})

test('missing, malformed and mismatched last history entries never confirm a status change', async (t) => {
  let history
  t.mock.method(globalThis, 'fetch', async () => savedResponse({ ...updated, statusHistory: history }))
  for (const value of [undefined, null, [], {}, [null], [{ ...change, from: 'active' }], [{ ...change, to: 'cancelled' }],
    [{ ...change, changedBy: null }], [{ ...change, changedAt: 'bad' }], [{ ...change, reason: 'Unexpected reason' }],
    [{ ...change, reason: 'A'.repeat(1001) }]]) {
    history = value
    await assert.rejects(updateInternshipStatus('token', internship, { status: 'active' }), /invalid internship status data/)
  }
})

test('valid optional history is readable for old records and for records with transitions', async (t) => {
  let history
  t.mock.method(globalThis, 'fetch', async () => pageResponse({ ...populated, statusHistory: history }))
  for (const value of [undefined, [], [change]]) {
    history = value
    const result = await fetchInternships('token')
    assert.equal(result.internships.length, 1)
  }
})

test('invalid history cannot enter the list or crash status labels', async (t) => {
  let history
  t.mock.method(globalThis, 'fetch', async () => pageResponse({ ...populated, statusHistory: history }))
  for (const value of [null, {}, [null], [{ ...change, from: 'unknown' }], [{ ...change, from: 'constructor' }], [{ ...change, from: ['assigned'] }],
    [{ ...change, to: 'unknown' }], [{ ...change, changedAt: null }], [{ ...change, reason: {} }], [{ ...change, to: 'cancelled', reason: ' ' }]]) {
    history = value
    await assert.rejects(fetchInternships('token'), /invalid internship data/)
  }
})

test('backend validation, permission, missing-record and conflict errors keep their actual statuses', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'Backend status explanation.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    await assert.rejects(updateInternshipStatus('token', internship, { status: 'active' }), (error) => error.status === code && error.message === 'Backend status explanation.')
  }
})

test('JSON and non-JSON 401 responses require sign-in before parsing', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const makeResponse of [() => jsonResponse({ success: false }, 401), () => new Response('Unauthorized', { status: 401 })]) {
    response = makeResponse()
    await assert.rejects(updateInternshipStatus('token', internship, { status: 'active' }), (error) => error.status === 401)
  }
})

test('malformed responses and uncertain networks never claim success or retry PATCH automatically', async (t) => {
  let response
  const fetch = t.mock.method(globalThis, 'fetch', async () => response)
  for (const makeResponse of [() => jsonResponse(null), () => jsonResponse({ success: 'true' }), () => new Response('Bad gateway', { status: 502 }),
    () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } })]) {
    response = makeResponse()
    await assert.rejects(updateInternshipStatus('token', internship, { status: 'active' }))
  }
  fetch.mock.mockImplementation(async () => { throw new TypeError('Network unavailable') })
  const before = fetch.mock.callCount()
  await assert.rejects(updateInternshipStatus('token', internship, { status: 'active' }), TypeError)
  assert.equal(fetch.mock.callCount(), before + 1)
})

test('status updates can be aborted when leaving the page', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  const controller = new AbortController()
  const pending = updateInternshipStatus('token', internship, { status: 'active' }, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
})

test('status updates retain the shared 15-second timeout', async (t) => {
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => options.signal.throwIfAborted())
  await assert.rejects(updateInternshipStatus('token', internship, { status: 'active' }), { name: 'TimeoutError' })
})
