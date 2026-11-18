import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createOpportunity, fetchOpportunities, kabulDeadlineToISO, validateOpportunity } from '../src/context/opportunityApi.js'

const now = Date.parse('2026-11-17T10:00:00.000Z')
const user = { id: '507f1f77bcf86cd799439099', role: 'company_representative' }
const companyId = '507f1f77bcf86cd799439012'
const values = { companyId, title: ' Frontend Intern ', description: ' Build university tools. ', deadline: '2027-01-31T23:59', capacity: '3' }
const saved = { _id: '507f1f77bcf86cd799439011', company: companyId, title: 'Frontend Intern', description: 'Build university tools.',
  deadline: '2027-01-31T19:29:00.000Z', capacity: 3, status: 'open', createdBy: user.id, createdAt: '2026-11-17T10:00:00.000Z' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const response = (opportunity = saved) => json({ success: true, data: { opportunity } }, 201)

test('Kabul form deadlines convert to exact UTC instants without using the machine timezone', () => {
  assert.equal(kabulDeadlineToISO('2027-01-31T23:59'), '2027-01-31T19:29:00.000Z')
  assert.equal(kabulDeadlineToISO('2027-01-01T00:00'), '2026-12-31T19:30:00.000Z')
  assert.equal(kabulDeadlineToISO('2028-03-01T00:00'), '2028-02-29T19:30:00.000Z')
  assert.equal(kabulDeadlineToISO('2028-02-29T04:30'), '2028-02-29T00:00:00.000Z')
})

test('invalid calendar days, times and timezone-bearing form strings cannot be normalized into deadlines', () => {
  for (const deadline of ['', ' ', null, 123, '2027-01-31', '2027-1-1T10:00', '2027-02-29T10:00',
    '2028-02-30T10:00', '2027-04-31T10:00', '2027-13-01T10:00', '2027-01-01T24:00', '2027-01-01T10:60',
    '2027-01-01T10:00:00', '2027-01-01T10:00Z', '2027-01-01T10:00+04:30']) {
    assert.equal(kabulDeadlineToISO(deadline), null)
  }
})

test('draft validation uses backend title, description, company ID and capacity boundaries', () => {
  assert.deepEqual(validateOpportunity(values, now), {})
  for (const title of ['AB', 'A'.repeat(150)]) assert.deepEqual(validateOpportunity({ ...values, title }, now), {})
  for (const description of ['A', 'A'.repeat(5000)]) assert.deepEqual(validateOpportunity({ ...values, description }, now), {})
  for (const capacity of [1, 1000, '1', '1000']) assert.deepEqual(validateOpportunity({ ...values, capacity }, now), {})
  for (const title of ['', ' ', 'X', 'A'.repeat(151), null]) assert.ok(validateOpportunity({ ...values, title }, now).title)
  for (const description of ['', ' ', 'A'.repeat(5001), null]) assert.ok(validateOpportunity({ ...values, description }, now).description)
  for (const companyId of ['', 'invalid', null, 123]) assert.ok(validateOpportunity({ ...values, companyId }, now).companyId)
  for (const capacity of ['', ' ', 0, -1, 1001, 1.5, 'abc', NaN, Infinity, true, null, [1]]) {
    assert.ok(validateOpportunity({ ...values, capacity }, now).capacity)
  }
})

test('a deadline must be strictly later than now using the Kabul instant, not a UTC interpretation of the input', () => {
  assert.ok(validateOpportunity({ ...values, deadline: '2026-11-17T14:29' }, now).deadline)
  assert.ok(validateOpportunity({ ...values, deadline: '2026-11-17T14:30' }, now).deadline)
  assert.equal(validateOpportunity({ ...values, deadline: '2026-11-17T14:31' }, now).deadline, undefined)
})

test('publishing sends only approved fields, numeric capacity and an explicit UTC deadline', async (t) => {
  t.mock.method(Date, 'now', () => now)
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/opportunities')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer rep-token')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.equal(options.cache, 'no-store')
    assert.deepEqual(JSON.parse(options.body), { companyId, title: saved.title, description: saved.description, deadline: saved.deadline, capacity: 3 })
    return response()
  })
  assert.deepEqual(await createOpportunity('rep-token', { ...values, companyId: ` ${companyId} `, status: 'closed', createdBy: 'other', _id: 'chosen', role: 'admin' }, user), saved)
  assert.equal(fetch.mock.callCount(), 1)
})

test('admin, student, supervisor and missing identities cannot publish or request a company list', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const role of ['admin', 'student', 'academic_supervisor', 'unknown']) {
    await assert.rejects(createOpportunity('token', values, { ...user, role }), (error) => error.status === 403)
  }
  await assert.rejects(createOpportunity('token', values, null), (error) => error.status === 403)
  await assert.rejects(createOpportunity('token', values, { ...user, id: 'invalid' }), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('invalid drafts and missing tokens never send publication requests', async (t) => {
  t.mock.method(Date, 'now', () => now)
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const changed of [{ companyId: '' }, { title: 'X' }, { description: '' }, { capacity: '1.5' }, { deadline: '2020-01-01T12:00' }]) {
    await assert.rejects(createOpportunity('token', { ...values, ...changed }, user))
  }
  for (const token of ['', null, undefined, 123]) await assert.rejects(createOpportunity(token, values, user), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('saved responses must match the submitted company, publisher, content, capacity and deadline', async (t) => {
  t.mock.method(Date, 'now', () => now)
  let result
  t.mock.method(globalThis, 'fetch', async () => response(result))
  for (const changed of [{ _id: 'invalid' }, { company: user.id }, { company: { _id: companyId } }, { createdBy: companyId },
    { title: 'Other title' }, { description: 'Other content' }, { capacity: '3' }, { capacity: 4 }, { status: 'closed' },
    { deadline: '2027-01-31T23:59:00.000Z' }, { deadline: null }, { createdAt: null }, { createdAt: 'invalid' }]) {
    result = { ...saved, ...changed }
    await assert.rejects(createOpportunity('token', values, user), /could not be confirmed/)
  }
  result = null
  await assert.rejects(createOpportunity('token', values, user), /could not be confirmed/)
})

test('equivalent timezone instants and case-insensitive Mongo IDs remain valid confirmations', async (t) => {
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async () => response({ ...saved, company: companyId.toUpperCase(), createdBy: user.id.toUpperCase(), deadline: '2027-01-31T23:59:00+04:30' }))
  assert.equal((await createOpportunity('token', values, user)).capacity, 3)
})

test('confirmed publication is readable through the existing populated opportunities browsing API', async (t) => {
  t.mock.method(Date, 'now', () => now)
  let stored = null
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'POST') {
      stored = { ...saved, ...JSON.parse(options.body), company: companyId }
      delete stored.companyId
      return response(stored)
    }
    assert.equal(url, '/api/v1/opportunities?page=1&limit=10')
    return json({ success: true, data: { opportunities: [{ ...stored, company: { _id: companyId, name: 'Test Company', address: 'Kabul' } }], page: 1, limit: 10 } })
  })
  await createOpportunity('rep-token', values, user)
  const result = await fetchOpportunities('student-token')
  assert.equal(result.opportunities[0]._id, saved._id)
  assert.equal(result.opportunities[0].company.name, 'Test Company')
  assert.equal(result.opportunities[0].deadline, saved.deadline)
})

test('backend ownership, validation, missing-company and server failures keep their actual status/messages', async (t) => {
  t.mock.method(Date, 'now', () => now)
  let status
  t.mock.method(globalThis, 'fetch', async () => json({ success: false, message: 'You can publish opportunities only for your assigned company.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    await assert.rejects(createOpportunity('token', values, user), (error) => error.status === code && error.message.includes('assigned company'))
  }
})

test('both JSON and non-JSON 401 responses require sign-in', async (t) => {
  t.mock.method(Date, 'now', () => now)
  let html = false
  t.mock.method(globalThis, 'fetch', async () => html ? new Response('Unauthorized', { status: 401 }) : json({ success: false }, 401))
  for (const value of [false, true]) {
    html = value
    await assert.rejects(createOpportunity('token', values, user), (error) => error.status === 401)
  }
})

test('network failures and malformed responses never report success or repeat POST automatically', async (t) => {
  t.mock.method(Date, 'now', () => now)
  let mode
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    if (mode === 'network') throw new TypeError('Connection lost')
    if (mode === 'html') return new Response('Bad gateway', { status: 502 })
    if (mode === 'syntax') return new Response('{invalid', { headers: { 'Content-Type': 'application/json' } })
    return json({ success: 'true', data: { opportunity: saved } })
  })
  for (const value of ['network', 'html', 'syntax', 'false-success']) {
    mode = value
    const before = fetch.mock.callCount()
    await assert.rejects(createOpportunity('token', values, user))
    assert.equal(fetch.mock.callCount(), before + 1)
  }
})

test('publication supports leaving the page and retains the shared 15-second timeout', async (t) => {
  t.mock.method(Date, 'now', () => now)
  t.mock.method(AbortSignal, 'timeout', (duration) => { assert.equal(duration, 15000); return new AbortController().signal })
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) reject(options.signal.reason)
    else options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  const controller = new AbortController()
  const request = createOpportunity('token', values, user, controller.signal)
  controller.abort()
  await assert.rejects(request, { name: 'AbortError' })
})
