import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchOpportunities, MAX_OPPORTUNITIES_PAGE, OPPORTUNITIES_PAGE_SIZE } from '../src/context/opportunityApi.js'

const opportunity = {
  _id: '507f1f77bcf86cd799439011', title: 'Frontend Intern', description: 'Build university tools.\nWork with the team.',
  company: { _id: '507f1f77bcf86cd799439012', name: 'Example Company', address: 'Kabul, Afghanistan' },
  deadline: '2026-11-20T19:30:00.000Z', capacity: 3, status: 'open',
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function pageResponse(opportunities = [opportunity], page = 1, limit = OPPORTUNITIES_PAGE_SIZE) {
  return jsonResponse({ success: true, data: { opportunities, page, limit } })
}

test('opportunity browsing uses the shared bearer request with real server pagination', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/opportunities?page=2&limit=10')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.equal(options.headers.Accept, 'application/json')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.body, undefined)
    assert.ok(options.signal instanceof AbortSignal)
    return pageResponse([opportunity], 2)
  })
  assert.deepEqual(await fetchOpportunities('test-token', 2), { opportunities: [opportunity], hasNextPage: false })
})

test('a full page may have a next page without inventing a total', async (t) => {
  const fullPage = Array.from({ length: OPPORTUNITIES_PAGE_SIZE }, (_, index) => ({
    ...opportunity, _id: (index + 1).toString(16).padStart(24, '0'),
  }))
  let page = 1
  t.mock.method(globalThis, 'fetch', async () => pageResponse(fullPage, page))
  const result = await fetchOpportunities('test-token')
  assert.equal(result.hasNextPage, true)
  assert.equal(result.opportunities.length, OPPORTUNITIES_PAGE_SIZE)
  assert.equal(result.total, undefined)
  page = MAX_OPPORTUNITIES_PAGE
  assert.equal((await fetchOpportunities('test-token', page)).hasNextPage, false)
})

test('empty and partial pages do not invent opportunities or a next page', async (t) => {
  let items = []
  t.mock.method(globalThis, 'fetch', async () => pageResponse(items))
  assert.deepEqual(await fetchOpportunities('test-token'), { opportunities: [], hasNextPage: false })
  items = [opportunity]
  assert.deepEqual(await fetchOpportunities('test-token'), { opportunities: items, hasNextPage: false })
})

test('invalid page numbers and missing tokens never send requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const page of [0, -1, 1.5, '2', NaN, Infinity, MAX_OPPORTUNITIES_PAGE + 1]) {
    await assert.rejects(fetchOpportunities('test-token', page), /valid opportunities page/)
  }
  for (const token of ['', null, undefined, 123]) {
    await assert.rejects(fetchOpportunities(token), (error) => error.status === 401)
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('incorrect page metadata, oversized pages and duplicate IDs are rejected', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const value of [
    pageResponse([opportunity], 2), pageResponse([opportunity], 1, 20),
    pageResponse(Array(11).fill(opportunity)), pageResponse([opportunity, opportunity]),
    jsonResponse({ success: true, data: {} }), pageResponse(null),
  ]) {
    response = value
    await assert.rejects(fetchOpportunities('test-token'), /invalid opportunity data/)
  }
})

test('invalid IDs, titles, descriptions, deadlines, capacities and statuses cannot enter the list', async (t) => {
  let item
  t.mock.method(globalThis, 'fetch', async () => pageResponse([item]))
  const invalid = {
    _id: ['', 'invalid', null], title: ['', 'A', 'A'.repeat(151), null],
    description: ['', ' ', 'A'.repeat(5001), null], deadline: ['not-a-date', null, 123],
    capacity: [0, -1, 1001, 1.5, '3', null], status: ['closed', 'archived', null],
  }
  for (const [field, values] of Object.entries(invalid)) {
    for (const value of values) {
      item = { ...opportunity, [field]: value }
      await assert.rejects(fetchOpportunities('test-token'), /invalid opportunity data/, `${field}: ${value}`)
    }
  }
})

test('populated companies are validated while a missing referenced company remains explicitly null', async (t) => {
  let company = null
  t.mock.method(globalThis, 'fetch', async () => pageResponse([{ ...opportunity, company }]))
  assert.equal((await fetchOpportunities('test-token')).opportunities[0].company, null)
  for (const value of [undefined, 'company-id', {}, [], { ...opportunity.company, _id: 'bad' },
    { ...opportunity.company, name: '' }, { ...opportunity.company, address: '' }]) {
    company = value
    await assert.rejects(fetchOpportunities('test-token'), /invalid opportunity data/)
  }
})

test('capacity boundaries remain valid and deadline expiry is left to the backend query on refresh', async (t) => {
  let capacity = 1
  t.mock.method(globalThis, 'fetch', async () => pageResponse([{ ...opportunity, capacity, deadline: '2020-01-01T00:00:00.000Z' }]))
  for (const value of [1, 1000]) {
    capacity = value
    assert.equal((await fetchOpportunities('test-token')).opportunities[0].capacity, value)
  }
})

test('JSON and non-JSON 401 responses request sign-in', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const value of [jsonResponse({ success: false }, 401), new Response('Unauthorized', { status: 401 })]) {
    response = value
    await assert.rejects(fetchOpportunities('test-token'), (error) => error.status === 401)
  }
})

test('forbidden and server failures remain errors, not empty successful lists', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'Unable to browse opportunities.' }, status))
  for (const code of [403, 404, 500]) {
    status = code
    await assert.rejects(fetchOpportunities('test-token'), (error) => error.status === code && /Unable to browse/.test(error.message))
  }
})

test('non-JSON, malformed JSON and non-boolean success responses are rejected', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const value of [
    new Response('Bad gateway', { status: 502 }),
    new Response('{invalid', { headers: { 'Content-Type': 'application/json' } }),
    jsonResponse(null), jsonResponse({ success: 'true', data: { opportunities: [opportunity], page: 1, limit: 10 } }),
  ]) {
    response = value
    await assert.rejects(fetchOpportunities('test-token'))
  }
})

test('network failures keep their type for a readable connection error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network unavailable') })
  await assert.rejects(fetchOpportunities('test-token'), TypeError)
})

test('page navigation can cancel an obsolete request', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  const controller = new AbortController()
  const request = fetchOpportunities('test-token', 1, controller.signal)
  controller.abort()
  await assert.rejects(request, { name: 'AbortError' })
})

test('opportunity requests keep the shared 15-second timeout', async (t) => {
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 15000)
    return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => options.signal.throwIfAborted())
  await assert.rejects(fetchOpportunities('test-token', 1, new AbortController().signal), { name: 'TimeoutError' })
})
