import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import studentRoutes from '../routes/student.routes.js';
import { User } from '../model/user.model.js';
import { StudentProfile } from '../model/student-profile.model.js';
import { errorHandler } from '../middleware/error.middleware.js';

const userId = '507f1f77bcf86cd799439099';
const profile = { _id: '507f1f77bcf86cd799439011', studentNumber: 'STU-001', semester: 7, phone: '+93700123456',
  user: { _id: '507f1f77bcf86cd799439012', name: 'Test Student', email: 'student@example.com', isActive: true },
  department: { _id: '507f1f77bcf86cd799439013', name: 'Computer Science', code: 'CS' } };

function setup(t) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'student-directory-mocked-test-secret-only';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const state = { role: 'admin', active: true, profiles: [profile], queries: [] };
  t.mock.method(User, 'findById', async () => ({ id: userId, role: state.role, isActive: state.active }));
  t.mock.method(StudentProfile, 'find', (filter) => {
    assert.equal(filter, undefined);
    const query = {
      populate(...args) { state.queries.push(['populate', ...args]); return query; },
      sort(value) { state.queries.push(['sort', value]); return query; },
      skip(value) { state.queries.push(['skip', value]); return query; },
      async limit(value) { state.queries.push(['limit', value]); return state.profiles; },
    };
    return query;
  });
  const app = express();
  app.use(express.json());
  app.use('/students', studentRoutes);
  app.use(errorHandler);
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: userId, expiresIn: '5m' });
  state.app = app;
  state.get = (path) => request(app).get(path).auth(token, { type: 'bearer' });
  return state;
}

test('student directory requires an active authenticated administrator before querying profiles', async (t) => {
  const state = setup(t);
  assert.equal((await request(state.app).get('/students')).status, 401);
  for (const role of ['student', 'academic_supervisor', 'company_representative']) {
    state.role = role;
    assert.equal((await state.get('/students')).status, 403);
  }
  state.role = 'admin';
  state.active = false;
  assert.equal((await state.get('/students')).status, 401);
  assert.deepEqual(state.queries, []);
});

test('admin student directory returns populated academic profiles with deterministic pagination', async (t) => {
  const state = setup(t);
  const result = await state.get('/students?page=2&limit=10');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { success: true, data: { profiles: [profile], page: 2, limit: 10 } });
  assert.deepEqual(state.queries, [
    ['populate', 'user', 'name email isActive'], ['populate', 'department', 'name code'],
    ['sort', { createdAt: -1, _id: -1 }], ['skip', 10], ['limit', 10],
  ]);
});

test('directory rejects invalid pagination without a profile query', async (t) => {
  const state = setup(t);
  for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=1000001', 'limit=0', 'limit=101', 'limit=1.5']) {
    assert.equal((await state.get(`/students?${query}`)).status, 400);
  }
  assert.deepEqual(state.queries, []);
});

test('directory preserves missing populated references and honest empty results without account writes', async (t) => {
  const state = setup(t);
  const write = t.mock.method(StudentProfile, 'findOneAndUpdate', () => { throw new Error('Unexpected write'); });
  state.profiles = [{ ...profile, user: null, department: null }];
  assert.deepEqual((await state.get('/students')).body.data.profiles, state.profiles);
  state.profiles = [];
  assert.deepEqual((await state.get('/students')).body.data.profiles, []);
  assert.equal(write.mock.callCount(), 0);
});
