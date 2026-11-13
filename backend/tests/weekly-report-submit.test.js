import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from '../routes/weekly-report.routes.js';
import { WeeklyReport } from '../model/weekly-report.model.js';
import { Internship } from '../model/internship.model.js';
import { User } from '../model/user.model.js';

test('students can edit and submit only their own active-internship drafts', async (t) => {
  const studentId = '507f1f77bcf86cd799439011';
  const reportId = '507f1f77bcf86cd799439012';
  const internshipId = '507f1f77bcf86cd799439013';
  const previousSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  process.env.JWT_SECRET = 'weekly-report-submit-test-secret-only';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: studentId });
  let role = 'student';
  let owns = true;
  let active = true;
  let race = false;
  let writes = 0;
  let report = { internship: internshipId, status: 'draft', summary: 'Summary', learning: 'Learning', challenges: '', __v: 0 };
  t.mock.method(User, 'findById', async () => ({ id: studentId, role, isActive: true }));
  t.mock.method(WeeklyReport, 'findOne', async (filter) => {
    assert.deepEqual(filter, { _id: reportId, student: studentId }); return owns ? report : null;
  });
  t.mock.method(Internship, 'exists', async (filter) => {
    assert.deepEqual(filter, { _id: internshipId, student: studentId, status: 'active' }); return active;
  });
  t.mock.method(WeeklyReport, 'findOneAndUpdate', async (filter, update, options) => {
    writes++;
    assert.equal(filter._id, reportId); assert.equal(filter.student, studentId); assert.equal(filter.status, 'draft');
    assert.deepEqual(options, { new: true, runValidators: true });
    assert.equal(update.$inc.__v, 1);
    if (update.$set.status) {
      assert.equal(update.$set.status, 'submitted'); assert.ok(update.$set.submittedAt instanceof Date);
    } else {
      assert.equal(filter.__v, report.__v);
      assert.deepEqual(Object.keys(update.$set).sort(), ['summary', 'learning', 'challenges'].sort());
    }
    if (race) return null;
    report = { ...report, ...update.$set, __v: report.__v + 1 };
    return report;
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/weekly-reports', routes);
  const edit = (body, id = reportId) => request(app).patch(`/api/v1/weekly-reports/${id}`).auth(token, { type: 'bearer' }).send(body);
  const submit = (id = reportId) => request(app).post(`/api/v1/weekly-reports/${id}/submit`).auth(token, { type: 'bearer' }).send({ status: 'draft' });
  assert.equal((await request(app).patch(`/api/v1/weekly-reports/${reportId}`).send({ summary: 'New' })).status, 401);
  assert.equal((await request(app).post(`/api/v1/weekly-reports/${reportId}/submit`)).status, 401);
  for (role of ['admin', 'academic_supervisor', 'company_representative']) {
    assert.equal((await edit({ summary: 'New' })).status, 403);
    assert.equal((await submit()).status, 403);
  }
  role = 'student';
  assert.equal((await edit({ summary: 'New' }, 'bad')).status, 400);
  assert.equal((await submit('bad')).status, 400);
  owns = false;
  assert.equal((await edit({ summary: 'New' })).status, 404); assert.equal((await submit()).status, 404);
  owns = true;
  for (const body of [{}, { status: 'submitted' }, { summary: ' ' }, { learning: {} }, { challenges: 'a'.repeat(2001) }]) {
    assert.equal((await edit(body)).status, 400);
  }
  active = false;
  assert.equal((await edit({ summary: 'New' })).status, 409); assert.equal((await submit()).status, 409);
  active = true; assert.equal(writes, 0);
  race = true;
  assert.equal((await edit({ summary: 'New' })).status, 409); assert.equal((await submit()).status, 409);
  race = false;
  assert.equal((await edit({ summary: ' Updated summary ', weekNumber: 99, student: 'attacker' })).status, 200);
  assert.equal(report.summary, 'Updated summary'); assert.equal(report.learning, 'Learning');
  assert.equal(report.weekNumber, undefined); assert.equal(report.student, undefined);
  assert.equal((await submit()).status, 200); assert.equal(report.status, 'submitted');
  const finalWrites = writes;
  assert.equal((await edit({ summary: 'Again' })).status, 409); assert.equal((await submit()).status, 409);
  assert.equal(writes, finalWrites);
});
