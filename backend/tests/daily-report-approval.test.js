import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from '../routes/daily-report.routes.js';
import { DailyReport } from '../model/daily-report.model.js';
import { Internship } from '../model/internship.model.js';
import { User } from '../model/user.model.js';

test('only assigned supervisors can approve submitted reports once', async (t) => {
  const userId = '507f1f77bcf86cd799439011';
  const reportId = '507f1f77bcf86cd799439012';
  const internshipId = '507f1f77bcf86cd799439013';
  const previousSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  process.env.JWT_SECRET = 'daily-report-approval-test-secret-only';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: userId });
  let role = 'academic_supervisor';
  let assigned = true;
  let race = false;
  let report = { internship: internshipId, status: 'submitted' };
  let writes = 0;
  t.mock.method(User, 'findById', async () => ({ id: userId, role, isActive: true }));
  t.mock.method(DailyReport, 'findById', async (id) => { assert.equal(id, reportId); return report; });
  t.mock.method(Internship, 'exists', async (filter) => {
    assert.deepEqual(filter, { _id: internshipId, supervisor: userId }); return assigned;
  });
  t.mock.method(DailyReport, 'findOneAndUpdate', async (filter, update, options) => {
    writes++;
    assert.deepEqual(filter, { _id: reportId, status: 'submitted' });
    assert.deepEqual(options, { new: true, runValidators: true });
    assert.equal(update.$inc.__v, 1);
    assert.deepEqual(Object.keys(update.$set).sort(), ['status', 'reviewedBy', 'reviewedAt'].sort());
    assert.equal(update.$set.reviewedBy, userId);
    assert.ok(update.$set.reviewedAt instanceof Date);
    if (race) return null;
    report = { ...report, ...update.$set };
    return report;
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/daily-reports', routes);
  const approve = (id = reportId) => request(app).patch(`/api/v1/daily-reports/${id}/approve`)
    .auth(token, { type: 'bearer' }).send({ reviewedBy: 'attacker', status: 'draft' });

  assert.equal((await request(app).patch(`/api/v1/daily-reports/${reportId}/approve`)).status, 401);
  for (role of ['student', 'admin', 'company_representative']) assert.equal((await approve()).status, 403);
  role = 'academic_supervisor';
  assert.equal((await approve('bad-id')).status, 400);
  assigned = false; assert.equal((await approve()).status, 404); assigned = true;
  const saved = report; report = null; assert.equal((await approve()).status, 404); report = saved;
  report.status = 'draft'; assert.equal((await approve()).status, 409);
  assert.equal(writes, 0);
  report.status = 'submitted'; race = true; assert.equal((await approve()).status, 409); race = false;
  const response = await approve();
  assert.equal(response.status, 200);
  assert.equal(response.body.data.report.status, 'approved');
  assert.equal(report.reviewedBy, userId);
  const writesBefore = writes;
  assert.equal((await approve()).status, 409);
  assert.equal(writes, writesBefore);
});
