import assert from 'node:assert/strict'
import { test } from 'node:test'
import { updateManagedUser, deleteManagedUser, validateManagedUserDetails } from '../src/context/userApi.js'

const account = { id: '507f1f77bcf86cd799439011', name: 'Teacher', email: 'teacher@example.com', role: 'academic_supervisor', isActive: false }
const values = { name: ' New Teacher ', email: ' NEW@example.com ' }
const updated = { ...account, name: 'New Teacher', email: 'new@example.com' }
const json = (data, status = 200) => new Response(JSON.stringify({ success: status < 400, ...(status < 400 ? { data } : { message: 'Request rejected.' }) }),
  { status, headers: { 'Content-Type': 'application/json' } })

test('identity editing validates only name and email, without password or role changes', () => {
  assert.deepEqual(validateManagedUserDetails(values), {})
  assert.ok(validateManagedUserDetails({ ...values, name: 'x' }).name)
  assert.ok(validateManagedUserDetails({ ...values, email: 'bad' }).email)
})

test('update uses the exact target ID and sends only normalized name and email', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/users/' + account.id); assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer token')
    assert.deepEqual(JSON.parse(options.body), { name: 'New Teacher', email: 'new@example.com' })
    return json({ user: updated })
  })
  assert.deepEqual(await updateManagedUser('token', account, { ...values, role: 'admin', password: 'ignored' }), updated)
})

test('protected, invalid and active deletion targets cannot send a write', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request') })
  for (const target of [null, { ...account, id: 'bad' }, { ...account, role: 'admin' }]) {
    await assert.rejects(updateManagedUser('token', target, values))
    await assert.rejects(deleteManagedUser('token', target))
  }
  await assert.rejects(deleteManagedUser('token', { ...account, isActive: true }), /Deactivate/)
  await assert.rejects(updateManagedUser('token', account, { ...values, email: 'bad' }))
  assert.equal(fetch.mock.callCount(), 0)
})

test('update rejects mismatched account, role, identity or access status', async (t) => {
  let user
  t.mock.method(globalThis, 'fetch', async () => json({ user }))
  for (const target of [null, { ...updated, id: '507f1f77bcf86cd799439099' }, { ...updated, role: 'admin' },
    { ...updated, name: 'Other User' }, { ...updated, email: 'other@example.com' }, { ...updated, isActive: true }]) {
    user = target; await assert.rejects(updateManagedUser('token', account, values), /could not be confirmed/)
  }
})

test('deletion is explicit, bodyless and confirms the same account ID', async (t) => {
  let userId = account.id
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/users/' + account.id); assert.equal(options.method, 'DELETE'); assert.equal(options.body, undefined)
    return json({ userId })
  })
  assert.equal(await deleteManagedUser('token', account), account.id)
  userId = '507f1f77bcf86cd799439099'
  await assert.rejects(deleteManagedUser('token', account), /could not be confirmed/)
})

test('edit and delete preserve backend errors, expiry and uncertain network failures without retries', async (t) => {
  let status = 409
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    if (status === 0) throw new TypeError('Disconnected')
    return json(null, status)
  })
  for (const code of [400, 401, 403, 404, 409, 500, 0]) {
    status = code
    const before = fetch.mock.callCount()
    for (const action of [() => updateManagedUser('token', account, values), () => deleteManagedUser('token', account)]) {
      await assert.rejects(action(), code ? (error) => error.status === code : /Disconnected/)
    }
    assert.equal(fetch.mock.callCount(), before + 2)
  }
})
