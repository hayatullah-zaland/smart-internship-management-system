import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canEditWeeklyReport, fetchWeeklyReports, getStartedWeekCount, getWeeklyReportDates, saveWeeklyReport, submitWeeklyReport, validateWeeklyReport } from '../src/context/weeklyReportApi.js'

const student = { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' }
const internship = { _id: '507f1f77bcf86cd799439017', status: 'active', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-16T00:00:00.000Z' }
const values = { internshipId: internship._id, weekNumber: '2', summary: 'Built a form.', learning: 'Learned validation.', challenges: '' }
const raw = { _id: '507f1f77bcf86cd799439018', internship: internship._id, student: student._id,
  weekNumber: 2, weekStart: '2026-01-08T00:00:00.000Z', weekEnd: '2026-01-14T00:00:00.000Z',
  summary: values.summary, learning: values.learning, challenges: '', status: 'draft', submittedAt: null }
const report = { ...raw, internship, student }
const submitted = { ...raw, status: 'submitted', submittedAt: '2026-01-15T19:30:00.000Z' }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
function saved(value = raw) { return json({ success: true, data: { report: value } }) }
function listed(reports = [report], page = 1) { return json({ success: true, data: { reports, page, limit: 10 } }) }

test('week dates follow placement-relative seven-day periods and clip the last week inclusively', () => {
  assert.deepEqual(getWeeklyReportDates(internship, 1), { weekStart: internship.startDate, weekEnd: '2026-01-07T00:00:00.000Z' })
  assert.deepEqual(getWeeklyReportDates(internship, '2'), { weekStart: raw.weekStart, weekEnd: raw.weekEnd })
  assert.deepEqual(getWeeklyReportDates(internship, 3), { weekStart: '2026-01-15T00:00:00.000Z', weekEnd: internship.endDate })
  const short = { ...internship, endDate: '2026-01-08T00:00:00.000Z' }
  assert.deepEqual(getWeeklyReportDates(short, 2), { weekStart: short.endDate, weekEnd: short.endDate })
  for (const week of ['', ' ', null, [], true, NaN, Infinity, 0, 1.5, 4, 10001]) assert.equal(getWeeklyReportDates(internship, week), null)
  for (const placement of [null, {}, { ...internship, endDate: internship.startDate }]) assert.equal(getWeeklyReportDates(placement, 1), null)
})

test('week calculations cross leap days and year boundaries without Kabul-day shifts', () => {
  const leap = { ...internship, startDate: '2024-02-27T00:00:00.000Z', endDate: '2024-03-10T00:00:00.000Z' }
  assert.deepEqual(getWeeklyReportDates(leap, 1), { weekStart: leap.startDate, weekEnd: '2024-03-04T00:00:00.000Z' })
  assert.deepEqual(getWeeklyReportDates(leap, 2), { weekStart: '2024-03-05T00:00:00.000Z', weekEnd: leap.endDate })
  const year = { ...internship, startDate: '2025-12-29T00:00:00.000Z', endDate: '2026-01-10T00:00:00.000Z' }
  assert.deepEqual(getWeeklyReportDates(year, 1), { weekStart: year.startDate, weekEnd: '2026-01-04T00:00:00.000Z' })
})

test('only already-started UTC weeks are available, including the current unfinished week', () => {
  for (const [today, count] of [['2025-12-31', 0], ['2026-01-01', 1], ['2026-01-07', 1], ['2026-01-08', 2], ['2026-01-15', 3], ['2026-12-31', 3]]) {
    assert.equal(getStartedWeekCount(internship, today), count)
  }
  for (const today of ['bad', '2026-02-30', '2026-1-01', null]) assert.equal(getStartedWeekCount(internship, today), 0)
  assert.equal(getStartedWeekCount(null), 0)
  const timed = { ...internship, startDate: '2026-01-01T23:00:00.000Z' }
  assert.equal(getStartedWeekCount(timed, '2026-01-08'), 2)
  assert.equal(getStartedWeekCount({ ...internship, startDate: '1000-01-01T00:00:00.000Z', endDate: '2000-01-01T00:00:00.000Z' }, '2000-01-01'), 10000)
})

test('validation follows week, active placement and trimmed text bounds', () => {
  assert.deepEqual(validateWeeklyReport(values, internship, '2026-01-08'), {})
  assert.ok(validateWeeklyReport({ ...values, weekNumber: 3 }, internship, '2026-01-14').weekNumber)
  assert.deepEqual(validateWeeklyReport({ ...values, weekNumber: 3 }, internship, '2026-01-15'), {})
  for (const weekNumber of ['', ' ', null, [], true, NaN, Infinity, 0, 1.5, 4, 10001]) assert.ok(validateWeeklyReport({ ...values, weekNumber }, internship, '2026-12-31').weekNumber)
  for (const value of [null, {}, { ...internship, status: 'assigned' }, { ...internship, status: 'completed' }]) assert.ok(validateWeeklyReport(values, value).internshipId)
  for (const [field, max] of [['summary', 5000], ['learning', 3000], ['challenges', 2000]]) {
    assert.deepEqual(validateWeeklyReport({ ...values, [field]: 'A'.repeat(max) }, internship), {})
    assert.ok(validateWeeklyReport({ ...values, [field]: 'A'.repeat(max + 1) }, internship)[field])
  }
  for (const field of ['summary', 'learning']) for (const value of ['', ' ', null, {}]) assert.ok(validateWeeklyReport({ ...values, [field]: value }, internship)[field])
})

test('only active-placement drafts can be edited or submitted', () => {
  assert.equal(canEditWeeklyReport(report), true)
  for (const value of [null, {}, { ...report, status: 'submitted' }, { ...report, internship: null },
    { ...report, internship: { ...internship, status: 'completed' } }]) assert.equal(canEditWeeklyReport(value), false)
})

test('list uses backend-scoped bearer requests with real pagination and no supplied student filter', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/weekly-reports?page=1&limit=10')
    assert.equal(options.headers.Authorization, 'Bearer token')
    assert.equal(options.cache, 'no-store')
    return listed()
  })
  assert.deepEqual(await fetchWeeklyReports('token'), { reports: [report], hasNextPage: false })
})

test('empty, full and maximum pages never invent totals or records', async (t) => {
  let reports = [], page = 1
  t.mock.method(globalThis, 'fetch', async () => listed(reports, page))
  assert.deepEqual(await fetchWeeklyReports('token'), { reports: [], hasNextPage: false })
  reports = Array.from({ length: 10 }, (_, index) => ({ ...report, _id: (index + 1).toString(16).padStart(24, '0') }))
  assert.equal((await fetchWeeklyReports('token')).hasNextPage, true)
  page = 1000000
  assert.equal((await fetchWeeklyReports('token', page)).hasNextPage, false)
})

test('invalid pages, missing tokens and invalid saves never make requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch') })
  for (const page of [0, -1, 1.5, NaN, '1', 1000001]) await assert.rejects(fetchWeeklyReports('token', page))
  await assert.rejects(fetchWeeklyReports(''), (error) => error.status === 401)
  await assert.rejects(saveWeeklyReport('', internship, values), (error) => error.status === 401)
  await assert.rejects(saveWeeklyReport('token', internship, { ...values, summary: ' ' }))
  await assert.rejects(saveWeeklyReport('token', internship, { ...values, weekNumber: 4 }))
  assert.equal(fetch.mock.callCount(), 0)
})

test('malformed lists, duplicate IDs and incorrect week metadata cannot enter history', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const value of [null, {}, { ...report, weekNumber: '2' }, { ...report, weekStart: 'invalid' }, { ...report, weekEnd: internship.startDate },
    { ...report, weekEnd: '2026-01-15T00:00:00.000Z' }, { ...report, weekStart: '2026-01-09T00:00:00.000Z' }, { ...report, summary: ' ' },
    { ...report, student: student._id }, { ...report, internship: internship._id }, { ...report, status: 'approved' }, { ...report, status: 'submitted' },
    { ...report, challenges: {} }, { ...report, internship: { ...internship, endDate: internship.startDate } }]) {
    response = listed([value]); await assert.rejects(fetchWeeklyReports('token'), /invalid weekly report data/)
  }
  for (const data of [{ reports: [report, report], page: 1, limit: 10 }, { reports: [], page: 2, limit: 10 },
    { reports: [], page: 1, limit: 20 }, { reports: Array(11).fill(report), page: 1, limit: 10 }]) {
    response = json({ success: true, data }); await assert.rejects(fetchWeeklyReports('token'), /invalid weekly report data/)
  }
})

test('deleted references and submitted history remain readable, including a one-day final week', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => listed([value]))
  for (const item of [{ ...report, student: null, internship: null }, { ...report, ...submitted, student, internship },
    { ...report, internship: { ...internship, endDate: raw.weekStart }, weekEnd: raw.weekStart }]) {
    value = item
    assert.equal((await fetchWeeklyReports('token')).reports.length, 1)
  }
})

test('create sends numeric week and trimmed content, never derived dates or identity/status metadata', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/weekly-reports')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer token')
    assert.deepEqual(JSON.parse(options.body), { internshipId: internship._id, weekNumber: 2, summary: values.summary, learning: values.learning, challenges: '' })
    return saved()
  })
  assert.equal((await saveWeeklyReport('token', internship, { ...values, summary: ` ${values.summary} `, student: 'other', status: 'submitted', weekStart: '2000-01-01' })).status, 'draft')
})

test('edit sends content only and cannot change week or internship', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/v1/weekly-reports/${raw._id}`)
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(JSON.parse(options.body), { summary: values.summary, learning: values.learning, challenges: '' })
    return saved()
  })
  assert.equal((await saveWeeklyReport('token', internship, values, report)).weekNumber, 2)
  await assert.rejects(saveWeeklyReport('token', internship, { ...values, weekNumber: '1' }, report))
  await assert.rejects(saveWeeklyReport('token', { ...internship, _id: student._id }, values, report))
  await assert.rejects(saveWeeklyReport('token', internship, values, { ...report, status: 'submitted', submittedAt: submitted.submittedAt }))
  assert.equal(fetch.mock.callCount(), 1)
})

test('save confirmation requires the selected week, dates, content, status and raw references', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => saved(value))
  for (const item of [null, {}, { ...raw, weekNumber: 1 }, { ...raw, weekEnd: '2026-01-13T00:00:00.000Z' }, { ...raw, summary: 'Other summary' },
    { ...raw, student }, { ...raw, internship: student._id }, submitted, { ...raw, submittedAt: submitted.submittedAt }]) {
    value = item; await assert.rejects(saveWeeklyReport('token', internship, values), /could not be confirmed/)
  }
  for (const item of [{ ...raw, _id: internship._id }, { ...raw, student: internship._id }]) {
    value = item; await assert.rejects(saveWeeklyReport('token', internship, values, report), /could not be confirmed/)
  }
})

test('final partial week dates must match the backend calculation', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => saved({ ...raw, weekNumber: 3, weekStart: '2026-01-15T00:00:00.000Z', weekEnd: internship.endDate }))
  assert.equal((await saveWeeklyReport('token', internship, { ...values, weekNumber: '3' })).weekEnd, internship.endDate)
})

test('submission is a separate body-free POST with a confirmed timestamp and unchanged content', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/v1/weekly-reports/${raw._id}/submit`)
    assert.equal(options.method, 'POST')
    assert.equal(options.body, undefined)
    return saved(submitted)
  })
  assert.equal((await submitWeeklyReport('token', report)).status, 'submitted')
})

test('inactive, malformed and already-submitted reports cannot be submitted again', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch') })
  for (const value of [null, {}, { ...report, ...submitted, internship, student }, { ...report, internship: null },
    { ...report, internship: { ...internship, status: 'completed' } }]) await assert.rejects(submitWeeklyReport('token', value))
  assert.equal(fetch.mock.callCount(), 0)
})

test('submission rejects changed content, wrong IDs or weeks, missing timestamp and false draft success', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => saved(value))
  for (const item of [raw, { ...submitted, _id: internship._id }, { ...submitted, student: internship._id }, { ...submitted, internship: student._id },
    { ...submitted, weekNumber: 1 }, { ...submitted, weekEnd: '2026-01-13T00:00:00.000Z' }, { ...submitted, summary: 'Changed by another save' },
    { ...submitted, submittedAt: null }]) {
    value = item; await assert.rejects(submitWeeklyReport('token', report), /could not be confirmed/)
  }
})

test('all operations preserve real duplicate, validation, permission and stale-record errors', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => json({ success: false, message: 'Backend explanation.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    for (const action of [() => fetchWeeklyReports('token'), () => saveWeeklyReport('token', internship, values), () => submitWeeklyReport('token', report)]) {
      await assert.rejects(action(), (error) => error.status === code && error.message === 'Backend explanation.')
    }
  }
})

test('JSON and non-JSON 401 responses request sign-in for reading, saving and submitting', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const make of [() => json({ success: false }, 401), () => new Response('Unauthorized', { status: 401 })]) {
    for (const action of [() => fetchWeeklyReports('token'), () => saveWeeklyReport('token', internship, values), () => submitWeeklyReport('token', report)]) {
      response = make(); await assert.rejects(action(), (error) => error.status === 401)
    }
  }
})

test('malformed responses and failed networks never confirm or automatically retry a write', async (t) => {
  let response
  const fetch = t.mock.method(globalThis, 'fetch', async () => response)
  for (const make of [() => json(null), () => json({ success: 'true' }), () => new Response('Bad gateway', { status: 502 }),
    () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } })]) {
    response = make(); await assert.rejects(saveWeeklyReport('token', internship, values))
  }
  fetch.mock.mockImplementation(async () => { throw new TypeError('Network unavailable') })
  const before = fetch.mock.callCount()
  await assert.rejects(submitWeeklyReport('token', report), TypeError)
  assert.equal(fetch.mock.callCount(), before + 1)
})

test('read and write requests support cancellation and retain the shared 15-second timeout', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) return reject(options.signal.reason)
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  for (const action of [(signal) => fetchWeeklyReports('token', 1, signal), (signal) => saveWeeklyReport('token', internship, values, null, signal),
    (signal) => submitWeeklyReport('token', report, signal)]) {
    const controller = new AbortController()
    const pending = action(controller.signal)
    controller.abort()
    await assert.rejects(pending, { name: 'AbortError' })
  }
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  })
  await assert.rejects(submitWeeklyReport('token', report), { name: 'TimeoutError' })
})
