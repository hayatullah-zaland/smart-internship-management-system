import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from '../routes/internship.routes.js';
import { Internship } from '../model/internship.model.js';
import { Application } from '../model/application.model.js';
import { Opportunity } from '../model/opportunity.model.js';
import { Company } from '../model/company.model.js';
import { User } from '../model/user.model.js';
import { errorHandler } from '../middleware/error.middleware.js';

test('placements validate assignment, reserve seats and scope private lists', async (t) => {
  const ids = Array.from({ length: 6 }, (_, n) => `507f1f77bcf86cd79943901${n}`);
  const [adminId, studentId, supervisorId, applicationId, opportunityId, companyId] = ids;
  const previousSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  process.env.JWT_SECRET = 'internship-test-secret-not-for-production';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: adminId });
  let role = 'admin';
  let supervisorActive = true;
  let studentActive = true;
  let application = { _id: applicationId, student: studentId, opportunity: opportunityId, status: 'approved' };
  let capacity = 2;
  let conflict = false;
  let collision = false;
  let duplicateStudent = false;
  let writes = 0;
  let slots = [];
  let expectedFilter = {};
  t.mock.method(User, 'findById', async (id) => {
    if (String(id) === adminId) return { id: adminId, role, isActive: true };
    if (String(id) === studentId) return { _id: studentId, role: 'student', isActive: studentActive };
    return { _id: supervisorId, role: 'academic_supervisor', isActive: supervisorActive };
  });
  t.mock.method(Application, 'findById', async () => application);
  t.mock.method(Opportunity, 'findById', async () => ({ _id: opportunityId, company: companyId, capacity }));
  t.mock.method(Company, 'exists', async () => ({ _id: companyId }));
  t.mock.method(Internship, 'exists', async () => conflict);
  t.mock.method(Internship, 'find', (filter) => {
    if (filter.opportunity) {
      assert.equal(filter.opportunity, opportunityId);
      return { select(field) { assert.equal(field, 'slot'); return this; }, lean: async () => slots.map((slot) => ({ slot })) };
    }
    assert.deepEqual(filter, expectedFilter);
    return { populate() { return this; }, sort() { return this; },
      skip(n) { assert.equal(n, 10); return this; }, limit(n) { assert.equal(n, 10); return Promise.resolve([]); } };
  });
  t.mock.method(Internship, 'create', async (data) => {
    writes++;
    if (collision) {
      collision = false; slots.push(data.slot);
      throw Object.assign(new Error('Seat reserved'), { code: 11000, keyPattern: { opportunity: 1, slot: 1 } });
    }
    if (duplicateStudent) throw Object.assign(new Error('Already assigned'), { code: 11000, keyPattern: { student: 1 } });
    assert.equal(data.student, studentId);
    assert.equal(data.company, companyId);
    assert.equal(data.createdBy, adminId);
    assert.equal(data.supervisor, supervisorId);
    assert.ok(data.slot <= capacity);
    const internship = new Internship(data);
    await internship.validate();
    slots.push(data.slot);
    return internship;
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/internships', routes); app.use(errorHandler);
  const body = { applicationId, supervisorId, startDate: '2027-01-01', endDate: '2027-03-01' };
  const post = (data = body) => request(app).post('/api/v1/internships').auth(token, { type: 'bearer' }).send(data);
  const list = () => request(app).get('/api/v1/internships?page=2&limit=10&student=attacker').auth(token, { type: 'bearer' });
  assert.equal((await request(app).post('/api/v1/internships').send(body)).status, 401);
  assert.equal((await request(app).get('/api/v1/internships')).status, 401);
  for (role of ['student', 'academic_supervisor', 'company_representative']) assert.equal((await post()).status, 403);
  role = 'admin';
  for (const bad of [{}, { ...body, applicationId: {} }, { ...body, endDate: '2026-02-30' },
    { ...body, startDate: body.endDate }, { ...body, endDate: '2026-01-01' }]) {
    assert.equal((await post(bad)).status, 400);
  }
  application.status = 'pending'; assert.equal((await post()).status, 409); application.status = 'approved';
  const saved = application; application = null; assert.equal((await post()).status, 404); application = saved;
  supervisorActive = false; assert.equal((await post()).status, 400); supervisorActive = true;
  studentActive = false; assert.equal((await post()).status, 400); studentActive = true;
  conflict = true; assert.equal((await post()).status, 409); conflict = false;
  slots = [1, 2]; assert.equal((await post()).status, 409); slots = [];
  assert.equal(writes, 0);
  collision = true;
  const created = await post({ ...body, student: 'attacker', status: 'completed', slot: 999 });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.internship.status, 'assigned');
  assert.equal(created.body.data.internship.slot, undefined);
  assert.equal(writes, 2);
  assert.deepEqual(slots, [1, 2]);
  assert.equal((await post()).status, 409);
  slots = []; duplicateStudent = true; assert.equal((await post()).status, 409);
  expectedFilter = {}; assert.equal((await list()).status, 200);
  role = 'student'; expectedFilter = { student: adminId }; assert.equal((await list()).status, 200);
  role = 'academic_supervisor'; expectedFilter = { supervisor: adminId }; assert.equal((await list()).status, 200);
  role = 'company_representative'; assert.equal((await list()).status, 403);
  const indexes = Internship.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.application && options.unique));
  assert.ok(indexes.some(([fields, options]) => fields.opportunity && fields.slot && options.unique));
  assert.ok(indexes.some(([fields, options]) => fields.student && options.unique && options.partialFilterExpression));
});
