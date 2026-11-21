import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import companyRoutes from './routes/company.routes.js';
import opportunityRoutes from './routes/opportunity.routes.js';
import applicationRoutes from './routes/application.routes.js';
import internshipRoutes from './routes/internship.routes.js';
import dailyReportRoutes from './routes/daily-report.routes.js';
import weeklyReportRoutes from './routes/weekly-report.routes.js';
import departmentRoutes from './routes/department.routes.js';
import studentRoutes from './routes/student.routes.js';
import evaluationRoutes from './routes/evaluation.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import inboxRoutes from './routes/inbox.routes.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

export function createApp({
  production = process.env.NODE_ENV === 'production',
  clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  frontendDirectory = fileURLToPath(new URL('../frontend/dist', import.meta.url)),
} = {}) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: clientOrigin }));
  // A small account photo needs more space; other endpoints keep the 16 KB limit.
  app.use('/api/v1/auth/me', express.json({ limit: '100kb' }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/v1/health', (req, res) => {
    res.json({ success: true, message: 'SIMS backend is running.' });
  });
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/companies', companyRoutes);
  app.use('/api/v1/opportunities', opportunityRoutes);
  app.use('/api/v1/applications', applicationRoutes);
  app.use('/api/v1/internships', internshipRoutes);
  app.use('/api/v1/daily-reports', dailyReportRoutes);
  app.use('/api/v1/weekly-reports', weeklyReportRoutes);
  app.use('/api/v1/departments', departmentRoutes);
  app.use('/api/v1/students', studentRoutes);
  app.use('/api/v1/evaluations', evaluationRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/inbox', inboxRoutes);
  // Missing API routes must stay JSON 404s, not the React HTML page.
  app.use('/api', notFound);

  if (production) {
    const indexFile = join(frontendDirectory, 'index.html');
    if (!existsSync(indexFile)) throw new Error('Frontend build missing. Run npm run build in frontend first.');
    app.use(express.static(frontendDirectory, { index: false, dotfiles: 'ignore' }));
    app.get(/.*/, (req, res, next) => {
      if (!req.accepts('html') || extname(req.path) || req.path.split('/').some((part) => part.startsWith('.'))) return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexFile);
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
