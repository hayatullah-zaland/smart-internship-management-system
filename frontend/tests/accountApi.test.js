import assert from 'node:assert/strict'
import { test } from 'node:test'
import { saveAccount, validateAccount } from '../src/context/accountApi.js'
import { isProfileImage, prepareProfileImage, MAX_PROFILE_IMAGE_BYTES } from '../src/context/profileImage.js'
import { isValidSessionUser } from '../src/context/authSession.js'

const photo = 'data:image/jpeg;base64,/9j/4AAC/9k='
const user = { id: '507f1f77bcf86cd799439011', name: 'Test Account', email: 'account@example.com', role: 'student', isActive: true, profileImage: photo }
const values = { name: ' Updated Name ', email: ' UPDATED@example.com ', profileImage: photo }
const updated = { ...user, name: 'Updated Name', email: 'updated@example.com' }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

test('account validation covers name, email and bounded photo data', () => {
  assert.deepEqual(validateAccount(values), {})
  assert.deepEqual(validateAccount({ ...values, profileImage: '' }), {})
  for (const name of ['', 'x', 'x'.repeat(101), null, {}]) assert.ok(validateAccount({ ...values, name }).name)
  for (const email of ['', 'wrong', 'a b@example.com', null, {}]) assert.ok(validateAccount({ ...values, email }).email)
  for (const image of [null, {}, 'https://example.com/a.jpg', 'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/jpeg;base64,', photo + '\n', 'data:image/jpeg;base64,' + 'A'.repeat(MAX_PROFILE_IMAGE_BYTES * 2)]) {
    assert.equal(isProfileImage(image), false)
    assert.ok(validateAccount({ ...values, profileImage: image }).profileImage)
    assert.equal(isValidSessionUser({ ...user, profileImage: image }), false)
  }
  assert.equal(isValidSessionUser({ ...user, profileImage: undefined }), true)
  assert.equal(isValidSessionUser(user), true)
})

test('photo selection rejects empty, unsupported and oversized files before decoding', async () => {
  for (const file of [null, { type: 'image/svg+xml', size: 100 }, { type: 'text/plain', size: 100 },
    { type: 'image/jpeg', size: 0 }, { type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }]) {
    await assert.rejects(prepareProfileImage(file), /Choose/)
  }
})

test('save normalizes details and sends only allowed fields to the authenticated endpoint', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/auth/me')
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.deepEqual(JSON.parse(options.body), { name: 'Updated Name', email: 'updated@example.com', profileImage: photo })
    return json({ success: true, data: { user: updated } })
  })
  assert.deepEqual(await saveAccount('test-token', user, { ...values, role: 'admin', id: 'other' }), updated)
})

test('invalid edits never reach the network', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request') })
  await assert.rejects(saveAccount('test-token', user, { ...values, name: '' }), /name/)
  assert.equal(mock.mock.callCount(), 0)
})

test('save confirms identity, role, active state, normalized details and the saved photo', async (t) => {
  let returned
  t.mock.method(globalThis, 'fetch', async () => json({ success: true, data: { user: returned } }))
  for (const invalid of [null, { ...updated, id: 'other' }, { ...updated, role: 'admin' }, { ...updated, isActive: false },
    { ...updated, name: 'Other Name' }, { ...updated, email: 'other@example.com' }, { ...updated, profileImage: '' },
    { ...updated, profileImage: undefined }]) {
    returned = invalid
    await assert.rejects(saveAccount('test-token', user, values), /confirm/)
  }
})

test('duplicate email and expired sessions retain their status for the form', async (t) => {
  let status = 409
  t.mock.method(globalThis, 'fetch', async () => json({ success: false, message: 'Email already exists.' }, status))
  await assert.rejects(saveAccount('test-token', user, values), (error) => error.status === 409 && /already exists/.test(error.message))
  status = 401
  await assert.rejects(saveAccount('test-token', user, values), (error) => error.status === 401)
})
