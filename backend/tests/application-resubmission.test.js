import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from '../routes/application.routes.js';
import { Application } from '../model/application.model.js';
import { Opportunity } from '../model/opportunity.model.js';
import { User } from '../model/user.model.js';
import { errorHandler } from '../middleware/error.middleware.js';

const studentId = '507f1f77bcf86cd799439011';
const opportunityId = '507f1f77bcf86cd799439012';
const applicationId = '507f1f77bcf86cd799439013';
const adminId = '507f1f77bcf86cd799439014';

function setup(t) {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'application-resubmission-test-only';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const state = {
    role: 'student', active: true, writes: 0, failCreate: false,
    opportunity: { _id: opportunityId, status: 'open', deadline: new Date(Date.now() + 86400000) },
    record: { _id: applicationId, student: studentId, opportunity: opportunityId, status: 'rejected',
      reviewedBy: adminId, reviewedAt: new Date('2026-01-02'), rejectionReason: 'Missing requirements',
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'), __v: 0 },
  };
  t.mock.method(User, 'findById', async () => ({ id: state.role === 'admin' ? adminId : studentId, role: state.role, isActive: state.active }));
  t.mock.method(Opportunity, 'findById', async () => state.opportunity);
  t.mock.method(Application, 'create', async () => {
    if (state.failCreate) throw new Error('Database unavailable');
    throw Object.assign(new Error('Duplicate application'), { code: 11000 });
  });
  t.mock.method(Application, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(options, { returnDocument: 'after', runValidators: true });
    if (update.$set.status === 'pending') {
      assert.deepEqual(filter, { student: studentId, opportunity: opportunityId, status: 'rejected' });
      assert.deepEqual(update, { $set: { status: 'pending', reviewedBy: null, reviewedAt: null, rejectionReason: '' }, $inc: { __v: 1 } });
      if (state.record.status !== 'rejected' || state.record.student !== filter.student
        || state.record.opportunity !== filter.opportunity) return null;
      state.record.__v += 1;
    } else {
      assert.equal(filter._id, applicationId);
      if (!filter.status.$in.includes(state.record.status)) return null;
    }
    Object.assign(state.record, update.$set, { updatedAt: new Date() });
    state.writes += 1;
    return { ...state.record };
  });
  t.mock.method(Application, 'exists', async () => ({ _id: applicationId }));
  t.mock.method(Application, 'find', (filter) => {
    assert.deepEqual(filter, state.role === 'admin' ? { status: 'pending' } : { student: studentId });
    return {
      populate() { return this; },
      sort(order) { assert.deepEqual(order, { updatedAt: -1, _id: -1 }); return this; },
      skip(offset) { assert.equal(offset, 0); return this; },
      async limit(limit) { assert.equal(limit, 10); return state.role === 'admin' && state.record.status !== 'pending' ? [] : [{ ...state.record }]; },
    };
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/applications', routes); app.use(errorHandler);
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: studentId });
  state.apply = (body = { opportunityId }) => request(app).post('/api/v1/applications').auth(token, { type: 'bearer' }).send(body);
  state.review = (body) => request(app).patch(`/api/v1/applications/${applicationId}/decision`).auth(token, { type: 'bearer' }).send(body);
  state.list = (path) => request(app).get(`/api/v1/applications${path}`).auth(token, { type: 'bearer' });
  return state;
}

test('a rejected application can be submitted again and approved by the admin without creating a duplicate', async (t) => {
  const state = setup(t);
  const createdAt = state.record.createdAt;
  const resubmitted = await state.apply({ opportunityId, student: adminId, status: 'approved', reviewedBy: adminId });
  assert.equal(resubmitted.status, 200);
  assert.equal(resubmitted.body.data.application._id, applicationId);
  assert.equal(state.record.student, studentId);
  assert.equal(state.record.status, 'pending');
  assert.equal(state.record.reviewedBy, null);
  assert.equal(state.record.reviewedAt, null);
  assert.equal(state.record.rejectionReason, '');
  assert.equal(state.record.createdAt, createdAt);
  assert.equal(state.record.__v, 1);
  assert.equal((await state.list('/me?page=1&limit=10')).body.data.applications[0].status, 'pending');
  state.role = 'admin';
  const queue = await state.list('?status=pending&page=1&limit=10');
  assert.equal(queue.status, 200);
  assert.equal(queue.body.data.applications[0]._id, applicationId);
  assert.equal((await state.review({ status: 'approved' })).status, 200);
  assert.equal(state.record.status, 'approved');
  assert.equal(state.record.reviewedBy, adminId);
  state.role = 'student';
  assert.equal((await state.apply()).status, 409);
  assert.equal(state.record.status, 'approved');
});

test('repeated rejection/resubmission rounds reopen review only after the student explicitly reapplies', async (t) => {
  const state = setup(t);
  for (let round = 0; round < 2; round += 1) {
    state.role = 'admin';
    assert.equal((await state.review({ status: 'approved' })).status, 409);
    state.role = 'student';
    assert.equal((await state.apply()).status, 200);
    state.role = 'admin';
    assert.equal((await state.review({ status: 'under_review' })).status, 200);
    assert.equal((await state.review({ status: 'rejected', rejectionReason: `Please correct round ${round + 1}` })).status, 200);
  }
  state.role = 'student';
  assert.equal((await state.apply()).status, 200);
  state.role = 'admin';
  assert.equal((await state.review({ status: 'approved' })).status, 200);
});

test('resubmission keeps active/final duplicates, ownership, eligibility and authentication protections', async (t) => {
  const state = setup(t);
  for (const status of ['pending', 'under_review', 'approved', 'withdrawn']) {
    state.record.status = status;
    const before = { ...state.record };
    assert.equal((await state.apply()).status, 409);
    assert.deepEqual(state.record, before);
  }
  state.record.status = 'rejected';
  state.record.student = adminId;
  assert.equal((await state.apply()).status, 409);
  state.record.student = studentId;
  state.record.opportunity = applicationId;
  assert.equal((await state.apply()).status, 409);
  state.record.opportunity = opportunityId;
  for (const status of ['closed', 'archived']) {
    state.opportunity.status = status;
    assert.equal((await state.apply()).status, 400);
  }
  state.opportunity.status = 'open'; state.opportunity.deadline = new Date(0);
  assert.equal((await state.apply()).status, 400);
  state.opportunity.deadline = new Date(Date.now() + 86400000);
  for (const role of ['admin', 'academic_supervisor', 'company_representative']) {
    state.role = role;
    assert.equal((await state.apply()).status, 403);
  }
  state.role = 'student'; state.active = false;
  assert.equal((await state.apply()).status, 401);
  state.active = true; state.failCreate = true;
  assert.equal((await state.apply()).status, 500);
  assert.equal(state.writes, 0);
});

test('simultaneous resubmissions reopen a rejected application only once', async (t) => {
  const state = setup(t);
  const responses = await Promise.all([state.apply(), state.apply()]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(state.writes, 1);
  assert.equal(state.record.status, 'pending');
  assert.equal(state.record.__v, 1);
});
