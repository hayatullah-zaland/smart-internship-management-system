import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from '../routes/weekly-report.routes.js';
import { WeeklyReport } from '../model/weekly-report.model.js';
import { Internship } from '../model/internship.model.js';
import { User } from '../model/user.model.js';
import { errorHandler } from '../middleware/error.middleware.js';

test('weekly drafts enforce ownership, internship weeks, validation and uniqueness', async (t) => {
  const studentId = '507f1f77bcf86cd799439011';
  const internshipId = '507f1f77bcf86cd799439012';
  const previousSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  process.env.JWT_SECRET = 'weekly-report-test-secret-not-production';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: studentId });
  const today = new Date(new Date().toISOString().slice(0, 10));
  const day = 86400000;
  let role = 'student';
  let owns = true;
  let active = true;
  let duplicate = false;
  let writes = 0;
  let saved;
  let expectedFilter;
  const startDate = new Date(today.getTime() - 10 * day);
  const endDate = new Date(today.getTime() + 5 * day);
  const body = { internshipId, weekNumber: 1, summary: ' Built a form ', learning: ' Learned React ', challenges: ' None ' };
  t.mock.method(User, 'findById', async () => ({ id: studentId, role, isActive: true }));
  t.mock.method(Internship, 'findOne', async (filter) => {
    assert.deepEqual(filter, { _id: internshipId, student: studentId });
    return owns ? { _id: internshipId, status: active ? 'active' : 'assigned', startDate, endDate } : null;
  });
  t.mock.method(WeeklyReport, 'create', async (data) => {
    writes++;
    if (duplicate) throw Object.assign(new Error('Duplicate'), { code: 11000 });
    assert.equal(data.student, studentId);
    assert.equal(data.internship, internshipId);
    assert.equal(data.status, undefined);
    assert.equal(data.summary, 'Built a form');
    assert.equal(data.learning, 'Learned React');
    saved = new WeeklyReport(data);
    await saved.validate();
    return saved;
  });
  t.mock.method(WeeklyReport, 'find', (filter) => {
    assert.deepEqual(filter, expectedFilter);
    return { populate() { return this; }, sort() { return this; },
      skip(n) { assert.equal(n, 10); return this; }, limit(n) { assert.equal(n, 10); return Promise.resolve([]); } };
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/weekly-reports', routes); app.use(errorHandler);
  const post = (data = body) => request(app).post('/api/v1/weekly-reports').auth(token, { type: 'bearer' }).send(data);
  const list = () => request(app).get('/api/v1/weekly-reports?page=2&limit=10&student=attacker').auth(token, { type: 'bearer' });
  assert.equal((await request(app).post('/api/v1/weekly-reports').send(body)).status, 401);
  assert.equal((await request(app).get('/api/v1/weekly-reports')).status, 401);
  for (role of ['admin', 'academic_supervisor', 'company_representative']) assert.equal((await post()).status, 403);
  role = 'student';
  for (const bad of [{}, { ...body, internshipId: {} }, { ...body, weekNumber: '1' },
    { ...body, weekNumber: 0 }, { ...body, weekNumber: 1.5 }, { ...body, weekNumber: 10001 },
    { ...body, summary: ' ' }, { ...body, learning: {} }, { ...body, challenges: 'a'.repeat(2001) }]) {
    assert.equal((await post(bad)).status, 400);
  }
  owns = false; assert.equal((await post()).status, 404); owns = true;
  active = false; assert.equal((await post()).status, 409); active = true;
  assert.equal((await post({ ...body, weekNumber: 3 })).status, 400); // Future week.
  assert.equal((await post({ ...body, weekNumber: 4 })).status, 400); // Beyond placement.
  assert.equal(writes, 0);
  const response = await post({ ...body, student: 'attacker', status: 'approved', weekStart: '2000-01-01' });
  assert.equal(response.status, 201);
  assert.equal(saved.status, 'draft');
  assert.equal(saved.weekStart.getTime(), startDate.getTime());
  assert.equal(saved.weekEnd.getTime(), startDate.getTime() + 6 * day);
  assert.equal((await post({ ...body, weekNumber: 2 })).status, 201);
  assert.equal(saved.weekStart.getTime(), startDate.getTime() + 7 * day);
  // The final week ends at the placement boundary, even when shorter than 7 days.
  endDate.setTime(today.getTime() - 1 * day);
  assert.equal((await post({ ...body, weekNumber: 2 })).status, 201);
  assert.equal(saved.weekEnd.getTime(), endDate.getTime());
  duplicate = true; assert.equal((await post()).status, 409);
  expectedFilter = { student: studentId }; assert.equal((await list()).status, 200);
  assert.equal((await request(app).get('/api/v1/weekly-reports?limit=101').auth(token, { type: 'bearer' })).status, 400);
  role = 'admin'; expectedFilter = {}; assert.equal((await list()).status, 200);
  for (role of ['academic_supervisor', 'company_representative']) assert.equal((await list()).status, 403);
  assert.ok(WeeklyReport.schema.indexes().some(([fields, options]) => fields.internship && fields.weekNumber && options.unique));
});
