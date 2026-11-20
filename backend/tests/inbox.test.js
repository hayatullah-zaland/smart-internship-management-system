import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from '../routes/inbox.routes.js';
import { User } from '../model/user.model.js';
import { DailyReport } from '../model/daily-report.model.js';
import { WeeklyReport } from '../model/weekly-report.model.js';
import { Application } from '../model/application.model.js';
import { Internship } from '../model/internship.model.js';
import { Evaluation } from '../model/evaluation.model.js';
import { Company } from '../model/company.model.js';

const id = (value) => value.toString(16).padStart(24, '0');
const time = (offset = 0) => new Date(Date.now() - 100000 + offset);

function fixture(t, role = 'student') {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'inbox-test-secret-for-isolated-tests';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const user = { id: id(1), role, isActive: true, messagesReadAt: null, notificationsReadAt: null };
  const records = new Map([[DailyReport, []], [WeeklyReport, []], [Application, []], [Internship, []], [Evaluation, []], [Company, []]]);
  const calls = [];
  let available = true;
  t.mock.method(User, 'findById', (userId) => {
    assert.equal(userId, user.id);
    return {
      then(resolve, reject) { return Promise.resolve(available ? user : null).then(resolve, reject); },
      select(fields) { assert.equal(fields, 'messagesReadAt notificationsReadAt'); return { lean: async () => available ? user : null }; },
    };
  });
  t.mock.method(User, 'findOneAndUpdate', (filter, update, options) => {
    assert.deepEqual(filter, { _id: user.id, isActive: true });
    assert.deepEqual(options, { new: true });
    const [field, date] = Object.entries(update.$max)[0];
    assert.ok(['messagesReadAt', 'notificationsReadAt'].includes(field));
    if (!user[field] || user[field] < date) user[field] = date;
    return { select(selected) { assert.equal(selected, field); return { lean: async () => available ? user : null }; } };
  });
  function matches(record, filter) {
    return Object.entries(filter).every(([key, value]) => {
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        return (!Object.hasOwn(value, '$in') || value.$in.includes(record[key]))
          && (!Object.hasOwn(value, '$ne') || record[key] !== value.$ne)
          && (!Object.hasOwn(value, '$lte') || (record[key] != null && record[key] <= value.$lte));
      }
      return record[key] === value;
    });
  }
  for (const Model of records.keys()) t.mock.method(Model, 'find', (filter) => {
    const call = { Model, filter }; calls.push(call);
    const query = {
      select(fields) { call.fields = fields; return this; },
      sort(sort) { call.sort = sort; return this; },
      limit(limit) { assert.equal(limit, 30); return this; },
      populate(field, fields) { assert.equal(fields, 'name'); call.populate = field; return this; },
      async distinct(field) { assert.equal(field, '_id'); return records.get(Model).filter((row) => matches(row, filter)).map((row) => row._id); },
      async lean() {
        return records.get(Model).filter((row) => matches(row, filter)).sort((a, b) => {
          for (const [field, direction] of Object.entries(call.sort)) {
            if (a[field] < b[field]) return -direction;
            if (a[field] > b[field]) return direction;
          }
          return 0;
        }).slice(0, 30);
      },
    };
    return query;
  });
  const app = express(); app.use(express.json()); app.use('/api/v1/inbox', routes);
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: user.id });
  return { user, records, calls, app, setAvailable(value) { available = value; },
    get: () => request(app).get('/api/v1/inbox').auth(token, { type: 'bearer' }),
    read: (body) => request(app).patch('/api/v1/inbox/read').auth(token, { type: 'bearer' }).send(body) };
}

test('inbox requires an active authenticated account and rejects unsupported roles', async (t) => {
  const f = fixture(t);
  assert.equal((await request(f.app).get('/api/v1/inbox')).status, 401);
  assert.equal((await request(f.app).patch('/api/v1/inbox/read').send({})).status, 401);
  f.user.isActive = false; assert.equal((await f.get()).status, 401);
  f.user.isActive = true; f.user.role = 'owner';
  assert.equal((await f.get()).status, 403);
  assert.equal((await f.read({})).status, 403);
  f.setAvailable(false); assert.equal((await f.get()).status, 401);
  assert.equal(f.calls.length, 0);
});

test('students receive their current feedback, real report events, decisions and grades without other students or drafts', async (t) => {
  const f = fixture(t);
  const base = { student: f.user.id, date: time(), submittedAt: time(-5000), reviewedAt: time(), feedback: 'Explain the tests. <script>alert(1)</script>', reviewedBy: { name: 'Teacher A' } };
  f.records.set(DailyReport, [{ ...base, _id: id(10), status: 'changes_requested' },
    { ...base, _id: id(11), status: 'approved' }, { ...base, _id: id(12), status: 'draft', submittedAt: null },
    { ...base, _id: id(13), student: id(2), status: 'changes_requested' }]);
  f.records.set(WeeklyReport, [{ _id: id(20), student: f.user.id, weekNumber: 2, status: 'submitted', submittedAt: time() }]);
  f.records.set(Application, [{ _id: id(30), student: f.user.id, status: 'rejected', rejectionReason: 'All places filled.', reviewedAt: time() }]);
  f.records.set(Evaluation, [{ _id: id(40), student: f.user.id, type: 'academic', score: 0, createdAt: time() }]);
  f.records.set(Internship, [{ _id: id(50), student: f.user.id, status: 'active', updatedAt: time(), statusHistory: [{ to: 'active', changedAt: time() }] }]);
  const response = await f.get(); assert.equal(response.status, 200);
  const data = response.body.data;
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(data.userId, f.user.id); assert.equal(data.role, 'student');
  assert.equal(data.messages.length, 1);
  assert.match(data.messages[0].body, /Teacher A: Explain the tests/);
  assert.equal(data.messages[0].href, '/daily-reports');
  assert.equal(data.notifications.length, 7);
  assert.ok(data.notifications.some((entry) => entry.body.includes('0/100')));
  assert.ok(data.notifications.some((entry) => entry.title === 'Weekly report submitted'));
  assert.ok(!JSON.stringify(data).includes(id(13)));
  assert.ok(!JSON.stringify(data).includes(id(12)));
  for (const call of f.calls.filter((call) => [DailyReport, WeeklyReport, Application, Evaluation, Internship].includes(call.Model))) {
    assert.equal(call.filter.student, f.user.id);
  }
  assert.equal(data.unread.messages, 1);
  assert.equal(data.unread.notifications, data.notifications.length);
});

test('assigned teachers see submitted daily reports only and never acquire weekly-report or student feedback access', async (t) => {
  const f = fixture(t, 'academic_supervisor');
  f.records.set(Internship, [{ _id: id(50), supervisor: f.user.id, status: 'assigned', createdAt: time(), updatedAt: time() }]);
  f.records.set(DailyReport, [{ _id: id(10), internship: id(50), status: 'submitted', student: { name: 'Assigned student' }, date: time(), submittedAt: time() },
    { _id: id(11), internship: id(51), status: 'submitted', date: time(), submittedAt: time() }]);
  const data = (await f.get()).body.data;
  assert.deepEqual(data.messages, []);
  assert.equal(data.notifications.length, 2);
  assert.ok(data.notifications.some((entry) => entry.body.includes('Assigned student')));
  assert.ok(data.notifications.every((entry) => ['/daily-reports', '/internships'].includes(entry.href)));
  const daily = f.calls.find((call) => call.Model === DailyReport);
  assert.deepEqual(daily.filter.internship, { $in: [id(50)] });
  assert.equal(daily.filter.status, 'submitted');
  assert.ok(f.calls.filter((call) => call.Model === Internship).every((call) => call.filter.supervisor === f.user.id));
  assert.ok(!f.calls.some((call) => [WeeklyReport, Evaluation, Application].includes(call.Model)));
});

test('admins receive report submissions and pending applications, not private teacher messages', async (t) => {
  const f = fixture(t, 'admin');
  f.records.set(DailyReport, [{ _id: id(10), student: { name: 'Student A' }, date: time(), submittedAt: time() }]);
  f.records.set(WeeklyReport, [{ _id: id(20), student: { name: 'Student B' }, weekNumber: 3, submittedAt: time() }]);
  f.records.set(Application, [{ _id: id(30), student: { name: 'Student C' }, status: 'pending', createdAt: time() }]);
  const data = (await f.get()).body.data;
  assert.deepEqual(data.messages, []); assert.equal(data.notifications.length, 3);
  assert.ok(data.notifications.some((entry) => entry.href === '/admin/applications'));
  assert.ok(!f.calls.some((call) => call.Model === Evaluation));
});

test('company representatives see only completed internships at their assigned companies with an accessible evaluation link', async (t) => {
  const f = fixture(t, 'company_representative');
  f.records.set(Company, [{ _id: id(70), representative: f.user.id }, { _id: id(71), representative: id(2) }]);
  f.records.set(Internship, [{ _id: id(50), company: id(70), status: 'completed', updatedAt: time(), statusHistory: [{ to: 'completed', changedAt: time() }] },
    { _id: id(51), company: id(71), status: 'completed', updatedAt: time(), statusHistory: [{ to: 'completed', changedAt: time() }] }]);
  const data = (await f.get()).body.data;
  assert.deepEqual(data.messages, []); assert.equal(data.notifications.length, 1);
  assert.equal(data.notifications[0].href, '/evaluations');
  assert.deepEqual(f.calls.find((call) => call.Model === Company).filter, { representative: f.user.id });
  assert.deepEqual(f.calls.find((call) => call.Model === Internship).filter, { company: { $in: [id(70)] }, status: 'completed' });
  assert.ok(!f.calls.some((call) => [DailyReport, WeeklyReport, Application, Evaluation].includes(call.Model)));
});

test('read cursors are account/channel scoped, persistent, monotonic and leave newer activity unread', async (t) => {
  const f = fixture(t);
  const snapshot = time().toISOString();
  const body = { channel: 'messages', through: snapshot };
  assert.equal((await f.read(body)).status, 200);
  assert.equal(f.user.messagesReadAt.toISOString(), snapshot);
  assert.equal(f.user.notificationsReadAt, null);
  assert.equal((await f.read({ ...body, through: new Date(Date.parse(snapshot) - 1000).toISOString() })).body.data.readAt, snapshot);
  f.records.set(DailyReport, [{ _id: id(10), student: f.user.id, status: 'changes_requested', feedback: 'Old', reviewedAt: new Date(Date.parse(snapshot) - 1000), date: time(), submittedAt: time() },
    { _id: id(11), student: f.user.id, status: 'changes_requested', feedback: 'New', reviewedAt: new Date(Date.parse(snapshot) + 1000), date: time(), submittedAt: time() }]);
  const data = (await f.get()).body.data;
  assert.equal(data.unread.messages, 1);
  assert.equal(data.messages[0].read, false); assert.equal(data.messages[1].read, true);
  assert.ok(data.unread.notifications > 0);
  for (const invalid of [{}, { ...body, channel: '__proto__' }, { ...body, channel: 'all' }, { ...body, userId: id(2) },
    { ...body, through: new Date(Date.now() + 86400000).toISOString() }, { ...body, through: '2026-02-30T00:00:00.000Z' }, { ...body, through: 123 }]) {
    assert.equal((await f.read(invalid)).status, 400);
  }
});

test('recent channels are bounded, sorted and use stable event IDs while resubmission removes resolved feedback', async (t) => {
  const f = fixture(t);
  const rows = Array.from({ length: 35 }, (_, index) => ({ _id: id(index + 100), student: f.user.id, date: time(),
    status: 'changes_requested', feedback: `Feedback ${index}`, submittedAt: time(index), reviewedAt: time(index) }));
  f.records.set(DailyReport, rows);
  const first = (await f.get()).body.data;
  const second = (await f.get()).body.data;
  assert.equal(first.messages.length, 30); assert.equal(first.unread.messages, 30);
  assert.deepEqual(first.messages.map((entry) => entry.id), second.messages.map((entry) => entry.id));
  assert.ok(first.messages.every((entry, index, items) => index === 0 || entry.occurredAt <= items[index - 1].occurredAt));
  rows.forEach((row) => { row.status = 'submitted'; });
  assert.deepEqual((await f.get()).body.data.messages, []);
  assert.equal(User.schema.path('messagesReadAt').options.select, false);
  assert.equal(User.schema.path('notificationsReadAt').options.select, false);
});
