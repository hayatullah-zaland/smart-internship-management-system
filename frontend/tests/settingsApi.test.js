import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changePassword, validatePasswordChange } from '../src/context/settingsApi.js'

const values = { currentPassword: ' CurrentPassword123 ', newPassword: ' NewPassword123 ', confirmPassword: ' NewPassword123 ' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('password validation matches backend lengths, UTF-8 limits, confirmation and different-password rules without trimming', () => {
  assert.deepEqual(validatePasswordChange(values), {})
  assert.deepEqual(validatePasswordChange({ currentPassword: 'old', newPassword: ' '.repeat(8), confirmPassword: ' '.repeat(8) }), {})
  for (const value of [undefined, null, {}, { currentPassword: null }, { newPassword: 123 }]) assert.ok(Object.keys(validatePasswordChange(value)).length)
  for (const currentPassword of ['', null, 123, 'a'.repeat(73), '\u00e9'.repeat(37)]) assert.ok(validatePasswordChange({ ...values, currentPassword }).currentPassword)
  for (const newPassword of ['', null, 123, 'short', 'a'.repeat(73), '\u00e9'.repeat(37), values.currentPassword]) {
    assert.ok(validatePasswordChange({ ...values, newPassword }).newPassword)
  }
  for (const confirmPassword of ['', null, 123, 'mismatch']) assert.ok(validatePasswordChange({ ...values, confirmPassword }).confirmPassword)
  const maximum = '\u00e9'.repeat(36)
  assert.deepEqual(validatePasswordChange({ ...values, newPassword: maximum, confirmPassword: maximum }), {})
})

test('changing a password sends only unchanged current/new secrets with bearer auth, timeout and no cache', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/auth/change-password'); assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer private-token'); assert.equal(options.cache, 'no-store')
    assert.deepEqual(JSON.parse(options.body), { currentPassword: values.currentPassword, newPassword: values.newPassword })
    assert.ok(options.signal instanceof AbortSignal)
    return json({ success: true, message: 'Password changed successfully.' })
  })
  assert.equal(await changePassword('private-token', { ...values, userId: 'different-user', role: 'admin' }), undefined)
  assert.equal(fetch.mock.callCount(), 1)
})

test('invalid fields and missing tokens never send a password request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request') })
  await assert.rejects(changePassword('token', { ...values, confirmPassword: 'wrong' }))
  await assert.rejects(changePassword('', values), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('wrong current passwords, permission failures and rate limits preserve server validation', async (t) => {
  let status = 400
  t.mock.method(globalThis, 'fetch', async () => json({ success: false, message: 'Current password is incorrect.' }, status))
  for (const code of [400, 401, 403, 429]) {
    status = code
    await assert.rejects(changePassword('token', values), (error) => error.status === code && !error.uncertain)
  }
})

test('malformed success, server failures and network loss cannot confirm or automatically repeat a password change', async (t) => {
  let result
  const fetch = t.mock.method(globalThis, 'fetch', async () => { if (result instanceof Error) throw result; return result })
  for (const response of [json({ success: false }), json({ success: 'true', message: 'Password changed successfully.' }),
    json({ success: true }), json({ success: true, message: 'Wrong contract' }), json({ success: false }, 500),
    new Response('<html>Unavailable</html>', { status: 502 }), new Response('{bad', { headers: { 'Content-Type': 'application/json' } }), new TypeError('Connection lost')]) {
    result = response
    const before = fetch.mock.callCount()
    await assert.rejects(changePassword('token', values), (error) => error.uncertain === true && /could not be confirmed/.test(error.message))
    assert.equal(fetch.mock.callCount(), before + 1)
  }
})

test('a caller can abort a pending password request without an automatic retry', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })))
  const controller = new AbortController()
  const pending = changePassword('token', values, controller.signal)
  controller.abort()
  await assert.rejects(pending, (error) => error.uncertain === true)
  assert.equal(fetch.mock.callCount(), 1)
})
