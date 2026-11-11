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

test('student applications enforce authorization, eligibility, uniqueness and privacy', async (t) => {
  const studentId = '507f1f77bcf86cd799439011';
  const opportunityId = '507f1f77bcf86cd799439012';
  const previousSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  process.env.JWT_SECRET = 'application-test-secret-not-for-production';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: studentId });
  let role = 'student';
  let active = true;
  let opportunity = { _id: opportunityId, status: 'open', deadline: new Date(Date.now() + 86400000) };
  let duplicate = false;
  let databaseFailure = false;
  let writes = 0;
  t.mock.method(User, 'findById', async () => ({ id: studentId, role, isActive: active }));
  t.mock.method(Opportunity, 'findById', async () => opportunity);
  t.mock.method(Application, 'create', async (data) => {
    writes++;
    assert.deepEqual(data, { student: studentId, opportunity: opportunityId });
    if (duplicate) throw Object.assign(new Error('Duplicate'), { code: 11000 });
    if (databaseFailure) throw new Error('Database unavailable');
    const application = new Application(data);
    await application.validate();
    assert.equal(application.status, 'pending');
    return application;
  });
  t.mock.method(Application, 'find', (filter) => {
    assert.deepEqual(filter, { student: studentId });
    return {
      populate() { return this; }, sort() { return this; },
      skip(value) { assert.equal(value, 10); return this; },
      limit(value) { assert.equal(value, 10); return Promise.resolve([]); },
    };
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/applications', routes);
  app.use(errorHandler);
  const post = (body) => request(app).post('/api/v1/applications').auth(token, { type: 'bearer' }).send(body);
  const list = (query) => request(app).get(`/api/v1/applications/me${query}`).auth(token, { type: 'bearer' });

  assert.equal((await request(app).post('/api/v1/applications').send({ opportunityId })).status, 401);
  assert.equal((await request(app).get('/api/v1/applications/me')).status, 401);
  for (role of ['admin', 'company_representative', 'academic_supervisor']) {
    assert.equal((await post({ opportunityId })).status, 403);
    assert.equal((await list('')).status, 403);
  }
  role = 'student'; active = false;
  assert.equal((await post({ opportunityId })).status, 401);
  active = true;
  for (const body of [{}, { opportunityId: 'bad' }, { opportunityId: { $ne: null } }]) {
    assert.equal((await post(body)).status, 400);
  }
  const originalOpportunity = opportunity;
  opportunity = null;
  assert.equal((await post({ opportunityId })).status, 404);
  opportunity = originalOpportunity;
  for (const status of ['closed', 'archived']) {
    opportunity.status = status;
    assert.equal((await post({ opportunityId })).status, 400);
  }
  opportunity.status = 'open'; opportunity.deadline = new Date(0);
  assert.equal((await post({ opportunityId })).status, 400);
  assert.equal(writes, 0);
  opportunity.deadline = new Date(Date.now() + 86400000);
  const response = await post({ opportunityId, student: 'another-user', status: 'approved' });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.application.status, 'pending');
  duplicate = true;
  const repeated = await post({ opportunityId });
  assert.equal(repeated.status, 409);
  assert.match(repeated.body.message, /already applied/);
  duplicate = false; databaseFailure = true;
  assert.equal((await post({ opportunityId })).status, 500);
  assert.equal((await list('?limit=101')).status, 400);
  assert.equal((await list('?page=2&limit=10&student=another-user')).status, 200);
  assert.ok(Application.schema.indexes().some(([fields, options]) =>
    fields.student === 1 && fields.opportunity === 1 && options.unique));
});
