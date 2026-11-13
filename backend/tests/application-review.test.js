import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from '../routes/application.routes.js';
import { User } from '../model/user.model.js';
import { Application } from '../model/application.model.js';

test('admin review protects access, validates decisions and preserves final outcomes', async (t) => {
  const adminId = '507f1f77bcf86cd799439011';
  const applicationId = '507f1f77bcf86cd799439012';
  const previousSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  process.env.JWT_SECRET = 'admin-review-test-secret-not-for-production';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: adminId });
  let role = 'student';
  let stored = { _id: applicationId, status: 'pending' };
  t.mock.method(User, 'findById', async () => ({ id: adminId, role, isActive: true }));
  t.mock.method(Application, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter._id, applicationId);
    assert.equal(options.new, true);
    assert.equal(options.runValidators, true);
    assert.deepEqual(Object.keys(update.$set).sort(), ['status', 'reviewedBy', 'reviewedAt', 'rejectionReason'].sort());
    assert.equal(update.$set.reviewedBy, adminId);
    assert.ok(update.$set.reviewedAt instanceof Date);
    if (!stored || !filter.status.$in.includes(stored.status)) return null;
    stored = { ...stored, ...update.$set };
    return stored;
  });
  t.mock.method(Application, 'exists', async () => stored ? { _id: applicationId } : null);
  t.mock.method(Application, 'find', (filter) => {
    assert.deepEqual(filter, { status: 'pending' });
    return {
      populate() { return this; }, sort() { return this; },
      skip(n) { assert.equal(n, 10); return this; },
      limit(n) { assert.equal(n, 10); return Promise.resolve([]); },
    };
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/applications', routes);
  const patch = (body, id = applicationId) => request(app).patch(`/api/v1/applications/${id}/decision`).auth(token, { type: 'bearer' }).send(body);
  const list = (query = '') => request(app).get(`/api/v1/applications${query}`).auth(token, { type: 'bearer' });

  assert.equal((await request(app).get('/api/v1/applications')).status, 401);
  assert.equal((await request(app).patch(`/api/v1/applications/${applicationId}/decision`).send({ status: 'approved' })).status, 401);
  for (role of ['student', 'company_representative', 'academic_supervisor']) {
    assert.equal((await list()).status, 403);
    assert.equal((await patch({ status: 'approved' })).status, 403);
  }
  role = 'admin';
  assert.equal((await list('?status=invalid')).status, 400);
  assert.equal((await list('?limit=101')).status, 400);
  assert.equal((await list('?status=pending&page=2&limit=10')).status, 200);
  assert.equal((await patch({ status: 'approved' }, 'bad-id')).status, 400);
  for (const body of [{}, { status: 'withdrawn' }, { status: { $ne: null } },
    { status: 'rejected' }, { status: 'rejected', rejectionReason: ' ' },
    { status: 'rejected', rejectionReason: 'a'.repeat(1001) }]) {
    assert.equal((await patch(body)).status, 400);
  }
  assert.equal(stored.status, 'pending');
  assert.equal((await patch({ status: 'under_review' })).status, 200);
  assert.equal((await patch({ status: 'under_review' })).status, 409);
  assert.equal((await patch({ status: 'approved', reviewedBy: 'attacker', student: 'attacker' })).status, 200);
  assert.equal(stored.status, 'approved');
  assert.equal(stored.reviewedBy, adminId);
  assert.equal((await patch({ status: 'rejected', rejectionReason: 'Changed decision' })).status, 409);
  stored = { _id: applicationId, status: 'pending' };
  assert.equal((await patch({ status: 'rejected', rejectionReason: ' Missing requirements ' })).status, 200);
  assert.equal(stored.rejectionReason, 'Missing requirements');
  assert.equal((await patch({ status: 'approved' })).status, 409);
  stored = { _id: applicationId, status: 'withdrawn' };
  assert.equal((await patch({ status: 'approved' })).status, 409);
  stored = null;
  assert.equal((await patch({ status: 'approved' })).status, 404);
});
