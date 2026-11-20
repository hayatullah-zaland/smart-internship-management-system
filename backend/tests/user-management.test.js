import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import userRoutes from '../routes/user.routes.js';
import authRoutes from '../routes/auth.routes.js';
import { User } from '../model/user.model.js';
import { StudentProfile } from '../model/student-profile.model.js';
import { Application } from '../model/application.model.js';
import { Internship } from '../model/internship.model.js';
import { Company } from '../model/company.model.js';
import { Opportunity } from '../model/opportunity.model.js';
import { DailyReport } from '../model/daily-report.model.js';
import { WeeklyReport } from '../model/weekly-report.model.js';
import { Evaluation } from '../model/evaluation.model.js';
import { errorHandler } from '../middleware/error.middleware.js';

const actorId = '507f1f77bcf86cd799439099';
const targetId = '507f1f77bcf86cd799439011';
const models = [StudentProfile, Application, Internship, Company, Opportunity, DailyReport, WeeklyReport, Evaluation];
const details = { name: ' Updated Teacher ', email: ' UPDATED@example.com ' };

function setup(t) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'user-management-isolated-test-secret';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const actor = { id: actorId, role: 'admin', isActive: true };
  const target = new User({ _id: targetId, name: 'Test Teacher', email: 'teacher@example.com', role: 'academic_supervisor',
    passwordHash: 'private-hash', profileImage: 'data:image/jpeg;base64,/9j/4AAC/9k=' });
  const c = { actor, target, saves: 0, deletes: 0, created: [], duplicate: false, linked: '', references: [], raced: false };
  t.mock.method(User, 'findById', async (id) => id === actorId ? actor : c.target);
  t.mock.method(User, 'exists', async () => c.duplicate);
  t.mock.method(target, 'save', async () => { await target.validate(); c.saves++; return target; });
  t.mock.method(bcrypt, 'hash', async (password, rounds) => {
    assert.equal(password, 'Test-password-123'); assert.equal(rounds, 12); return 'hashed-new-password';
  });
  t.mock.method(User, 'create', async (data) => {
    assert.equal(data.passwordHash, 'hashed-new-password');
    assert.equal(data.password, undefined);
    const user = new User(data); await user.validate(); c.created.push(user); return user;
  });
  for (const model of models) {
    t.mock.method(model, 'exists', async (filter) => {
      assert.ok(JSON.stringify(filter).includes(targetId));
      c.references.push(model.modelName);
      return c.linked === model.modelName;
    });
  }
  t.mock.method(User, 'findOneAndDelete', async (filter) => {
    assert.deepEqual(filter, { _id: targetId, role: { $ne: 'admin' }, isActive: false });
    if (c.raced) return null;
    c.deletes++; const removed = c.target; c.target = null; return removed;
  });
  const app = express(); app.use(express.json());
  app.use('/users', userRoutes); app.use('/auth', authRoutes); app.use(errorHandler);
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: actorId, expiresIn: '5m' });
  c.app = app;
  c.call = (method, path, body) => request(app)[method](path).auth(token, { type: 'bearer' }).send(body);
  return c;
}

test('only an active authenticated admin can create, edit or delete users', async (t) => {
  const c = setup(t);
  for (const [method, path] of [['post', '/auth/create-user'], ['patch', '/users/' + targetId], ['delete', '/users/' + targetId]]) {
    assert.equal((await request(c.app)[method](path).send(details)).status, 401);
    for (const role of ['student', 'academic_supervisor', 'company_representative']) {
      c.actor.role = role; assert.equal((await c.call(method, path, details)).status, 403);
    }
    c.actor.role = 'admin'; c.actor.isActive = false;
    assert.equal((await c.call(method, path, details)).status, 401); c.actor.isActive = true;
  }
  assert.equal(c.saves + c.deletes + c.created.length, 0);
});

test('admin creation accepts all four roles, hashes passwords and rejects invalid and duplicate accounts', async (t) => {
  const c = setup(t);
  for (const role of ['student', 'academic_supervisor', 'company_representative', 'admin']) {
    const response = await c.call('post', '/auth/create-user', { name: ' New User ', email: ' NEW@example.com ', role, password: 'Test-password-123' });
    assert.equal(response.status, 201); assert.equal(response.body.data.user.role, role);
    assert.equal(response.body.data.user.name, 'New User'); assert.equal(response.body.data.user.email, 'new@example.com');
    assert.equal(response.body.data.user.isActive, true); assert.equal(response.body.data.user.passwordHash, undefined);
  }
  c.duplicate = true;
  assert.equal((await c.call('post', '/auth/create-user', { name: 'Duplicate', email: 'new@example.com', password: 'Test-password-123' })).status, 409);
  c.duplicate = false;
  for (const body of [{}, { name: 'x', email: 'bad', password: 'short' }, { name: 'User', email: 'user@example.com', password: 'Test-password-123', role: 'teacher' }]) {
    assert.equal((await c.call('post', '/auth/create-user', body)).status, 400);
  }
  assert.equal(c.created.length, 4);
});

test('editing normalizes identity and never changes role, password, photo or status', async (t) => {
  const c = setup(t);
  const response = await c.call('patch', '/users/' + targetId, { ...details, role: 'admin', isActive: false, passwordHash: 'changed', profileImage: '', _id: actorId });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.user, { id: targetId, name: 'Updated Teacher', email: 'updated@example.com', role: 'academic_supervisor', isActive: true });
  assert.equal(c.target.passwordHash, 'private-hash'); assert.equal(c.target.profileImage, 'data:image/jpeg;base64,/9j/4AAC/9k=');
  assert.equal(c.saves, 1);
});

test('bad IDs, invalid input, duplicate email, protected admins and missing users do not save', async (t) => {
  const c = setup(t);
  assert.equal((await c.call('patch', '/users/bad', details)).status, 400);
  for (const body of [{}, { ...details, name: 'x' }, { ...details, name: 'a'.repeat(101) }, { ...details, email: 'bad' }, { ...details, email: {} }]) {
    assert.equal((await c.call('patch', '/users/' + targetId, body)).status, 400);
  }
  c.duplicate = true; assert.equal((await c.call('patch', '/users/' + targetId, details)).status, 409); c.duplicate = false;
  assert.equal((await c.call('patch', '/users/' + actorId, details)).status, 403);
  c.target = null; assert.equal((await c.call('patch', '/users/' + targetId, details)).status, 404);
  assert.equal(c.saves, 0);
});

test('deletion requires an inactive unused non-admin account and confirms its exact ID', async (t) => {
  const c = setup(t);
  assert.equal((await c.call('delete', '/users/bad')).status, 400);
  assert.equal((await c.call('delete', '/users/' + actorId)).status, 403);
  assert.equal((await c.call('delete', '/users/' + targetId)).status, 409);
  assert.equal(c.references.length, 0);
  c.target.isActive = false;
  const response = await c.call('delete', '/users/' + targetId);
  assert.equal(response.status, 200); assert.equal(response.body.data.userId, targetId);
  assert.deepEqual(c.references, models.map((model) => model.modelName));
  assert.equal(c.deletes, 1);
  assert.equal((await c.call('delete', '/users/' + targetId)).status, 404);
});

test('every kind of project reference blocks deletion without cascading any records', async (t) => {
  const c = setup(t); c.target.isActive = false;
  for (const model of models) {
    c.linked = model.modelName;
    const response = await c.call('delete', '/users/' + targetId);
    assert.equal(response.status, 409, model.modelName);
    assert.match(response.body.message, /project records/);
  }
  assert.equal(c.deletes, 0);
});

test('conditional deletion refuses an account changed after the preflight checks', async (t) => {
  const c = setup(t); c.target.isActive = false; c.raced = true;
  const response = await c.call('delete', '/users/' + targetId);
  assert.equal(response.status, 409); assert.match(response.body.message, /account changed/);
  assert.equal(c.deletes, 0);
});

test('admin user categories filter the database query before deterministic pagination', async (t) => {
  const c = setup(t);
  let expectedRole;
  t.mock.method(User, 'find', (filter) => {
    assert.deepEqual(filter, expectedRole ? { role: expectedRole } : {});
    const query = {
      select(fields) { assert.equal(fields, 'name email role isActive createdAt'); return query; },
      sort(order) { assert.deepEqual(order, { createdAt: -1, _id: -1 }); return query; },
      skip(offset) { assert.equal(offset, 10); return query; },
      async limit(limit) {
        assert.equal(limit, 10);
        return [{ _id: targetId, name: 'Category Account', email: 'category@example.test', role: expectedRole || 'student', isActive: false }];
      },
    };
    return query;
  });
  for (const role of [undefined, 'student', 'academic_supervisor', 'admin', 'company_representative']) {
    expectedRole = role;
    const response = await c.call('get', '/users?page=2&limit=10' + (role ? `&role=${role}` : ''));
    assert.equal(response.status, 200);
    assert.equal(response.body.data.users[0].role, role || 'student');
    assert.equal(response.body.data.users[0].isActive, false);
    assert.equal(response.body.data.page, 2);
    assert.equal(response.body.data.limit, 10);
  }
});

test('invalid user categories and pagination are rejected before querying accounts', async (t) => {
  const c = setup(t);
  const find = t.mock.method(User, 'find', () => { throw new Error('Unexpected account query'); });
  for (const query of ['role=teacher', 'role=', 'role=__proto__', 'role=toString', 'role=student&role=admin',
    'role=student&page=0', 'role=student&limit=101']) {
    assert.equal((await c.call('get', '/users?' + query)).status, 400, query);
  }
  assert.equal(find.mock.callCount(), 0);
});

test('account category reads still require an active authenticated administrator', async (t) => {
  const c = setup(t);
  const find = t.mock.method(User, 'find', () => { throw new Error('Unexpected account query'); });
  assert.equal((await request(c.app).get('/users?role=student')).status, 401);
  for (const role of ['student', 'academic_supervisor', 'company_representative']) {
    c.actor.role = role;
    assert.equal((await c.call('get', '/users?role=student')).status, 403);
  }
  c.actor.role = 'admin'; c.actor.isActive = false;
  assert.equal((await c.call('get', '/users?role=student')).status, 401);
  assert.equal(find.mock.callCount(), 0);
});
