import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../app.js';

test('the complete app preserves JSON API errors, security headers and body limits without a database', async () => {
  const app = createApp({ production: false, clientOrigin: 'https://portal.example.test' });
  const health = await request(app).get('/api/v1/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.success, true);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-powered-by'], undefined);
  assert.equal(health.headers['access-control-allow-origin'], 'https://portal.example.test');
  for (const path of ['/api', '/api/v1/missing', '/login']) {
    const response = await request(app).get(path).set('Accept', 'text/html');
    assert.equal(response.status, 404);
    assert.match(response.headers['content-type'], /application\/json/);
  }
  for (const path of ['/users', '/applications', '/daily-reports', '/weekly-reports', '/inbox']) {
    assert.equal((await request(app).get('/api/v1' + path)).status, 401);
  }
  const invalid = await request(app).post('/api/v1/auth/signin').set('Content-Type', 'application/json').send('{');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.message, 'Request body must be valid JSON.');
  const oversized = await request(app).post('/api/v1/auth/signin').send({ password: 'a'.repeat(17000) });
  assert.equal(oversized.status, 413);
  const profile = await request(app).patch('/api/v1/auth/me').send({ profileImage: 'a'.repeat(17000) });
  assert.equal(profile.status, 401);
  assert.equal((await request(app).patch('/api/v1/auth/me').send({ profileImage: 'a'.repeat(110000) })).status, 413);
});

test('production serves built assets and refreshed React routes without exposing API fallbacks or source files', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'sims-production-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  const html = '<!doctype html><html><body><div id="root">SIMS production fixture</div></body></html>';
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'assets', 'app.js'), 'console.log("SIMS asset");');
  await writeFile(join(directory, '.env'), 'DO_NOT_EXPOSE_THIS_FILE');
  const app = createApp({ production: true, frontendDirectory: directory });
  for (const path of ['/', '/login', '/dashboard', '/admin/applications', '/settings?theme=dark']) {
    const response = await request(app).get(path).set('Accept', 'text/html');
    assert.equal(response.status, 200, path);
    assert.match(response.headers['content-type'], /text\/html/);
    assert.equal(response.headers['cache-control'], 'no-cache');
    assert.equal(response.text, html);
  }
  assert.equal((await request(app).head('/dashboard').set('Accept', 'text/html')).status, 200);
  const asset = await request(app).get('/assets/app.js');
  assert.equal(asset.status, 200);
  assert.equal(asset.text, 'console.log("SIMS asset");');
  for (const path of ['/api', '/api/v1/missing', '/assets/missing.js', '/src/main.jsx', '/.env', '/.git/config']) {
    const response = await request(app).get(path).set('Accept', 'text/html');
    assert.equal(response.status, 404, path);
    assert.match(response.headers['content-type'], /application\/json/);
    assert.doesNotMatch(response.text, /SIMS production fixture|DO_NOT_EXPOSE/);
  }
  assert.equal((await request(app).get('/dashboard').set('Accept', 'application/json')).status, 404);
  assert.equal((await request(app).post('/dashboard')).status, 404);
  assert.equal((await request(app).get('/api/v1/health')).body.success, true);
  assert.equal((await request(app).get('/api/v1/users')).status, 401);
});

test('production refuses to start without a frontend build, while API-only development does not need one', () => {
  const frontendDirectory = join(tmpdir(), 'sims-missing-build-' + process.pid);
  assert.throws(() => createApp({ production: true, frontendDirectory }), /Frontend build missing/);
  assert.doesNotThrow(() => createApp({ production: false, frontendDirectory }));
});
