import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import departmentRoutes from '../routes/department.routes.js';
import studentRoutes from '../routes/student.routes.js';
import evaluationRoutes from '../routes/evaluation.routes.js';
import dashboardRoutes from '../routes/dashboard.routes.js';
import { User } from '../model/user.model.js';
import { Department } from '../model/department.model.js';
import { StudentProfile } from '../model/student-profile.model.js';
import { Internship } from '../model/internship.model.js';
import { Company } from '../model/company.model.js';
import { Evaluation } from '../model/evaluation.model.js';
import { Opportunity } from '../model/opportunity.model.js';
import { Application } from '../model/application.model.js';
import { DailyReport } from '../model/daily-report.model.js';
import { WeeklyReport } from '../model/weekly-report.model.js';
import { errorHandler } from '../middleware/error.middleware.js';

const userId = '507f1f77bcf86cd799439011';
const departmentId = '507f1f77bcf86cd799439012';
const internshipId = '507f1f77bcf86cd799439013';
const companyId = '507f1f77bcf86cd799439014';

function setup(t) {
  const old = process.env.JWT_SECRET;
  t.after(() => {
    if (old === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = old;
  });
  process.env.JWT_SECRET = 'selected-modules-test-secret-only';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: userId });
  const context = { role: 'student', active: true };
  t.mock.method(User, 'findById', async () => ({ id: userId, role: context.role, isActive: context.active }));
  const app = express(); app.use(express.json());
  app.use('/departments', departmentRoutes); app.use('/students', studentRoutes);
  app.use('/evaluations', evaluationRoutes); app.use('/dashboard', dashboardRoutes);
  app.use(errorHandler);
  context.call = (method, path, body) => request(app)[method](path).auth(token, { type: 'bearer' }).send(body);
  context.app = app;
  return context;
}

test('departments and academic profiles validate inputs, uniqueness and private access', async (t) => {
  const c = setup(t);
  let departmentExists = true;
  let duplicate = false;
  let profile;
  t.mock.method(Department, 'create', async (data) => {
    if (duplicate) throw Object.assign(new Error('Duplicate'), { code: 11000 });
    assert.deepEqual(data, { name: 'Computer Science', code: 'CS' });
    const department = new Department(data); await department.validate(); return department;
  });
  t.mock.method(Department, 'exists', async () => departmentExists);
  t.mock.method(StudentProfile, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { user: userId });
    assert.equal(options.upsert, true); assert.equal(options.runValidators, true);
    assert.deepEqual(Object.keys(update.$set).sort(), ['studentNumber', 'department', 'semester', 'phone'].sort());
    if (duplicate) throw Object.assign(new Error('Duplicate'), { code: 11000 });
    profile = new StudentProfile({ user: userId, ...update.$set }); await profile.validate(); return profile;
  });
  t.mock.method(StudentProfile, 'findOne', (filter) => {
    assert.deepEqual(filter, { user: userId }); return { populate: async () => profile };
  });
  assert.equal((await request(c.app).put('/students/me').send({})).status, 401);
  assert.equal((await c.call('post', '/departments', { name: 'CS', code: 'CS' })).status, 403);
  assert.equal((await c.call('get', '/students')).status, 403);
  assert.equal((await c.call('get', '/students/me')).status, 404);
  c.role = 'admin';
  assert.equal((await c.call('put', '/students/me', {})).status, 403);
  assert.equal((await c.call('post', '/departments', { name: 'x', code: {} })).status, 400);
  assert.equal((await c.call('post', '/departments', { name: ' Computer Science ', code: 'cs' })).status, 201);
  duplicate = true;
  assert.equal((await c.call('post', '/departments', { name: 'Computer Science', code: 'CS' })).status, 409);
  duplicate = false; c.role = 'student';
  const body = { studentNumber: ' stu-1 ', departmentId, semester: 7, phone: '+93 700 123 456' };
  for (const bad of [{}, { ...body, semester: '7' }, { ...body, semester: 13 }, { ...body, departmentId: {} }, { ...body, phone: '-------' }]) {
    assert.equal((await c.call('put', '/students/me', bad)).status, 400);
  }
  departmentExists = false; assert.equal((await c.call('put', '/students/me', body)).status, 404); departmentExists = true;
  assert.equal((await c.call('put', '/students/me', { ...body, user: 'attacker', role: 'admin' })).status, 200);
  assert.equal(profile.studentNumber, 'STU-1'); assert.equal(String(profile.user), userId);
  assert.equal((await c.call('get', '/students/me?user=attacker')).status, 200);
  duplicate = true; assert.equal((await c.call('put', '/students/me', body)).status, 409);
});

test('final evaluations enforce completion, assigned evaluators, score bounds and privacy', async (t) => {
  const c = setup(t);
  let supervisor = userId;
  let companyAssigned = true;
  let status = 'completed';
  let missing = false;
  let duplicate = false;
  let created;
  let expectedFilter;
  t.mock.method(Internship, 'findById', async () => missing ? null : { _id: internshipId, student: departmentId, supervisor, company: companyId, status });
  t.mock.method(Company, 'exists', async (filter) => {
    assert.deepEqual(filter, { _id: companyId, representative: userId }); return companyAssigned;
  });
  t.mock.method(Evaluation, 'create', async (data) => {
    if (duplicate) throw Object.assign(new Error('Duplicate'), { code: 11000 });
    created = new Evaluation(data); await created.validate(); return created;
  });
  t.mock.method(Evaluation, 'find', (filter) => {
    assert.deepEqual(filter, expectedFilter);
    return { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => [] };
  });
  const body = { internshipId, score: 85, comments: ' Good work ' };
  assert.equal((await request(c.app).post('/evaluations').send(body)).status, 401);
  assert.equal((await c.call('post', '/evaluations', body)).status, 403);
  c.role = 'admin'; assert.equal((await c.call('post', '/evaluations', body)).status, 403);
  c.role = 'academic_supervisor';
  for (const bad of [{}, { ...body, score: '85' }, { ...body, score: 101 }, { ...body, score: -1 }, { ...body, comments: ' ' }]) {
    assert.equal((await c.call('post', '/evaluations', bad)).status, 400);
  }
  missing = true; assert.equal((await c.call('post', '/evaluations', body)).status, 404); missing = false;
  supervisor = departmentId; assert.equal((await c.call('post', '/evaluations', body)).status, 404); supervisor = userId;
  status = 'active'; assert.equal((await c.call('post', '/evaluations', body)).status, 409); status = 'completed';
  assert.equal((await c.call('post', '/evaluations', { ...body, student: 'attacker', type: 'company' })).status, 201);
  assert.equal(created.type, 'academic'); assert.equal(String(created.student), departmentId); assert.equal(created.comments, 'Good work');
  duplicate = true; assert.equal((await c.call('post', '/evaluations', body)).status, 409); duplicate = false;
  c.role = 'company_representative'; companyAssigned = false;
  assert.equal((await c.call('post', '/evaluations', body)).status, 404); companyAssigned = true;
  assert.equal((await c.call('post', '/evaluations', { ...body, score: 0 })).status, 201); assert.equal(created.type, 'company');
  expectedFilter = { evaluator: userId }; assert.equal((await c.call('get', '/evaluations')).status, 200);
  c.role = 'academic_supervisor'; assert.equal((await c.call('get', '/evaluations')).status, 200);
  c.role = 'student'; expectedFilter = { student: userId };
  assert.equal((await c.call('get', '/evaluations?student=attacker')).status, 200);
  c.role = 'admin'; expectedFilter = {}; assert.equal((await c.call('get', '/evaluations')).status, 200);
  assert.equal((await c.call('get', '/evaluations?limit=101')).status, 400);
  assert.ok(Evaluation.schema.indexes().some(([fields, opts]) => fields.internship && fields.type && opts.unique));
});

test('dashboard counters are scoped to the authenticated role and assignment', async (t) => {
  const c = setup(t);
  const calls = [];
  for (const model of [User, Company, Department, Opportunity, Application, Internship, DailyReport, WeeklyReport, Evaluation]) {
    t.mock.method(model, 'countDocuments', async (filter) => { calls.push([model.modelName, filter]); return 2; });
  }
  t.mock.method(Internship, 'find', (filter) => {
    assert.deepEqual(filter, { supervisor: userId }); return { distinct: async () => [internshipId] };
  });
  t.mock.method(Company, 'find', (filter) => {
    assert.deepEqual(filter, { representative: userId }); return { distinct: async () => [companyId] };
  });
  assert.equal((await request(c.app).get('/dashboard/stats')).status, 401);
  let response = await c.call('get', '/dashboard/stats?student=attacker');
  assert.equal(response.status, 200); assert.equal(response.body.data.stats.applications, 2);
  assert.ok(calls.every(([, filter]) => filter.student === userId));
  calls.length = 0; c.role = 'academic_supervisor';
  response = await c.call('get', '/dashboard/stats'); assert.equal(response.status, 200);
  assert.equal(response.body.data.stats.assignedInternships, 1);
  assert.ok(calls.some(([name, filter]) => name === 'DailyReport' && filter.internship.$in[0] === internshipId && filter.status === 'submitted'));
  calls.length = 0; c.role = 'company_representative';
  response = await c.call('get', '/dashboard/stats'); assert.equal(response.status, 200);
  assert.ok(calls.some(([name, filter]) => name === 'Opportunity' && filter.company.$in[0] === companyId && filter.deadline.$gt instanceof Date));
  calls.length = 0; c.role = 'admin';
  response = await c.call('get', '/dashboard/stats'); assert.equal(response.status, 200);
  assert.equal(response.body.data.stats.departments, 2);
  c.active = false; assert.equal((await c.call('get', '/dashboard/stats')).status, 401);
});
