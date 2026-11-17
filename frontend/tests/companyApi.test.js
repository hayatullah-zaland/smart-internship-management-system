import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assignCompanyRepresentative, COMPANIES_PAGE_SIZE, createCompany, fetchCompanies, fetchCompanyRepresentatives, MAX_COMPANIES_PAGE, validateCompany, validateCompanyRepresentative } from '../src/context/companyApi.js'

const adminId = '507f1f77bcf86cd799439099'
const company = { _id: '507f1f77bcf86cd799439011', name: 'Test Company', address: 'Kabul, Afghanistan', contactEmail: 'office@example.com', createdBy: adminId, representative: null, createdAt: '2026-11-16T22:00:00.000Z' }
const representative = { id: '507f1f77bcf86cd799439012', name: 'Test Representative', email: 'rep@example.com', role: 'company_representative', isActive: true }
const values = { name: ' Test Company ', address: ' Kabul, Afghanistan ', contactEmail: ' OFFICE@example.com ' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const savedResponse = (saved = company) => json({ success: true, data: { company: saved } })
const listedResponse = (companies = [company], page = 1, limit = COMPANIES_PAGE_SIZE) => json({ success: true, data: { companies, page, limit } })
const listedUser = (user = representative) => ({ _id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: company.createdAt })

test('company validation follows name, address and contact-email boundaries', () => {
  for (const name of ['AB', 'A'.repeat(150), ' Test Company ']) assert.deepEqual(validateCompany({ ...values, name }), {})
  for (const address of ['A', 'A'.repeat(300), ' Kabul ']) assert.deepEqual(validateCompany({ ...values, address }), {})
  for (const name of ['', ' ', 'X', 'A'.repeat(151), null, 123]) assert.ok(validateCompany({ ...values, name }).name)
  for (const address of ['', ' ', 'A'.repeat(301), null, 123]) assert.ok(validateCompany({ ...values, address }).address)
  for (const contactEmail of ['', 'invalid', 'a@@example.com', 'a b@example.com', 'a'.repeat(250) + '@example.com', null]) {
    assert.ok(validateCompany({ ...values, contactEmail }).contactEmail)
  }
})

test('company listing uses authenticated server pagination without unsupported filters', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/companies?page=2&limit=10')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer admin-token')
    assert.equal(options.body, undefined)
    assert.equal(options.cache, 'no-store')
    return listedResponse([company], 2)
  })
  assert.deepEqual(await fetchCompanies('admin-token', 2), { companies: [company], hasNextPage: false })
})

test('empty and full company pages preserve real pagination without invented totals', async (t) => {
  let batch = []
  let page = 1
  t.mock.method(globalThis, 'fetch', async () => listedResponse(batch, page))
  assert.deepEqual(await fetchCompanies('token'), { companies: [], hasNextPage: false })
  batch = Array.from({ length: 10 }, (_, index) => ({ ...company, _id: index.toString(16).padStart(24, '0') }))
  assert.equal((await fetchCompanies('token')).hasNextPage, true)
  page = MAX_COMPANIES_PAGE
  assert.equal((await fetchCompanies('token', page)).hasNextPage, false)
})

test('invalid pagination and missing tokens never send requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const page of [0, -1, 1.5, '1', NaN, MAX_COMPANIES_PAGE + 1]) await assert.rejects(fetchCompanies('token', page))
  for (const token of ['', null, undefined, 123]) {
    for (const action of [() => fetchCompanies(token), () => fetchCompanyRepresentatives(token),
      () => createCompany(token, values, adminId), () => assignCompanyRepresentative(token, company, representative)]) {
      await assert.rejects(action(), (error) => error.status === 401)
    }
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('invalid company records, duplicates and wrong page metadata are rejected', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  const invalid = [null, { ...company, _id: 'invalid' }, { ...company, createdBy: null }, { ...company, name: '' },
    { ...company, address: '' }, { ...company, contactEmail: 'invalid' }, { ...company, representative: {} }, { ...company, createdAt: 'invalid' }]
  for (const data of [{ companies: null, page: 1, limit: 10 }, { companies: [company], page: 2, limit: 10 },
    { companies: [company], page: 1, limit: 20 }, { companies: Array(11).fill(company), page: 1, limit: 10 },
    { companies: [company, company], page: 1, limit: 10 }, ...invalid.map((value) => ({ companies: [value], page: 1, limit: 10 }))]) {
    response = json({ success: true, data })
    await assert.rejects(fetchCompanies('token'), /invalid company data/)
  }
})

test('all user pages are scanned and inactive representatives remain identifiable without offering other roles', async (t) => {
  const calls = []
  const inactive = { ...representative, id: '507f1f77bcf86cd799439013', isActive: false }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url)
    assert.equal(options.headers.Authorization, 'Bearer token')
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page'))
    const users = page === 1 ? Array.from({ length: 10 }, (_, index) => listedUser({ ...representative,
      id: index.toString(16).padStart(24, '0'), role: index ? 'student' : 'admin' })) : [listedUser(representative), listedUser(inactive)]
    return json({ success: true, data: { users, page, limit: 10 } })
  })
  assert.deepEqual(await fetchCompanyRepresentatives('token'), [
    { ...representative, createdAt: company.createdAt }, { ...inactive, createdAt: company.createdAt },
  ])
  assert.deepEqual(calls, ['/api/v1/users?page=1&limit=10', '/api/v1/users?page=2&limit=10'])
})

test('empty user pages stay empty and a failed later page never returns a partial representative list', async (t) => {
  let fail = false
  t.mock.method(globalThis, 'fetch', async (url) => {
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page'))
    if (page === 2) return json({ success: false, message: 'Unavailable' }, 503)
    const users = fail ? Array.from({ length: 10 }, (_, index) => listedUser({ ...representative, id: index.toString(16).padStart(24, '0') })) : []
    return json({ success: true, data: { users, page, limit: 10 } })
  })
  assert.deepEqual(await fetchCompanyRepresentatives('token'), [])
  fail = true
  await assert.rejects(fetchCompanyRepresentatives('token'), (error) => error.status === 503)
})

test('create sends only trimmed fields and lowercase contact email, never client ownership or representative data', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/companies')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer token')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), { name: company.name, address: company.address, contactEmail: company.contactEmail })
    return savedResponse()
  })
  assert.deepEqual(await createCompany('token', { ...values, createdBy: 'chosen-id', representative: representative.id, _id: 'chosen-id' }, adminId), company)
})

test('invalid forms or missing admin identity cannot create companies', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const changed of [{ name: '' }, { address: '' }, { contactEmail: 'invalid' }]) await assert.rejects(createCompany('token', { ...values, ...changed }, adminId))
  await assert.rejects(createCompany('token', values, 'invalid-id'))
  assert.equal(fetch.mock.callCount(), 0)
})

test('create verifies all saved form values, creator and initially unassigned representative', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const saved of [null, { ...company, name: 'Other Company' }, { ...company, address: 'Other address' },
    { ...company, contactEmail: 'other@example.com' }, { ...company, createdBy: representative.id },
    { ...company, representative: representative.id }, { ...company, createdAt: null }]) {
    response = savedResponse(saved)
    await assert.rejects(createCompany('token', values, adminId), /could not be confirmed/)
  }
})

test('assignment validation permits only a different active company representative', () => {
  assert.deepEqual(validateCompanyRepresentative(company, representative), {})
  for (const person of [null, { ...representative, id: 'bad' }, { ...representative, role: 'admin' },
    { ...representative, role: 'academic_supervisor' }, { ...representative, role: 'student' }, { ...representative, isActive: false }]) {
    assert.ok(validateCompanyRepresentative(company, person).representativeId)
  }
  assert.ok(validateCompanyRepresentative({ ...company, representative: representative.id.toUpperCase() }, representative).representativeId)
})

test('assignment and replacement PATCH only representativeId and confirm the same company/link', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/v1/companies/${company._id}/representative`)
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer token')
    assert.deepEqual(JSON.parse(options.body), { representativeId: representative.id })
    return savedResponse({ ...company, representative: representative.id })
  })
  for (const current of [null, '507f1f77bcf86cd799439014']) {
    assert.equal((await assignCompanyRepresentative('token', { ...company, representative: current }, representative)).representative, representative.id)
  }
})

test('invalid, inactive, unchanged and non-representative assignments make no requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  for (const person of [null, { ...representative, isActive: false }, { ...representative, role: 'student' }]) {
    await assert.rejects(assignCompanyRepresentative('token', company, person))
  }
  await assert.rejects(assignCompanyRepresentative('token', { ...company, representative: representative.id }, representative))
  assert.equal(fetch.mock.callCount(), 0)
})

test('wrong company, wrong representative and malformed saved responses never confirm an assignment', async (t) => {
  let response
  t.mock.method(globalThis, 'fetch', async () => response)
  for (const saved of [null, company, { ...company, representative: adminId }, { ...company, _id: adminId, representative: representative.id }]) {
    response = savedResponse(saved)
    await assert.rejects(assignCompanyRepresentative('token', company, representative), /could not be confirmed/)
  }
})

test('validation, forbidden, missing and server errors retain backend status and messages', async (t) => {
  let status
  t.mock.method(globalThis, 'fetch', async () => json({ success: false, message: 'Backend rejected this request.' }, status))
  for (const code of [400, 403, 404, 409, 500]) {
    status = code
    for (const action of [() => fetchCompanies('token'), () => fetchCompanyRepresentatives('token'),
      () => createCompany('token', values, adminId), () => assignCompanyRepresentative('token', company, representative)]) {
      await assert.rejects(action(), (error) => error.status === code && error.message === 'Backend rejected this request.')
    }
  }
})

test('JSON and non-JSON 401 responses request sign-in for all company operations', async (t) => {
  let html = false
  t.mock.method(globalThis, 'fetch', async () => html ? new Response('Unauthorized', { status: 401 }) : json({ success: false }, 401))
  for (const value of [false, true]) {
    html = value
    for (const action of [() => fetchCompanies('token'), () => fetchCompanyRepresentatives('token'),
      () => createCompany('token', values, adminId), () => assignCompanyRepresentative('token', company, representative)]) {
      await assert.rejects(action(), (error) => error.status === 401)
    }
  }
})

test('malformed responses and network failures never claim success or automatically repeat a write', async (t) => {
  let mode
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    if (mode === 'network') throw new TypeError('Connection lost')
    if (mode === 'html') return new Response('Bad gateway', { status: 502 })
    if (mode === 'syntax') return new Response('{invalid', { headers: { 'Content-Type': 'application/json' } })
    return json({ success: 'true', data: { company } })
  })
  for (const value of ['network', 'html', 'syntax', 'false-success']) {
    mode = value
    const before = fetch.mock.callCount()
    await assert.rejects(createCompany('token', values, adminId))
    await assert.rejects(assignCompanyRepresentative('token', company, representative))
    assert.equal(fetch.mock.callCount(), before + 2)
  }
})

test('company reads, choices and writes support cancellation and the shared 15-second timeout', async (t) => {
  const durations = []
  t.mock.method(AbortSignal, 'timeout', (duration) => { durations.push(duration); return new AbortController().signal })
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) reject(options.signal.reason)
    else options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  for (const action of [(signal) => fetchCompanies('token', 1, signal), (signal) => fetchCompanyRepresentatives('token', signal),
    (signal) => createCompany('token', values, adminId, signal), (signal) => assignCompanyRepresentative('token', company, representative, signal)]) {
    const controller = new AbortController()
    const request = action(controller.signal)
    controller.abort()
    await assert.rejects(request, { name: 'AbortError' })
  }
  assert.deepEqual(durations, [15000, 15000, 15000, 15000])
})
