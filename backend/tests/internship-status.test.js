import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from '../routes/internship.routes.js';
import { User } from '../model/user.model.js';
import { Internship } from '../model/internship.model.js';

test('internship transitions enforce admin access, history and terminal states', async (t) => {
  const adminId = '507f1f77bcf86cd799439011';
  const id = '507f1f77bcf86cd799439012';
  const previousSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  process.env.JWT_SECRET = 'internship-status-test-secret-only';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: adminId });
  let role = 'admin';
  let stored = { status: 'assigned', statusHistory: [] };
  let race = false;
  let writes = 0;
  t.mock.method(User, 'findById', async () => ({ id: adminId, role, isActive: true }));
  t.mock.method(Internship, 'findById', async () => stored);
  t.mock.method(Internship, 'findOneAndUpdate', async (filter, update, options) => {
    writes++;
    assert.equal(filter._id, id);
    assert.equal(filter.status, stored.status);
    assert.deepEqual(options, { new: true, runValidators: true });
    assert.deepEqual(Object.keys(update.$set).sort(), ['status', 'isOngoing'].sort());
    assert.equal(update.$set.isOngoing, update.$set.status === 'active');
    const event = update.$push.statusHistory;
    assert.equal(event.from, stored.status);
    assert.equal(event.to, update.$set.status);
    assert.equal(event.changedBy, adminId);
    assert.ok(event.changedAt instanceof Date);
    if (race) return null;
    stored = { status: update.$set.status, statusHistory: [...stored.statusHistory, event] };
    return stored;
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/internships', routes);
  const patch = (body, targetId = id) => request(app).patch(`/api/v1/internships/${targetId}/status`).auth(token, { type: 'bearer' }).send(body);
  assert.equal((await request(app).patch(`/api/v1/internships/${id}/status`).send({ status: 'active' })).status, 401);
  for (role of ['student', 'academic_supervisor', 'company_representative']) {
    assert.equal((await patch({ status: 'active' })).status, 403);
  }
  role = 'admin';
  assert.equal((await patch({ status: 'active' }, 'bad')).status, 400);
  for (const body of [{}, { status: 'assigned' }, { status: {} }, { status: 'cancelled' },
    { status: 'cancelled', reason: ' ' }, { status: 'active', reason: {} },
    { status: 'cancelled', reason: 'a'.repeat(1001) }]) {
    assert.equal((await patch(body)).status, 400);
  }
  assert.equal((await patch({ status: 'completed' })).status, 409);
  assert.equal(writes, 0);
  assert.equal((await patch({ status: 'active', changedBy: 'attacker', statusHistory: [] })).status, 200);
  assert.equal(stored.statusHistory.length, 1);
  assert.equal((await patch({ status: 'active' })).status, 409);
  assert.equal((await patch({ status: 'completed' })).status, 200);
  assert.equal(stored.statusHistory.length, 2);
  assert.equal(stored.statusHistory[1].from, 'active');
  assert.equal((await patch({ status: 'active' })).status, 409);
  assert.equal((await patch({ status: 'cancelled', reason: 'Too late' })).status, 409);
  for (const status of ['assigned', 'active']) {
    stored = { status, statusHistory: [] };
    assert.equal((await patch({ status: 'cancelled', reason: ' Company withdrew ' })).status, 200);
    assert.equal(stored.statusHistory[0].reason, 'Company withdrew');
    assert.equal((await patch({ status: 'active' })).status, 409);
  }
  stored = { status: 'assigned', statusHistory: [] }; race = true;
  assert.equal((await patch({ status: 'active' })).status, 409);
  assert.equal(stored.statusHistory.length, 0);
  stored = null;
  assert.equal((await patch({ status: 'active' })).status, 404);
});
