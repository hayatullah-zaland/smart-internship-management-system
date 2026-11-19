import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import authRoutes from '../routes/auth.routes.js';
import { User, isValidProfileImage, MAX_PROFILE_IMAGE_BYTES } from '../model/user.model.js';
import { errorHandler } from '../middleware/error.middleware.js';

const id = '507f1f77bcf86cd799439011';
const photo = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 224, 0, 2, 255, 217]).toString('base64');

function setup(t, role = 'student') {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'account-profile-isolated-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const user = new User({ _id: id, name: 'Test Account', email: 'account@example.com', passwordHash: 'private-hash', role, profileImage: photo });
  const context = { user, saves: 0, duplicate: false, missing: false };
  t.mock.method(User, 'findById', (requestedId) => {
    assert.equal(requestedId, id);
    return {
      then(resolve) { resolve(context.missing ? null : user); },
      async select(fields) { assert.equal(fields, '+profileImage'); return context.missing ? null : user; },
    };
  });
  t.mock.method(User, 'exists', async (filter) => {
    assert.deepEqual(filter._id, { $ne: user._id });
    return context.duplicate;
  });
  t.mock.method(user, 'save', async () => { await user.validate(); context.saves++; return user; });
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: id });
  const app = express();
  app.use('/auth/me', express.json({ limit: '100kb' }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/auth', authRoutes);
  app.use(errorHandler);
  context.call = (method, body) => request(app)[method]('/auth/me').auth(token, { type: 'bearer' }).send(body);
  context.app = app;
  return context;
}

test('account photos are optional, bounded JPEG data, not URLs or active image types', async () => {
  assert.equal(isValidProfileImage(''), true);
  assert.equal(isValidProfileImage(photo), true);
  for (const invalid of [null, {}, 12, 'https://example.com/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/jpeg;base64,', 'data:image/jpeg;base64,YWJjZA==', photo + '\n', photo + '!',
    'data:image/jpeg;base64,' + Buffer.alloc(MAX_PROFILE_IMAGE_BYTES + 1).toString('base64')]) {
    assert.equal(isValidProfileImage(invalid), false);
  }
  assert.equal(User.schema.path('profileImage').options.select, false);
  await new User({ name: 'Old Account', email: 'old@example.com', passwordHash: 'hash' }).validate();
});

test('all roles can read and edit only their own name, email and photo', async (t) => {
  for (const role of ['student', 'admin', 'academic_supervisor', 'company_representative']) {
    await t.test(role, async (t) => {
      const c = setup(t, role);
      const loaded = await c.call('get');
      assert.equal(loaded.status, 200);
      assert.equal(loaded.body.data.user.profileImage, photo);
      assert.equal(loaded.body.data.user.passwordHash, undefined);
      const updated = await c.call('patch', { name: ' Updated Account ', email: ' UPDATED@example.com ', profileImage: '',
        id: '507f1f77bcf86cd799439099', role: 'admin', isActive: false, passwordHash: 'changed' });
      assert.equal(updated.status, 200);
      assert.deepEqual(updated.body.data.user, { id, name: 'Updated Account', email: 'updated@example.com', role, isActive: true, profileImage: '' });
      assert.equal(c.user.passwordHash, 'private-hash');
      assert.equal(c.saves, 1);
      assert.equal((await c.call('get')).body.data.user.profileImage, '');
    });
  }
});

test('partial name/email changes preserve the photo and photo-only changes preserve account details', async (t) => {
  const c = setup(t);
  assert.equal((await c.call('patch', { name: 'New Name' })).body.data.user.profileImage, photo);
  assert.equal((await c.call('patch', { profileImage: '' })).status, 200);
  assert.equal((await c.call('patch', { profileImage: photo })).body.data.user.profileImage, photo);
  assert.equal(c.user.name, 'New Name');
  assert.equal(c.user.email, 'account@example.com');
});

test('invalid fields and duplicate email never write an account', async (t) => {
  const c = setup(t);
  for (const body of [{}, { role: 'admin' }, { name: 'x' }, { name: 'x'.repeat(101) }, { email: 'bad' },
    { email: {} }, { profileImage: null }, { profileImage: 'data:image/svg+xml;base64,PHN2Zz4=' },
    { name: 'Changed Name', profileImage: 'not-a-photo' }]) {
    assert.equal((await c.call('patch', body)).status, 400);
  }
  c.duplicate = true;
  assert.equal((await c.call('patch', { email: 'taken@example.com', profileImage: '' })).status, 409);
  assert.equal(c.saves, 0);
  assert.equal(c.user.profileImage, photo);
  assert.equal(c.user.name, 'Test Account');
});

test('profile reads and writes require an active authenticated account and cap JSON size', async (t) => {
  const c = setup(t);
  assert.equal((await request(c.app).get('/auth/me')).status, 401);
  assert.equal((await request(c.app).patch('/auth/me').send({ name: 'Changed' })).status, 401);
  c.user.isActive = false;
  assert.equal((await c.call('patch', { name: 'Changed' })).status, 401);
  c.user.isActive = true;
  c.missing = true;
  assert.equal((await c.call('get')).status, 401);
  c.missing = false;
  assert.equal((await c.call('patch', { profileImage: 'x'.repeat(110 * 1024) })).status, 413);
  assert.equal((await request(c.app).post('/auth/signup').send({ extra: 'x'.repeat(17 * 1024) })).status, 413);
  assert.equal(c.saves, 0);
});

test('the full 64 KB photo fits the profile parser without expanding other endpoints', async (t) => {
  const c = setup(t);
  const bytes = Buffer.alloc(MAX_PROFILE_IMAGE_BYTES);
  bytes.set([255, 216, 255]);
  bytes.set([255, 217], bytes.length - 2);
  const largePhoto = 'data:image/jpeg;base64,' + bytes.toString('base64');
  assert.equal(isValidProfileImage(largePhoto), true);
  const response = await c.call('patch', { profileImage: largePhoto });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.profileImage, largePhoto);
});

test('a saved photo is returned on subsequent sign-in without exposing the hash', async (t) => {
  const c = setup(t);
  t.mock.method(User, 'findOne', (filter) => {
    assert.deepEqual(filter, { email: c.user.email });
    return { async select(fields) { assert.equal(fields, '+passwordHash +profileImage'); return c.user; } };
  });
  t.mock.method(bcrypt, 'compare', async () => true);
  const result = await request(c.app).post('/auth/signin').send({ email: c.user.email, password: 'Test-password-123' });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.user.profileImage, photo);
  assert.equal(result.body.data.user.passwordHash, undefined);
});
