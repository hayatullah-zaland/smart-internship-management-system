import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDepartment, fetchDepartments, validateDepartment } from '../src/context/departmentApi.js'

const department = { _id: '507f1f77bcf86cd799439011', name: 'Computer Science', code: 'CS' }

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

test('department validation follows backend name and code boundaries', () => {
  for (const name of ['CS', 'Computer Science', 'A'.repeat(100), '  Engineering  ']) {
    assert.deepEqual(validateDepartment({ name, code: 'cs-1' }), {})
  }
  for (const code of ['A', 'CS-1', 'a'.repeat(20)]) {
    assert.deepEqual(validateDepartment({ name: 'Engineering', code }), {})
  }
  for (const name of ['', ' ', 'A', 'A'.repeat(101), null, 123]) {
    assert.ok(validateDepartment({ name, code: 'CS' }).name)
  }
  for (const code of ['', ' ', 'CS 1', 'CS_1', 'A'.repeat(21), null, 123]) {
    assert.ok(validateDepartment({ name: 'Computer Science', code }).code)
  }
})

test('POST sends only a trimmed name and uppercased code with bearer authentication', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/departments')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer admin-token')
    assert.equal(options.headers.Accept, 'application/json')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.equal(options.cache, 'no-store')
    assert.ok(options.signal instanceof AbortSignal)
    assert.deepEqual(JSON.parse(options.body), { name: 'Computer Science', code: 'CS' })
    return jsonResponse({ success: true, data: { department } }, 201)
  })
  assert.deepEqual(await createDepartment('admin-token', {
    name: ' Computer Science ', code: ' cs ', role: 'admin', user: 'another-user', _id: 'client-chosen-id',
  }), department)
})

test('a newly created department is available through the same list API used by students', async (t) => {
  const stored = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'POST') {
      stored.push({ _id: department._id, ...JSON.parse(options.body) })
      return jsonResponse({ success: true, data: { department: stored[0] } }, 201)
    }
    assert.equal(url, '/api/v1/departments?page=1&limit=100')
    return jsonResponse({ success: true, data: { departments: stored, page: 1, limit: 100 } })
  })
  await createDepartment('admin-token', { name: department.name, code: department.code })
  assert.deepEqual(await fetchDepartments('student-token'), [department])
})

test('invalid department forms and missing tokens cannot send a create request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  await assert.rejects(createDepartment('admin-token', { name: 'X', code: 'CS' }), /2 and 100/)
  await assert.rejects(createDepartment('admin-token', { name: 'Engineering', code: 'invalid code' }), /1-20/)
  for (const token of [null, undefined, '', 123]) {
    await assert.rejects(createDepartment(token, { name: 'Engineering', code: 'ENG' }), (error) => error.status === 401)
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('duplicate codes, forbidden access and server failures preserve the backend error', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'This department code already exists.' }, status))
  for (const code of [400, 403, 409, 500]) {
    status = code
    await assert.rejects(createDepartment('admin-token', department),
      (error) => error.status === code && error.message === 'This department code already exists.')
  }
})

test('JSON and non-JSON 401 responses require sign-in before response parsing', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const value of [jsonResponse({ success: false }, 401), new Response('Unauthorized', { status: 401 })]) {
    response = value
    await assert.rejects(createDepartment('admin-token', department), (error) => error.status === 401)
  }
})

test('malformed create responses do not falsely confirm a new department', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const value of [
    new Response('Bad gateway', { status: 502 }),
    new Response('{invalid', { headers: { 'Content-Type': 'application/json' } }),
    jsonResponse(null), jsonResponse({ success: 'true', data: { department } }),
    jsonResponse({ success: true, data: {} }),
    jsonResponse({ success: true, data: { department: { ...department, _id: 'invalid-id' } } }),
    jsonResponse({ success: true, data: { department: { ...department, name: '' } } }),
    jsonResponse({ success: true, data: { department: { ...department, code: null } } }),
  ]) {
    response = value
    await assert.rejects(createDepartment('admin-token', department))
  }
})

test('network failures remain distinguishable from successful creation', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network unavailable') })
  await assert.rejects(createDepartment('admin-token', department), TypeError)
})

test('creation is cancelled when the form leaves the page', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  const controller = new AbortController()
  const request = createDepartment('admin-token', department, controller.signal)
  controller.abort()
  await assert.rejects(request, { name: 'AbortError' })
})

test('department creation uses the shared 15-second timeout', async (t) => {
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Request timed out', 'TimeoutError'))
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => options.signal.throwIfAborted())
  await assert.rejects(createDepartment('admin-token', department, new AbortController().signal), { name: 'TimeoutError' })
})
