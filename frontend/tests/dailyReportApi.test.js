import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchDailyReports, fetchReportInternships, saveDailyReport, submitDailyReport, validateDailyReport } from '../src/context/dailyReportApi.js'

const id = '507f1f77bcf86cd799439017'
const person = { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' }
const internship = { _id: id, status: 'active', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-10-01T00:00:00.000Z' }
const values = { internshipId: id, date: '2026-01-02', hours: '7.5', tasks: 'Built a form.', learning: 'Learned validation.', challenges: '' }
const raw = { _id: '507f1f77bcf86cd799439018', internship: id, student: person._id, date: `${values.date}T00:00:00.000Z`,
  hours: 7.5, tasks: values.tasks, learning: values.learning, challenges: '', status: 'draft', submittedAt: null, reviewedBy: null, reviewedAt: null, feedback: '' }
const report = { ...raw, internship, student: person }
const submitted = { ...raw, status: 'submitted', submittedAt: '2026-01-03T10:00:00.000Z' }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }) }
function saved(value = raw) { return json({ success: true, data: { report: value } }) }
function listed(reports = [report], page = 1) { return json({ success: true, data: { reports, page, limit: 10 } }) }

test('report validation follows backend date, placement, hour and text boundaries', () => {
  assert.deepEqual(validateDailyReport(values, internship, '2026-01-02'), {})
  for (const hours of [0.25, 0.3, 24, '0.25', '24']) assert.deepEqual(validateDailyReport({ ...values, hours }, internship, '2026-01-02'), {})
  for (const hours of ['', ' ', null, undefined, true, [], {}, NaN, Infinity, 0, 0.24, 24.01]) assert.ok(validateDailyReport({ ...values, hours }, internship).hours)
  for (const date of ['2026-02-30', '2026-1-02', '2026-01-02T00:00:00Z', null, '2025-12-31', '2026-10-02']) assert.ok(validateDailyReport({ ...values, date }, internship, '2026-12-31').date)
  assert.ok(validateDailyReport({ ...values, date: '2026-01-03' }, internship, '2026-01-02').date)
  assert.deepEqual(validateDailyReport({ ...values, date: '2026-10-01' }, internship, '2026-12-31'), {})
  assert.deepEqual(validateDailyReport({ ...values, date: '2026-01-01' }, internship, '2026-12-31'), {})
  for (const field of ['tasks', 'learning']) for (const value of ['', ' ', null, 123]) assert.ok(validateDailyReport({ ...values, [field]: value }, internship)[field])
  for (const [field, max] of [['tasks', 5000], ['learning', 3000], ['challenges', 2000]]) {
    assert.deepEqual(validateDailyReport({ ...values, [field]: 'A'.repeat(max) }, internship), {})
    assert.ok(validateDailyReport({ ...values, [field]: 'A'.repeat(max + 1) }, internship)[field])
  }
  for (const value of [null, {}, { ...internship, status: 'assigned' }, { ...internship, status: 'completed' }]) assert.ok(validateDailyReport(values, value).internshipId)
})

test('daily report list uses server-scoped bearer auth and pagination without identity filters', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/daily-reports?page=1&limit=10')
    assert.equal(options.headers.Authorization, 'Bearer student-token')
    assert.equal(options.cache, 'no-store')
    return listed()
  })
  assert.deepEqual(await fetchDailyReports('student-token'), { reports: [report], hasNextPage: false })
})

test('empty, full and maximum pages do not invent totals or records', async (t) => {
  let reports = [], page = 1
  t.mock.method(globalThis, 'fetch', async () => listed(reports, page))
  assert.deepEqual(await fetchDailyReports('token'), { reports: [], hasNextPage: false })
  reports = Array.from({ length: 10 }, (_, index) => ({ ...report, _id: (index + 1).toString(16).padStart(24, '0') }))
  assert.equal((await fetchDailyReports('token')).hasNextPage, true)
  page = 1000000
  assert.equal((await fetchDailyReports('token', page)).hasNextPage, false)
})

test('invalid pages and missing tokens never send a request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch') })
  for (const page of [0, -1, 1.5, NaN, '1', 1000001]) await assert.rejects(fetchDailyReports('token', page))
  await assert.rejects(fetchDailyReports(''), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('list rejects malformed content, duplicate IDs, references, review metadata and pagination', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  const invalid = [null, {}, { ...report, date: '2026-02-30T00:00:00.000Z' }, { ...report, hours: '7.5' }, { ...report, tasks: ' ' },
    { ...report, status: 'constructor' }, { ...report, challenges: {} }, { ...report, student: person._id }, { ...report, internship: id },
    { ...report, internship: { ...internship, endDate: internship.startDate } }, { ...report, status: 'submitted' },
    { ...report, status: 'approved', submittedAt: submitted.submittedAt }, { ...report, reviewedBy: {} }]
  for (const value of invalid) { response = listed([value]); await assert.rejects(fetchDailyReports('token'), /invalid daily report data/) }
  for (const data of [{ reports: [report, report], page: 1, limit: 10 }, { reports: [], page: 2, limit: 10 }, { reports: [], page: 1, limit: 20 },
    { reports: Array(11).fill(report), page: 1, limit: 10 }]) {
    response = json({ success: true, data }); await assert.rejects(fetchDailyReports('token'), /invalid daily report data/)
  }
  response = listed([{ ...report, student: null, internship: null }])
  assert.equal((await fetchDailyReports('token')).reports[0].internship, null)
})

test('all real report statuses and retained last-review feedback remain readable', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => listed([value]))
  for (const status of ['draft', 'submitted', 'approved', 'changes_requested']) {
    value = { ...report, status, submittedAt: submitted.submittedAt, reviewedBy: person._id, reviewedAt: submitted.submittedAt, feedback: 'Please add details.' }
    assert.equal((await fetchDailyReports('token')).reports[0].status, status)
  }
})

test('active report choices scan every internship page without offering other lifecycle states', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url)
    const page = calls.length
    const rows = Array.from({ length: page === 1 ? 10 : 1 }, (_, index) => ({ ...internship,
      _id: (page * 100 + index).toString(16).padStart(24, '0'), application: person._id, createdBy: person._id,
      student: person, supervisor: person, company: null, opportunity: null, status: index === 0 ? 'active' : 'completed', isOngoing: index === 0 }))
    return json({ success: true, data: { internships: rows, page, limit: 10 } })
  })
  assert.equal((await fetchReportInternships('token')).length, 2)
  assert.deepEqual(calls, ['/api/v1/internships?page=1&limit=10', '/api/v1/internships?page=2&limit=10'])
})

test('create sends only calendar date, internship ID and trimmed report content', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/daily-reports')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer token')
    assert.deepEqual(JSON.parse(options.body), { internshipId: id, date: values.date, hours: 7.5, tasks: values.tasks, learning: values.learning, challenges: '' })
    return saved()
  })
  assert.equal((await saveDailyReport('token', internship, { ...values, tasks: ` ${values.tasks} `, student: 'other', status: 'approved', reviewedBy: person._id })).status, 'draft')
})

test('edit changes only content, keeps fixed date/internship and preserves editable status', async (t) => {
  let status = 'draft'
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/v1/daily-reports/${raw._id}`)
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(JSON.parse(options.body), { hours: 7.5, tasks: values.tasks, learning: values.learning, challenges: '' })
    return saved({ ...raw, status, submittedAt: submitted.submittedAt, reviewedBy: person._id, reviewedAt: submitted.submittedAt, feedback: 'Add details.' })
  })
  for (const current of ['draft', 'changes_requested']) {
    status = current
    assert.equal((await saveDailyReport('token', internship, values, { ...report, status })).status, status)
  }
})

test('invalid content, changed identity/date and noneditable records cannot be saved or submitted', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch') })
  await assert.rejects(saveDailyReport('token', internship, { ...values, tasks: '' }))
  await assert.rejects(saveDailyReport('token', internship, { ...values, date: '2026-01-03' }, report))
  await assert.rejects(saveDailyReport('token', { ...internship, _id: person._id }, values, report))
  await assert.rejects(saveDailyReport('', internship, values), (error) => error.status === 401)
  for (const value of [null, {}, { ...report, status: 'submitted' }, { ...report, status: 'approved' }, { ...report, internship: null },
    { ...report, internship: { ...internship, status: 'cancelled' } }]) {
    await assert.rejects(submitDailyReport('token', value))
    if (value) await assert.rejects(saveDailyReport('token', internship, values, value))
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('save success requires matching ID, status, date, internship, content and raw references', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => saved(value))
  for (const invalid of [null, {}, { ...raw, internship: person._id }, { ...raw, status: 'submitted' }, { ...raw, date: '2026-01-03T00:00:00.000Z' },
    { ...raw, hours: 8 }, { ...raw, tasks: 'Different tasks' }, { ...raw, student: person }, { ...raw, internship }]) {
    value = invalid; await assert.rejects(saveDailyReport('token', internship, values), /could not be confirmed/)
  }
  for (const invalid of [{ ...raw, _id: id }, { ...raw, student: id }]) {
    value = invalid; await assert.rejects(saveDailyReport('token', internship, values, report), /could not be confirmed/)
  }
})

test('submit and resubmit use the dedicated explicit POST, without content or identity fields', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/v1/daily-reports/${raw._id}/submit`)
    assert.equal(options.method, 'POST')
    assert.equal(options.body, undefined)
    return saved(submitted)
  })
  for (const status of ['draft', 'changes_requested']) assert.equal((await submitDailyReport('token', { ...report, status })).status, 'submitted')
})

test('submitted confirmation requires a matching submitted report and timestamp', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => saved(value))
  for (const invalid of [raw, { ...submitted, _id: id }, { ...submitted, internship: person._id }, { ...submitted, student: id },
    { ...submitted, submittedAt: null }, { ...submitted, date: '2026-01-03T00:00:00.000Z' }]) {
    value = invalid; await assert.rejects(submitDailyReport('token', report), /could not be confirmed/)
  }
})

test('all operations preserve real backend errors, including duplicate and stale conflicts', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => json({ success: false, message: 'Backend explanation.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    for (const operation of [() => fetchDailyReports('token'), () => saveDailyReport('token', internship, values), () => submitDailyReport('token', report)]) {
      await assert.rejects(operation(), (error) => error.status === code && error.message === 'Backend explanation.')
    }
  }
})

test('JSON and non-JSON 401 errors request sign-in before response parsing', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const make of [() => json({ success: false }, 401), () => new Response('Unauthorized', { status: 401 })]) {
    for (const operation of [() => fetchDailyReports('token'), () => saveDailyReport('token', internship, values), () => submitDailyReport('token', report)]) {
      response = make(); await assert.rejects(operation(), (error) => error.status === 401)
    }
  }
})

test('malformed responses and uncertain writes never claim success or retry automatically', async (t) => {
  let response
  const fetch = t.mock.method(globalThis, 'fetch', async () => response)
  for (const make of [() => json(null), () => json({ success: 'true' }), () => new Response('Bad gateway', { status: 502 }),
    () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } })]) {
    response = make(); await assert.rejects(saveDailyReport('token', internship, values))
  }
  fetch.mock.mockImplementation(async () => { throw new TypeError('Network unavailable') })
  const before = fetch.mock.callCount()
  await assert.rejects(submitDailyReport('token', report), TypeError)
  assert.equal(fetch.mock.callCount(), before + 1)
})

test('report reads and writes support cancellation and retain the 15-second timeout', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) return reject(options.signal.reason)
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  for (const operation of [(signal) => fetchDailyReports('token', 1, signal), (signal) => saveDailyReport('token', internship, values, null, signal),
    (signal) => submitDailyReport('token', report, signal)]) {
    const controller = new AbortController()
    const pending = operation(controller.signal)
    controller.abort()
    await assert.rejects(pending, { name: 'AbortError' })
  }
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  })
  await assert.rejects(submitDailyReport('token', report), { name: 'TimeoutError' })
})
