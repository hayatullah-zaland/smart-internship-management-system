import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import routes from '../routes/auth.routes.js';
import { User } from '../model/user.model.js';

async function fixture(t) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'password-settings-isolated-test-secret';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  let saves = 0;
  const user = { id: '000000000000000000000001', role: 'student', name: 'Settings User', isActive: true,
    passwordHash: await bcrypt.hash('CurrentPassword123', 4), async save() { saves++; } };
  t.mock.method(User, 'findById', (id) => {
    assert.equal(id, user.id);
    return { then(resolve, reject) { return Promise.resolve(user).then(resolve, reject); },
      select(fields) { assert.equal(fields, '+passwordHash'); return Promise.resolve(user); } };
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/auth', routes);
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: user.id });
  return { app, user, saves: () => saves,
    change: (values) => request(app).patch('/api/v1/auth/change-password').auth(token, { type: 'bearer' }).send(values) };
}

test('all four roles can change only their own password and the response never contains secrets', async (t) => {
  const f = await fixture(t);
  let currentPassword = 'CurrentPassword123';
  for (const [index, role] of ['student', 'admin', 'academic_supervisor', 'company_representative'].entries()) {
    f.user.role = role;
    const newPassword = ` UpdatedPassword${index} `;
    const response = await f.change({ currentPassword, newPassword, userId: '000000000000000000000002', role: 'admin' });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { success: true, message: 'Password changed successfully.' });
    assert.equal(f.user.role, role); assert.equal(f.user.name, 'Settings User');
    assert.equal(await bcrypt.compare(newPassword, f.user.passwordHash), true);
    assert.equal(await bcrypt.compare(currentPassword, f.user.passwordHash), false);
    assert.notEqual(f.user.passwordHash, newPassword);
    currentPassword = newPassword;
  }
  assert.equal(f.saves(), 4);
});

test('missing sessions, inactive accounts, wrong passwords and invalid changes cannot write a password', async (t) => {
  const f = await fixture(t);
  const original = f.user.passwordHash;
  assert.equal((await request(f.app).patch('/api/v1/auth/change-password').send({})).status, 401);
  f.user.isActive = false;
  assert.equal((await f.change({ currentPassword: 'CurrentPassword123', newPassword: 'UpdatedPassword123' })).status, 401);
  f.user.isActive = true;
  for (const values of [{}, { currentPassword: '', newPassword: 'UpdatedPassword123' },
    { currentPassword: 'CurrentPassword123', newPassword: 'short' }, { currentPassword: 'CurrentPassword123', newPassword: '\u00e9'.repeat(37) },
    { currentPassword: 'CurrentPassword123', newPassword: 'CurrentPassword123' }, { currentPassword: 'WrongPassword123', newPassword: 'UpdatedPassword123' }]) {
    assert.equal((await f.change(values)).status, 400);
  }
  assert.equal(f.saves(), 0); assert.equal(f.user.passwordHash, original);
});
