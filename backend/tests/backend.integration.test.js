import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';
import authRoutes from '../routes/auth.routes.js';
import companyRoutes from '../routes/company.routes.js';
import opportunityRoutes from '../routes/opportunity.routes.js';
import applicationRoutes from '../routes/application.routes.js';
import internshipRoutes from '../routes/internship.routes.js';
import departmentRoutes from '../routes/department.routes.js';
import studentRoutes from '../routes/student.routes.js';
import evaluationRoutes from '../routes/evaluation.routes.js';
import dashboardRoutes from '../routes/dashboard.routes.js';
import { User } from '../model/user.model.js';
import { Company } from '../model/company.model.js';
import { Opportunity } from '../model/opportunity.model.js';
import { Application } from '../model/application.model.js';
import { Internship } from '../model/internship.model.js';
import { Department } from '../model/department.model.js';
import { StudentProfile } from '../model/student-profile.model.js';
import { Evaluation } from '../model/evaluation.model.js';
import { DailyReport } from '../model/daily-report.model.js';
import { WeeklyReport } from '../model/weekly-report.model.js';
import { errorHandler } from '../middleware/error.middleware.js';

test('real MongoDB: department, profile, application, placement, evaluation and dashboard', {
  skip: process.env.SIMS_INTEGRATION_TEST !== '1', timeout: 60000,
}, async () => {
  dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
  assert.ok(process.env.MONGODB_URI, 'Configure MONGODB_URI to run the integration test.');
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-integration-test-secret-only';
  // Never write fixtures to the configured application database.
  const databaseName = `sims_test_${randomUUID().replaceAll('-', '')}`;
  let connected = false;
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: databaseName, serverSelectionTimeoutMS: 5000 });
    connected = true;
    for (const model of [User, Company, Opportunity, Application, Internship, Department, StudentProfile, Evaluation, DailyReport, WeeklyReport]) {
      await model.init();
    }
    const app = express(); app.use(express.json());
    app.use('/auth', authRoutes); app.use('/companies', companyRoutes);
    app.use('/opportunities', opportunityRoutes); app.use('/applications', applicationRoutes);
    app.use('/internships', internshipRoutes); app.use('/departments', departmentRoutes);
    app.use('/students', studentRoutes); app.use('/evaluations', evaluationRoutes);
    app.use('/dashboard', dashboardRoutes); app.use(errorHandler);
    const password = 'IntegrationPassword123!';
    const passwordHash = await bcrypt.hash(password, 4);
    const tokens = {};
    for (const role of ['admin', 'student', 'academic_supervisor', 'company_representative']) {
      await User.create({ name: role, email: `${role}@example.com`, passwordHash, role });
      const login = await request(app).post('/auth/signin').send({ email: `${role}@example.com`, password });
      assert.equal(login.status, 200);
      tokens[role] = login.body.data.token;
    }
    const call = (role, method, path, body) => request(app)[method](path).auth(tokens[role], { type: 'bearer' }).send(body);
    const department = await call('admin', 'post', '/departments', { name: 'Computer Science', code: 'CS' });
    assert.equal(department.status, 201);
    const profileBody = { studentNumber: 'STU-1', departmentId: department.body.data.department._id, semester: 7, phone: '+93700123456' };
    assert.equal((await call('student', 'put', '/students/me', profileBody)).status, 200);
    const studentProfile = await call('student', 'get', '/students/me');
    assert.equal(studentProfile.body.data.profile.department.code, 'CS');
    assert.equal((await call('student', 'post', '/departments', { name: 'Wrong', code: 'NO' })).status, 403);
    assert.equal((await call('admin', 'post', '/departments', { name: 'Duplicate', code: 'cs' })).status, 409);
    const representative = await User.findOne({ role: 'company_representative' });
    const supervisor = await User.findOne({ role: 'academic_supervisor' });
    const company = await call('admin', 'post', '/companies', { name: 'Test Company', address: 'Kabul', contactEmail: 'hr@example.com' });
    assert.equal(company.status, 201);
    const companyId = company.body.data.company._id;
    assert.equal((await call('admin', 'patch', `/companies/${companyId}/representative`, { representativeId: representative.id })).status, 200);
    const opportunity = await call('company_representative', 'post', '/opportunities', {
      title: 'Test Internship', description: 'Learn development', companyId,
      deadline: new Date(Date.now() + 86400000).toISOString(), capacity: 1,
    });
    assert.equal(opportunity.status, 201);
    const opportunityId = opportunity.body.data.opportunity._id;
    const application = await call('student', 'post', '/applications', { opportunityId });
    assert.equal(application.status, 201);
    assert.equal((await call('student', 'post', '/applications', { opportunityId })).status, 409);
    const applicationId = application.body.data.application._id;
    assert.equal((await call('admin', 'patch', `/applications/${applicationId}/decision`, { status: 'approved' })).status, 200);
    const placement = await call('admin', 'post', '/internships', {
      applicationId, supervisorId: supervisor.id,
      startDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    });
    assert.equal(placement.status, 201);
    const placementId = placement.body.data.internship._id;
    const storedPlacement = await Internship.findById(placementId);
    assert.equal(storedPlacement.isOngoing, true);
    // Verify the actual database index, not just controller-level checks.
    await assert.rejects(Internship.create({
      application: new mongoose.Types.ObjectId(), student: storedPlacement.student,
      opportunity: new mongoose.Types.ObjectId(), company: storedPlacement.company,
      supervisor: supervisor._id, createdBy: storedPlacement.createdBy,
      startDate: storedPlacement.startDate, endDate: storedPlacement.endDate, slot: 1,
    }), (error) => error.code === 11000 && error.keyPattern?.student === 1);
    assert.equal((await call('admin', 'patch', `/internships/${placementId}/status`, { status: 'active' })).status, 200);
    assert.equal((await call('academic_supervisor', 'post', '/evaluations', { internshipId: placementId, score: 80, comments: 'Early' })).status, 409);
    assert.equal((await call('admin', 'patch', `/internships/${placementId}/status`, { status: 'completed' })).status, 200);
    assert.equal((await Internship.findById(placementId)).isOngoing, false);
    for (const role of ['academic_supervisor', 'company_representative']) {
      const evaluation = { internshipId: placementId, score: 85, comments: 'Good progress.' };
      assert.equal((await call(role, 'post', '/evaluations', evaluation)).status, 201);
      assert.equal((await call(role, 'post', '/evaluations', evaluation)).status, 409);
    }
    const grades = await call('student', 'get', '/evaluations');
    assert.equal(grades.body.data.evaluations.length, 2);
    assert.equal(grades.body.data.evaluations[0].student.passwordHash, undefined);
    const stats = await call('admin', 'get', '/dashboard/stats');
    assert.equal(stats.status, 200);
    assert.equal(stats.body.data.stats.departments, 1);
    assert.equal(stats.body.data.stats.completedInternships, 1);
    console.log('Isolated real MongoDB API workflow passed; application database was not modified.');
  } finally {
    try {
      // Drop only this run's generated scratch database, never the application DB.
      if (connected) {
        assert.equal(mongoose.connection.name, databaseName);
        assert.match(databaseName, /^sims_test_[a-f0-9]{32}$/);
        await mongoose.connection.db.dropDatabase();
      }
    } finally {
      await mongoose.disconnect();
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  }
});
