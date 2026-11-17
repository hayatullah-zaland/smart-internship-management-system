import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchStudentProfile, saveStudentProfile, validateStudentProfile } from '../src/context/studentProfileApi.js'
import { fetchDepartments } from '../src/context/departmentApi.js'

const department = { _id: '507f1f77bcf86cd799439011', name: 'Computer Science', code: 'CS' }
const values = { studentNumber: 'STU-001', departmentId: department._id, semester: 3, phone: '+93 700 123 456' }
const profile = { _id: '507f1f77bcf86cd799439012', ...values, department }

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

test('valid academic values accept the backend boundary rules', () => {
  for (const semester of [1, '3', 12]) {
    assert.deepEqual(validateStudentProfile({ ...values, semester }), {})
  }
  for (const studentNumber of ['a', 'stu-001', 'A'.repeat(30)]) {
    assert.deepEqual(validateStudentProfile({ ...values, studentNumber }), {})
  }
  assert.deepEqual(validateStudentProfile({ ...values, phone: '1234567' }), {})
})

test('field validation rejects invalid student numbers, departments, semesters and phones', () => {
  const invalidValues = {
    studentNumber: ['', 'STU 1', 'STU_1', 'A'.repeat(31), null],
    departmentId: ['', 'department-name', 'x'.repeat(24), null],
    semester: ['', 0, 13, 1.5, 'abc', true, null],
    phone: ['', '123456', '+(---)---', 'phone1234567', '1'.repeat(26), null],
  }
  for (const [field, invalid] of Object.entries(invalidValues)) {
    for (const value of invalid) {
      assert.ok(validateStudentProfile({ ...values, [field]: value })[field], `${field}: ${value}`)
    }
  }
})

test('GET profile uses bearer auth and maps a populated department into form values', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/students/me')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.equal(options.headers.Accept, 'application/json')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.body, undefined)
    assert.ok(options.signal instanceof AbortSignal)
    return jsonResponse({ success: true, data: { profile } })
  })
  assert.deepEqual(await fetchStudentProfile('test-token'), values)
})

test('only the profile GET treats a JSON 404 as a not-yet-created profile', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'Not found.' }, 404))
  assert.equal(await fetchStudentProfile('test-token'), null)
  await assert.rejects(fetchDepartments('test-token'), (error) => error.status === 404)
  await assert.rejects(saveStudentProfile('test-token', values), (error) => error.status === 404)
})

test('a non-JSON 404 is an unavailable service, not a blank profile', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Not found</html>', { status: 404 }))
  await assert.rejects(fetchStudentProfile('test-token'), /unavailable right now/)
})

test('departments load every page rather than silently truncating the dropdown', async (t) => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    _id: (index + 1).toString(16).padStart(24, '0'), name: `Department ${index + 1}`, code: `D-${index + 1}`,
  }))
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url)
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    const page = calls.length
    return jsonResponse({ success: true, data: { departments: page === 1 ? firstPage : [department], page, limit: 100 } })
  })
  assert.deepEqual(await fetchDepartments('test-token'), [...firstPage, department])
  assert.deepEqual(calls, ['/api/v1/departments?page=1&limit=100', '/api/v1/departments?page=2&limit=100'])
})

test('empty departments remain an empty list without invented options', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: true, data: { departments: [], page: 1, limit: 100 } }))
  assert.deepEqual(await fetchDepartments('test-token'), [])
})

test('PUT creates or updates only academic fields and handles the unpopulated department response', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/students/me')
    assert.equal(options.method, 'PUT')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), values)
    return jsonResponse({ success: true, data: { profile: { ...profile, department: department._id } } })
  })
  const result = await saveStudentProfile('test-token', {
    ...values, studentNumber: ' stu-001 ', phone: ' +93 700 123 456 ', semester: '3',
    user: 'another-user', role: 'admin', email: 'changed@example.com',
  })
  assert.deepEqual(result, values)
})

test('changing a student number and department uses PUT and is returned by the next profile GET', async (t) => {
  const edited = { ...values, studentNumber: 'STU-002', departmentId: '507f1f77bcf86cd799439022' }
  let stored = { ...profile, department: department._id }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/students/me')
    if (options.method === 'PUT') {
      const payload = JSON.parse(options.body)
      assert.deepEqual(payload, edited)
      stored = { ...stored, ...payload, department: payload.departmentId }
    } else {
      assert.equal(options.method, 'GET')
    }
    return jsonResponse({ success: true, data: { profile: stored } })
  })
  assert.deepEqual(await saveStudentProfile('test-token', edited), edited)
  assert.deepEqual(await fetchStudentProfile('test-token'), edited)
})

test('missing tokens and invalid saves do not send requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const token of ['', undefined, null, 123]) {
    await assert.rejects(fetchStudentProfile(token), (error) => error.status === 401)
    await assert.rejects(fetchDepartments(token), (error) => error.status === 401)
    await assert.rejects(saveStudentProfile(token, values), (error) => error.status === 401)
  }
  await assert.rejects(saveStudentProfile('test-token', { ...values, semester: 15 }), /1 to 12/)
  assert.equal(fetch.mock.callCount(), 0)
})

test('every endpoint recognizes JSON and non-JSON 401 without treating them as missing data', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const body of [jsonResponse({ success: false }, 401), new Response('Unauthorized', { status: 401 })]) {
    for (const action of [fetchStudentProfile, fetchDepartments, (token) => saveStudentProfile(token, values)]) {
      response = body.clone()
      await assert.rejects(action('test-token'), (error) => error.status === 401)
    }
  }
})

test('backend validation, duplicate numbers, forbidden access and server errors retain their messages', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'Please check your profile.' }, status))
  for (const code of [400, 403, 409, 500]) {
    status = code
    await assert.rejects(saveStudentProfile('test-token', values),
      (error) => error.status === code && error.message === 'Please check your profile.')
  }
})

test('malformed responses and non-boolean success values are rejected', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const value of [
    new Response('Bad gateway', { status: 502 }),
    new Response('{invalid', { headers: { 'Content-Type': 'application/json' } }),
    jsonResponse(null), jsonResponse({ success: 'true', data: { profile } }),
    jsonResponse({ success: true, data: {} }),
    jsonResponse({ success: true, data: { profile: { ...profile, semester: '3' } } }),
    jsonResponse({ success: true, data: { profile: { ...profile, department: null } } }),
  ]) {
    response = value
    await assert.rejects(fetchStudentProfile('test-token'))
  }
})

test('invalid department data or incorrect pagination cannot enter the form', async (t) => {
  let data
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: true, data }))
  for (const entry of [null, {}, { ...department, _id: [] }, { ...department, name: '' }, { ...department, code: null }]) {
    data = { departments: [entry], page: 1, limit: 100 }
    await assert.rejects(fetchDepartments('test-token'), /invalid department data/)
  }
  for (const invalid of [{ departments: [], page: 2, limit: 100 }, { departments: [], page: 1, limit: 20 },
    { departments: null, page: 1, limit: 100 }]) {
    data = invalid
    await assert.rejects(fetchDepartments('test-token'), /invalid department data/)
  }
})

test('network failures preserve their type for the form and loading error messages', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network unavailable') })
  await assert.rejects(fetchStudentProfile('test-token'), TypeError)
  await assert.rejects(saveStudentProfile('test-token', values), TypeError)
})

test('the page can cancel both profile loading and saving', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  for (const action of [fetchStudentProfile, fetchDepartments, (token, signal) => saveStudentProfile(token, values, signal)]) {
    const controller = new AbortController()
    const request = action('test-token', controller.signal)
    controller.abort()
    await assert.rejects(request, { name: 'AbortError' })
  }
})

test('requests combine caller cancellation with a 15-second timeout', async (t) => {
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Request timed out', 'TimeoutError'))
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => options.signal.throwIfAborted())
  await assert.rejects(fetchStudentProfile('test-token', new AbortController().signal), { name: 'TimeoutError' })
})
