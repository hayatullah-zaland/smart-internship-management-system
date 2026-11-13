import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from '../routes/daily-report.routes.js';
import { DailyReport } from '../model/daily-report.model.js';
import { Internship } from '../model/internship.model.js';
import { User } from '../model/user.model.js';
import { errorHandler } from '../middleware/error.middleware.js';

test('daily reports protect ownership, validate content and lock submitted drafts', async (t) => {
  const userId = '507f1f77bcf86cd799439011';
  const internshipId = '507f1f77bcf86cd799439012';
  const reportId = '507f1f77bcf86cd799439013';
  const previousSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  process.env.JWT_SECRET = 'daily-report-test-secret-not-production';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: userId });
  const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  let role = 'student';
  let active = true;
  let ownsInternship = true;
  let ownsReport = true;
  let duplicate = false;
  let race = false;
  let report;
  let creates = 0;
  let updates = 0;
  let expectedFilter;
  const body = { internshipId, date: day(0), hours: 6, tasks: ' Built login form ', learning: ' Learned validation ', challenges: ' None ' };
  t.mock.method(User, 'findById', async () => ({ id: userId, role, isActive: true }));
  t.mock.method(Internship, 'findOne', async (filter) => {
    assert.deepEqual(filter, { _id: internshipId, student: userId });
    return ownsInternship ? { _id: internshipId, status: active ? 'active' : 'assigned', startDate: new Date(day(-10)), endDate: new Date(day(10)) } : null;
  });
  t.mock.method(Internship, 'exists', async (filter) => {
    assert.equal(String(filter._id), internshipId);
    assert.equal(filter.student, userId); assert.equal(filter.status, 'active');
    return active;
  });
  t.mock.method(Internship, 'find', (filter) => {
    assert.deepEqual(filter, { supervisor: userId });
    return { distinct: async (field) => { assert.equal(field, '_id'); return [internshipId]; } };
  });
  t.mock.method(DailyReport, 'create', async (data) => {
    creates++;
    if (duplicate) throw Object.assign(new Error('Duplicate'), { code: 11000 });
    assert.equal(data.student, userId);
    assert.equal(String(data.internship), internshipId);
    assert.equal(data.status, undefined);
    assert.equal(data.tasks, 'Built login form');
    report = new DailyReport({ ...data, _id: reportId });
    report.__v = 0;
    await report.validate();
    return report;
  });
  t.mock.method(DailyReport, 'findOne', async (filter) => {
    assert.deepEqual(filter, { _id: reportId, student: userId });
    return ownsReport ? report : null;
  });
  t.mock.method(DailyReport, 'findOneAndUpdate', async (filter, update, options) => {
    updates++;
    assert.equal(filter._id, reportId); assert.equal(filter.student, userId); assert.equal(filter.status, 'draft');
    assert.deepEqual(options, { new: true, runValidators: true });
    assert.equal(update.$inc.__v, 1);
    if (race || report.status !== 'draft') return null;
    if (update.$set.status) {
      assert.equal(update.$set.status, 'submitted');
      assert.ok(update.$set.submittedAt instanceof Date);
    } else {
      assert.equal(filter.__v, report.__v);
      assert.deepEqual(Object.keys(update.$set).sort(), ['hours', 'tasks', 'learning', 'challenges'].sort());
    }
    Object.assign(report, update.$set); report.__v++;
    await report.validate();
    return report;
  });
  t.mock.method(DailyReport, 'find', (filter) => {
    assert.deepEqual(filter, expectedFilter);
    return { populate() { return this; }, sort() { return this; },
      skip(n) { assert.equal(n, 10); return this; }, limit(n) { assert.equal(n, 10); return Promise.resolve([]); } };
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/daily-reports', routes); app.use(errorHandler);
  const post = (data = body) => request(app).post('/api/v1/daily-reports').auth(token, { type: 'bearer' }).send(data);
  const edit = (data) => request(app).patch(`/api/v1/daily-reports/${reportId}`).auth(token, { type: 'bearer' }).send(data);
  const submit = () => request(app).post(`/api/v1/daily-reports/${reportId}/submit`).auth(token, { type: 'bearer' }).send({ student: 'attacker', status: 'draft' });
  const list = () => request(app).get('/api/v1/daily-reports?page=2&limit=10&student=attacker').auth(token, { type: 'bearer' });
  assert.equal((await request(app).post('/api/v1/daily-reports').send(body)).status, 401);
  assert.equal((await request(app).get('/api/v1/daily-reports')).status, 401);
  for (role of ['admin', 'academic_supervisor', 'company_representative']) {
    assert.equal((await post()).status, 403);
    assert.equal((await edit({ hours: 5 })).status, 403);
    assert.equal((await submit()).status, 403);
  }
  role = 'student';
  for (const bad of [{}, { ...body, internshipId: {} }, { ...body, date: '2026-02-30' },
    { ...body, date: day(1) }, { ...body, hours: '6' }, { ...body, hours: 25 },
    { ...body, hours: 0 }, { ...body, tasks: ' ' }, { ...body, learning: {} },
    { ...body, challenges: 'a'.repeat(2001) }]) assert.equal((await post(bad)).status, 400);
  ownsInternship = false; assert.equal((await post()).status, 404); ownsInternship = true;
  active = false; assert.equal((await post()).status, 409); active = true;
  assert.equal((await post({ ...body, date: day(-11) })).status, 400);
  assert.equal(creates, 0);
  const created = await post({ ...body, student: 'attacker', status: 'submitted' });
  assert.equal(created.status, 201); assert.equal(created.body.data.report.status, 'draft');
  duplicate = true; assert.equal((await post()).status, 409); duplicate = false;
  ownsReport = false;
  assert.equal((await edit({ hours: 5 })).status, 404); assert.equal((await submit()).status, 404);
  ownsReport = true;
  assert.equal((await edit({ status: 'submitted' })).status, 400);
  assert.equal((await edit({ hours: 100 })).status, 400);
  active = false;
  assert.equal((await edit({ hours: 5 })).status, 409); assert.equal((await submit()).status, 409);
  active = true; race = true;
  assert.equal((await edit({ hours: 5 })).status, 409); assert.equal((await submit()).status, 409);
  race = false;
  assert.equal((await edit({ hours: 5, student: 'attacker', date: day(-2) })).status, 200);
  assert.equal(report.hours, 5); assert.equal(report.date.toISOString().slice(0, 10), day(0));
  assert.equal((await submit()).status, 200); assert.equal(report.status, 'submitted');
  const writesBefore = updates;
  assert.equal((await edit({ hours: 7 })).status, 409); assert.equal((await submit()).status, 409);
  assert.equal(updates, writesBefore);
  expectedFilter = { student: userId }; assert.equal((await list()).status, 200);
  role = 'admin'; expectedFilter = {}; assert.equal((await list()).status, 200);
  role = 'academic_supervisor'; expectedFilter = { internship: { $in: [internshipId] }, status: { $in: ['submitted', 'approved', 'changes_requested'] } };
  assert.equal((await list()).status, 200);
  role = 'company_representative'; assert.equal((await list()).status, 403);
  assert.ok(DailyReport.schema.indexes().some(([fields, options]) => fields.internship && fields.date && options.unique));
});
