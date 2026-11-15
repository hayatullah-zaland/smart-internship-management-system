import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dashboardFields, fetchDashboardStats } from './dashboardApi.js'

const fixtures = {
  admin: { students: 12, companies: 3, departments: 2, pendingApplications: 0, activeInternships: 5, completedInternships: 4 },
  student: { applications: 2, activeInternships: 0, dailyReports: 8, weeklyReports: 1, evaluations: 0 },
  academic_supervisor: { assignedInternships: 3, activeInternships: 2, submittedDailyReports: 0, submittedWeeklyReports: 1, evaluations: 1 },
  company_representative: { companies: 1, openOpportunities: 0, activeInternships: 2, completedInternships: 1, evaluations: 0 },
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

for (const [role, stats] of Object.entries(fixtures)) {
  test(`loads ${role} counters with bearer authentication and preserves zero`, async (t) => {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, '/api/v1/dashboard/stats')
      assert.equal(options.method, 'GET')
      assert.equal(options.headers.Authorization, 'Bearer test-token')
      assert.equal(options.headers.Accept, 'application/json')
      assert.equal(options.cache, 'no-store')
      assert.equal(options.body, undefined)
      assert.ok(options.signal instanceof AbortSignal)
      return jsonResponse({ success: true, data: { role, stats } })
    })
    assert.deepEqual(dashboardFields[role], Object.keys(stats))
    assert.deepEqual(await fetchDashboardStats('test-token', role), stats)
  })
}

test('missing tokens and unsupported roles do not send a request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const token of ['', null, undefined, 123]) {
    await assert.rejects(fetchDashboardStats(token, 'student'), (error) => error.status === 401)
  }
  for (const role of ['owner', 'toString']) {
    await assert.rejects(fetchDashboardStats('test-token', role), /not available for this account/)
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('JSON and non-JSON 401 responses both request sign-in', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const body of [jsonResponse({ success: false }, 401), new Response('Unauthorized', { status: 401 })]) {
    response = body
    await assert.rejects(fetchDashboardStats('test-token', 'student'), (error) => error.status === 401)
  }
})

test('forbidden and server errors remain errors instead of returning counters', async (t) => {
  let status = 403
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'Dashboard access denied.' }, status))
  for (const code of [403, 500]) {
    status = code
    await assert.rejects(fetchDashboardStats('test-token', 'student'), (error) => error.status !== 401 && /access denied/.test(error.message))
  }
})

test('non-JSON and malformed JSON responses have readable errors', async (t) => {
  let response = new Response('<html>Bad gateway</html>', { status: 502 })
  t.mock.method(globalThis, 'fetch', async () => response)
  await assert.rejects(fetchDashboardStats('test-token', 'student'), /unavailable right now/)
  response = new Response('{invalid', { headers: { 'Content-Type': 'application/json' } })
  await assert.rejects(fetchDashboardStats('test-token', 'student'), /returned invalid data/)
})

test('only an explicit success response is accepted', async (t) => {
  let result
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(result))
  for (const data of [null, {}, { success: false }, { success: 'true', data: { role: 'student', stats: fixtures.student } }]) {
    result = data
    await assert.rejects(fetchDashboardStats('test-token', 'student'), /Unable to load/)
  }
})

test('wrong roles, missing counters and invalid numeric values are rejected', async (t) => {
  let stats = fixtures.student
  let role = 'admin'
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: true, data: { role, stats } }))
  await assert.rejects(fetchDashboardStats('test-token', 'student'), /invalid data for your account/)
  role = 'student'
  const { weeklyReports, ...incomplete } = fixtures.student
  assert.equal(weeklyReports, 1)
  for (const value of [null, [], {}, incomplete, -1, '2', 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    stats = typeof value === 'number' || typeof value === 'string'
      ? { ...fixtures.student, applications: value }
      : value
    await assert.rejects(fetchDashboardStats('test-token', 'student'), /invalid data for your account/)
  }
})

test('network errors remain distinguishable from server data errors', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed') })
  await assert.rejects(fetchDashboardStats('test-token', 'student'), { name: 'TypeError' })
})

test('cancelling the caller also aborts the pending request', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  const controller = new AbortController()
  const request = fetchDashboardStats('test-token', 'student', controller.signal)
  controller.abort()
  await assert.rejects(request, { name: 'AbortError' })
})

test('the 15-second timeout is combined with caller cancellation', async (t) => {
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Request timed out', 'TimeoutError'))
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => options.signal.throwIfAborted())
  await assert.rejects(fetchDashboardStats('test-token', 'student', new AbortController().signal), { name: 'TimeoutError' })
})
