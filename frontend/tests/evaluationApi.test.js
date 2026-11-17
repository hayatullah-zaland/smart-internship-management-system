import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEvaluation, fetchCompletedEvaluationInternships, fetchEvaluations, validateEvaluation } from '../src/context/evaluationApi.js'

const supervisor = { _id: '507f1f77bcf86cd799439016', name: 'Supervisor One', email: 'supervisor@example.com' }
const student = { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' }
const user = { id: supervisor._id, role: 'academic_supervisor' }
const representative = { id: '507f1f77bcf86cd799439019', role: 'company_representative' }
const internship = { _id: '507f1f77bcf86cd799439017', application: '507f1f77bcf86cd799439013', createdBy: '507f1f77bcf86cd799439015',
  status: 'completed', isOngoing: false, student, supervisor, company: null, opportunity: null, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-10-01T00:00:00.000Z' }
const values = { internshipId: internship._id, score: '0', comments: 'Final assessment comments.' }
const raw = { _id: '507f1f77bcf86cd799439020', internship: internship._id, student: student._id, evaluator: supervisor._id,
  type: 'academic', score: 0, comments: values.comments, createdAt: '2026-11-17T19:30:00.000Z' }
const evaluation = { ...raw, student, evaluator: { _id: supervisor._id, name: supervisor.name } }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
function saved(value = raw) { return json({ success: true, data: { evaluation: value } }) }
function listed(evaluations = [evaluation], page = 1) { return json({ success: true, data: { evaluations, page, limit: 10 } }) }

test('validation accepts explicit zero, upper bound and fractional scores without treating blank as zero', () => {
  for (const score of [0, '0', 100, '100', 72.5, '72.5']) assert.deepEqual(validateEvaluation({ ...values, score }), {})
  for (const score of ['', ' ', null, undefined, false, [], {}, NaN, Infinity, -1, 100.01]) assert.ok(validateEvaluation({ ...values, score }).score)
  assert.deepEqual(validateEvaluation({ ...values, comments: 'A'.repeat(2000) }), {})
  for (const comments of ['', ' ', null, {}, 'A'.repeat(2001)]) assert.ok(validateEvaluation({ ...values, comments }).comments)
  for (const internshipId of ['', 'bad', null, {}]) assert.ok(validateEvaluation({ ...values, internshipId }).internshipId)
})

test('list requests use backend-scoped bearer pagination without supplied student/evaluator filters', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/evaluations?page=1&limit=10')
    assert.equal(options.headers.Authorization, 'Bearer token')
    assert.equal(options.cache, 'no-store')
    return listed()
  })
  assert.deepEqual(await fetchEvaluations('token'), { evaluations: [evaluation], hasNextPage: false })
})

test('empty, full and maximum pages preserve the existing no-total pagination contract', async (t) => {
  let records = [], page = 1
  t.mock.method(globalThis, 'fetch', async () => listed(records, page))
  assert.deepEqual(await fetchEvaluations('token'), { evaluations: [], hasNextPage: false })
  records = Array.from({ length: 10 }, (_, index) => ({ ...evaluation, _id: (index + 1).toString(16).padStart(24, '0') }))
  assert.equal((await fetchEvaluations('token')).hasNextPage, true)
  page = 1000000
  assert.equal((await fetchEvaluations('token', page)).hasNextPage, false)
})

test('invalid pages and missing tokens do not send list requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch') })
  for (const page of [0, -1, 1.5, NaN, '1', 1000001]) await assert.rejects(fetchEvaluations('token', page))
  await assert.rejects(fetchEvaluations(''), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('invalid records, scores, people, timestamps and pagination cannot become successful lists', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const item of [null, {}, { ...evaluation, score: '0' }, { ...evaluation, score: -1 }, { ...evaluation, score: 101 },
    { ...evaluation, type: 'combined' }, { ...evaluation, comments: ' ' }, { ...evaluation, comments: 'A'.repeat(2001) },
    { ...evaluation, createdAt: null }, { ...evaluation, internship: {} }, { ...evaluation, student: student._id },
    { ...evaluation, evaluator: supervisor._id }, { ...evaluation, evaluator: { ...supervisor, name: '' } }]) {
    response = listed([item]); await assert.rejects(fetchEvaluations('token'), /invalid evaluation data/)
  }
  for (const data of [{ evaluations: [evaluation, evaluation], page: 1, limit: 10 }, { evaluations: [], page: 2, limit: 10 },
    { evaluations: [], page: 1, limit: 20 }, { evaluations: Array(11).fill(evaluation), page: 1, limit: 10 }]) {
    response = json({ success: true, data }); await assert.rejects(fetchEvaluations('token'), /invalid evaluation data/)
  }
})

test('academic and company records remain distinct and deleted people remain readable', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => listed([value]))
  for (const type of ['academic', 'company']) {
    value = { ...evaluation, type, student: null, evaluator: null }
    assert.equal((await fetchEvaluations('token')).evaluations[0].type, type)
  }
})

test('completed choices scan every page and filter incomplete, reassigned and unidentified students', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url)
    const page = calls.length
    const rows = Array.from({ length: page === 1 ? 10 : 1 }, (_, index) => ({ ...internship, _id: (page * 100 + index).toString(16).padStart(24, '0'),
      status: index > 2 ? 'active' : 'completed', isOngoing: index > 2,
      supervisor: index === 1 ? { ...supervisor, _id: representative.id } : supervisor, student: index === 2 ? null : student }))
    return json({ success: true, data: { internships: rows, page, limit: 10 } })
  })
  assert.equal((await fetchCompletedEvaluationInternships('token', user.id)).length, 2)
  assert.deepEqual(calls, ['/api/v1/internships?page=1&limit=10', '/api/v1/internships?page=2&limit=10'])
})

test('academic creation sends only internship ID, numeric score and trimmed comments', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/evaluations')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer token')
    assert.deepEqual(JSON.parse(options.body), { internshipId: internship._id, score: 0, comments: values.comments })
    return saved()
  })
  assert.equal((await createEvaluation('token', { ...values, comments: ` ${values.comments} `, student: representative.id, evaluator: representative.id, type: 'company' }, user, internship)).score, 0)
})

test('company creation uses the provided internship ID without querying forbidden internship or company lists', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/evaluations')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { internshipId: internship._id, score: 100, comments: values.comments })
    return saved({ ...raw, evaluator: representative.id, type: 'company', score: 100 })
  })
  assert.equal((await createEvaluation('token', { ...values, score: '100' }, representative)).type, 'company')
  assert.equal(fetch.mock.callCount(), 1)
})

test('students, admins, invalid fields and unassigned/incomplete academic placements cannot send writes', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch') })
  for (const value of [null, {}, { ...user, role: 'student' }, { ...user, role: 'admin' }, { ...user, id: 'bad' }]) await assert.rejects(createEvaluation('token', values, value, internship))
  for (const value of [{ ...values, score: '' }, { ...values, score: -1 }, { ...values, comments: ' ' }, { ...values, internshipId: 'bad' }]) await assert.rejects(createEvaluation('token', value, user, internship))
  for (const placement of [null, {}, { ...internship, status: 'active' }, { ...internship, _id: student._id },
    { ...internship, student: null }, { ...internship, supervisor: { ...supervisor, _id: representative.id } }]) await assert.rejects(createEvaluation('token', values, user, placement))
  await assert.rejects(createEvaluation('', values, user, internship), (error) => error.status === 401)
  await assert.rejects(fetchCompletedEvaluationInternships('token', 'bad'))
  assert.equal(fetch.mock.callCount(), 0)
})

test('creation confirmation requires correct identity, type, score, comments and creation timestamp', async (t) => {
  let value
  t.mock.method(globalThis, 'fetch', async () => saved(value))
  for (const item of [null, {}, { ...raw, internship: student._id }, { ...raw, evaluator: representative.id }, { ...raw, student: representative.id },
    { ...raw, evaluator: supervisor }, { ...raw, student }, { ...raw, type: 'company' }, { ...raw, score: 1 },
    { ...raw, comments: 'Different comments' }, { ...raw, createdAt: 'invalid' }]) {
    value = item; await assert.rejects(createEvaluation('token', values, user, internship), /could not be confirmed/)
  }
  value = raw
  await assert.rejects(createEvaluation('token', values, representative), /could not be confirmed/)
})

test('case-insensitive ObjectId comparison accepts canonical server IDs without changing grade content', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => saved())
  assert.equal((await createEvaluation('token', { ...values, internshipId: values.internshipId.toUpperCase() }, { ...user, id: user.id.toUpperCase() }, internship)).type, 'academic')
})

test('backend validation, assignment, completion and duplicate errors preserve their real messages/statuses', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => json({ success: false, message: 'Backend evaluation explanation.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    for (const action of [() => fetchEvaluations('token'), () => createEvaluation('token', values, user, internship)]) {
      await assert.rejects(action(), (error) => error.status === code && error.message === 'Backend evaluation explanation.')
    }
  }
})

test('JSON and non-JSON 401 responses require sign-in for reads and writes', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const make of [() => json({ success: false }, 401), () => new Response('Unauthorized', { status: 401 })]) {
    for (const action of [() => fetchEvaluations('token'), () => createEvaluation('token', values, user, internship)]) {
      response = make(); await assert.rejects(action(), (error) => error.status === 401)
    }
  }
})

test('malformed responses and network failures never confirm or automatically retry a final grade', async (t) => {
  let response
  const fetch = t.mock.method(globalThis, 'fetch', async () => response)
  for (const make of [() => json(null), () => json({ success: 'true' }), () => new Response('Bad gateway', { status: 502 }),
    () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } })]) {
    response = make(); await assert.rejects(createEvaluation('token', values, user, internship))
  }
  fetch.mock.mockImplementation(async () => { throw new TypeError('Network unavailable') })
  const before = fetch.mock.callCount()
  await assert.rejects(createEvaluation('token', values, user, internship), TypeError)
  assert.equal(fetch.mock.callCount(), before + 1)
})

test('reads and final-grade requests support cancellation and the shared timeout', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) return reject(options.signal.reason)
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  for (const action of [(signal) => fetchEvaluations('token', 1, signal), (signal) => createEvaluation('token', values, user, internship, signal)]) {
    const controller = new AbortController()
    const pending = action(controller.signal)
    controller.abort()
    await assert.rejects(pending, { name: 'AbortError' })
  }
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  })
  await assert.rejects(createEvaluation('token', values, user, internship), { name: 'TimeoutError' })
})
