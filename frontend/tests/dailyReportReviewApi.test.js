import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canReviewDailyReport, reviewDailyReport, validateDailyReportReview } from '../src/context/dailyReportApi.js'

const supervisorId = '507f1f77bcf86cd799439016'
const student = { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' }
const internship = { _id: '507f1f77bcf86cd799439017', supervisor: supervisorId, status: 'active', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-10-01T00:00:00.000Z' }
const report = { _id: '507f1f77bcf86cd799439018', internship, student, date: '2026-01-02T00:00:00.000Z', hours: 7.5,
  tasks: 'Built a form.', learning: 'Learned validation.', challenges: '', status: 'submitted', submittedAt: '2026-01-03T10:00:00.000Z',
  reviewedBy: null, reviewedAt: null, feedback: '' }
const approved = { ...report, internship: internship._id, student: student._id, status: 'approved', reviewedBy: supervisorId, reviewedAt: '2026-01-03T11:00:00.000Z' }
const returned = { ...approved, status: 'changes_requested', feedback: 'Please add task details.' }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
function saved(value = approved) { return json({ success: true, data: { report: value } }) }

test('review decisions are explicit and changes require trimmed feedback within backend bounds', () => {
  assert.deepEqual(validateDailyReportReview({ status: 'approved' }), {})
  assert.deepEqual(validateDailyReportReview({ status: 'changes_requested', feedback: ' A ' }), {})
  assert.deepEqual(validateDailyReportReview({ status: 'changes_requested', feedback: 'A'.repeat(1000) }), {})
  for (const feedback of ['', ' ', null, 12, {}, 'A'.repeat(1001)]) assert.ok(validateDailyReportReview({ status: 'changes_requested', feedback }).feedback)
  for (const value of [null, {}, { status: '' }, { status: 'rejected' }, { status: 'submitted' }, { status: ['approved'] }, { status: 'constructor' }]) assert.ok(validateDailyReportReview(value).status)
})

test('only a matching assigned supervisor and submitted report are reviewable', () => {
  assert.equal(canReviewDailyReport(report, supervisorId), true)
  assert.equal(canReviewDailyReport({ ...report, internship: { ...internship, supervisor: supervisorId.toUpperCase() } }, supervisorId), true)
  for (const status of ['draft', 'approved', 'changes_requested']) assert.equal(canReviewDailyReport({ ...report, status }, supervisorId), false)
  for (const value of [null, {}, { ...report, _id: 'bad' }, { ...report, internship: null }, { ...report, internship: { ...internship, supervisor: null } }]) assert.equal(canReviewDailyReport(value, supervisorId), false)
  for (const id of [null, '', 'bad', student._id]) assert.equal(canReviewDailyReport(report, id), false)
})

test('review eligibility matches backend even when the internship is no longer active', () => {
  for (const status of ['assigned', 'active', 'completed', 'cancelled']) assert.equal(canReviewDailyReport({ ...report, internship: { ...internship, status } }, supervisorId), true)
})

test('approval PATCH sends no content, status, student, timestamp or reviewer fields', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/v1/daily-reports/${report._id}/approve`)
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer teacher-token')
    assert.equal(options.body, undefined)
    assert.equal(options.headers['Content-Type'], undefined)
    assert.equal(options.cache, 'no-store')
    return saved()
  })
  assert.equal((await reviewDailyReport('teacher-token', report, { status: 'approved', feedback: 'Ignored', reviewedBy: student._id }, supervisorId)).status, 'approved')
})

test('request-changes PATCH sends only the trimmed feedback', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/v1/daily-reports/${report._id}/request-changes`)
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), { feedback: returned.feedback })
    return saved(returned)
  })
  assert.equal((await reviewDailyReport('token', report, { status: 'changes_requested', feedback: ` ${returned.feedback} `, reviewedBy: student._id, hours: 24 }, supervisorId)).feedback, returned.feedback)
})

test('invalid decisions, unassigned supervisors, malformed records and missing tokens send no requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const values of [null, {}, { status: 'draft' }, { status: 'changes_requested', feedback: ' ' }]) await assert.rejects(reviewDailyReport('token', report, values, supervisorId))
  for (const value of [null, {}, { ...report, student: student._id }, { ...report, status: 'draft' }, { ...report, status: 'approved' },
    { ...report, submittedAt: null }, { ...report, internship: null }]) await assert.rejects(reviewDailyReport('token', value, { status: 'approved' }, supervisorId))
  await assert.rejects(reviewDailyReport('token', report, { status: 'approved' }, student._id))
  await assert.rejects(reviewDailyReport('', report, { status: 'approved' }, supervisorId), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('review confirmation requires matching identity, placement, day, status and current submission', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => saved(value))
  for (const invalid of [null, {}, { ...approved, _id: internship._id }, { ...approved, status: 'changes_requested', feedback: 'Other decision' },
    { ...approved, internship: student._id }, { ...approved, internship }, { ...approved, student: supervisorId }, { ...approved, student },
    { ...approved, date: '2026-01-04T00:00:00.000Z' }, { ...approved, submittedAt: '2026-01-03T10:01:00.000Z' }]) {
    value = invalid; await assert.rejects(reviewDailyReport('token', report, { status: 'approved' }, supervisorId), /review could not be confirmed/)
  }
})

test('reviews must preserve student content and contain this supervisors review metadata', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => saved(value))
  for (const invalid of [{ ...approved, hours: 8 }, { ...approved, tasks: 'Changed tasks' }, { ...approved, learning: 'Changed learning' },
    { ...approved, challenges: 'Changed challenge' }, { ...approved, reviewedBy: student._id }, { ...approved, reviewedBy: null },
    { ...approved, reviewedAt: null }, { ...approved, reviewedAt: 'invalid' }]) {
    value = invalid; await assert.rejects(reviewDailyReport('token', report, { status: 'approved' }, supervisorId), /review could not be confirmed/)
  }
})

test('feedback must match a change request, while approval preserves the last feedback after resubmission', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => saved(value))
  for (const feedback of ['', ' ', 'Different feedback']) {
    value = { ...returned, feedback }
    await assert.rejects(reviewDailyReport('token', report, { status: 'changes_requested', feedback: returned.feedback }, supervisorId), /review could not be confirmed/)
  }
  value = { ...approved, feedback: 'Previous feedback.' }
  assert.equal((await reviewDailyReport('token', { ...report, feedback: value.feedback }, { status: 'approved' }, supervisorId)).feedback, 'Previous feedback.')
  value = approved
  await assert.rejects(reviewDailyReport('token', { ...report, feedback: 'Previous feedback.' }, { status: 'approved' }, supervisorId), /review could not be confirmed/)
})

test('a deleted student remains readable/reviewable without inventing a populated identity', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => saved())
  assert.equal((await reviewDailyReport('token', { ...report, student: null }, { status: 'approved' }, supervisorId)).student, student._id)
})

test('validation, permission, missing-record and stale/conflicting review errors preserve backend messages', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => json({ success: false, message: 'Backend review explanation.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    await assert.rejects(reviewDailyReport('token', report, { status: 'approved' }, supervisorId), (error) => error.status === code && error.message === 'Backend review explanation.')
  }
})

test('JSON and non-JSON 401 responses require sign-in before parsing', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const make of [() => json({ success: false }, 401), () => new Response('Unauthorized', { status: 401 })]) {
    response = make()
    await assert.rejects(reviewDailyReport('token', report, { status: 'approved' }, supervisorId), (error) => error.status === 401)
  }
})

test('malformed responses and network errors never confirm or automatically retry a review', async (t) => {
  let response
  const fetch = t.mock.method(globalThis, 'fetch', async () => response)
  for (const make of [() => json(null), () => json({ success: 'true' }), () => new Response('Bad gateway', { status: 502 }),
    () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } })]) {
    response = make(); await assert.rejects(reviewDailyReport('token', report, { status: 'approved' }, supervisorId))
  }
  fetch.mock.mockImplementation(async () => { throw new TypeError('Network unavailable') })
  const before = fetch.mock.callCount()
  await assert.rejects(reviewDailyReport('token', report, { status: 'approved' }, supervisorId), TypeError)
  assert.equal(fetch.mock.callCount(), before + 1)
})

test('review requests support cancellation and the shared 15-second timeout', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) return reject(options.signal.reason)
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  const controller = new AbortController()
  const pending = reviewDailyReport('token', report, { status: 'approved' }, supervisorId, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  })
  await assert.rejects(reviewDailyReport('token', report, { status: 'approved' }, supervisorId), { name: 'TimeoutError' })
})
