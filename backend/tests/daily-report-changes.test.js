import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from '../routes/daily-report.routes.js';
import { DailyReport } from '../model/daily-report.model.js';
import { Internship } from '../model/internship.model.js';
import { User } from '../model/user.model.js';

test('assigned supervisors return reports and students correct and resubmit them', async (t) => {
  const userId = '507f1f77bcf86cd799439011';
  const reportId = '507f1f77bcf86cd799439012';
  const internshipId = '507f1f77bcf86cd799439013';
  const previousSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  process.env.JWT_SECRET = 'daily-report-changes-test-secret-only';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: userId });
  let role = 'academic_supervisor';
  let assigned = true;
  let active = true;
  let race = false;
  let report = { internship: internshipId, status: 'submitted', hours: 6, tasks: 'Work', learning: 'Skills', challenges: '', __v: 0 };
  t.mock.method(User, 'findById', async () => ({ id: userId, role, isActive: true }));
  t.mock.method(DailyReport, 'findById', async () => report);
  t.mock.method(DailyReport, 'findOne', async (filter) => {
    assert.deepEqual(filter, { _id: reportId, student: userId }); return report;
  });
  t.mock.method(Internship, 'exists', async (filter) => {
    assert.equal(filter._id, internshipId);
    if (role === 'academic_supervisor') {
      assert.equal(filter.supervisor, userId); return assigned;
    }
    assert.equal(filter.student, userId); assert.equal(filter.status, 'active'); return active;
  });
  t.mock.method(DailyReport, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter._id, reportId);
    assert.equal(filter.status, report.status);
    assert.deepEqual(options, { new: true, runValidators: true });
    if (role === 'student') assert.equal(filter.student, userId);
    else {
      assert.equal(update.$set.reviewedBy, userId);
      assert.ok(update.$set.reviewedAt instanceof Date);
    }
    if (race) return null;
    Object.assign(report, update.$set); report.__v++;
    return report;
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/daily-reports', routes);
  const changes = (body = { feedback: ' Explain the tasks clearly. ' }, id = reportId) =>
    request(app).patch(`/api/v1/daily-reports/${id}/request-changes`).auth(token, { type: 'bearer' }).send(body);
  const edit = () => request(app).patch(`/api/v1/daily-reports/${reportId}`).auth(token, { type: 'bearer' }).send({ tasks: 'Built and tested login form', feedback: 'erase' });
  const submit = () => request(app).post(`/api/v1/daily-reports/${reportId}/submit`).auth(token, { type: 'bearer' });
  assert.equal((await request(app).patch(`/api/v1/daily-reports/${reportId}/request-changes`)).status, 401);
  for (role of ['student', 'admin', 'company_representative']) assert.equal((await changes()).status, 403);
  role = 'academic_supervisor';
  assert.equal((await changes({ feedback: 'Fix' }, 'bad')).status, 400);
  for (const body of [{}, { feedback: '' }, { feedback: {} }, { feedback: 'a'.repeat(1001) }]) {
    assert.equal((await changes(body)).status, 400);
  }
  assigned = false; assert.equal((await changes()).status, 404); assigned = true;
  const saved = report; report = null; assert.equal((await changes()).status, 404); report = saved;
  for (const status of ['draft', 'approved', 'changes_requested']) {
    report.status = status; assert.equal((await changes()).status, 409);
  }
  report.status = 'submitted'; race = true; assert.equal((await changes()).status, 409); race = false;
  assert.equal((await changes()).status, 200);
  assert.equal(report.status, 'changes_requested');
  assert.equal(report.feedback, 'Explain the tasks clearly.');
  role = 'student'; active = false;
  assert.equal((await edit()).status, 409); assert.equal((await submit()).status, 409);
  active = true;
  assert.equal((await edit()).status, 200);
  assert.equal(report.tasks, 'Built and tested login form');
  assert.equal(report.feedback, 'Explain the tasks clearly.');
  assert.equal(report.status, 'changes_requested');
  assert.equal((await submit()).status, 200);
  assert.equal(report.status, 'submitted');
  assert.ok(report.submittedAt instanceof Date);
  assert.equal((await edit()).status, 409);
});
