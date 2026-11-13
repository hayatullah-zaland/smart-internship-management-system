import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import companyRoutes from './routes/company.routes.js';
import opportunityRoutes from './routes/opportunity.routes.js';
import applicationRoutes from './routes/application.routes.js';
import internshipRoutes from './routes/internship.routes.js';
import { User } from './model/user.model.js';
import { Application } from './model/application.model.js';
import { Internship } from './model/internship.model.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

// Load settings from the .env file.
dotenv.config({ path: new URL('./.env', import.meta.url) });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
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
app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB before starting the server.
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must have at least 32 characters');
    }
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await User.init(); // Wait for the unique email index.
    await Application.init(); // Wait for the duplicate-application index.
    await Internship.init(); // Enforce seat, application, and ongoing-student uniqueness.
    console.log('MongoDB connected successfully.');

    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    server.on('error', async () => {
      console.error('Cannot start the server. Check whether the port is already in use.');
      await mongoose.disconnect();
      process.exitCode = 1;
    });
  } catch {
    console.error('Startup failed. Check MONGODB_URI, JWT_SECRET, and MongoDB availability.');
    await mongoose.disconnect();
    process.exitCode = 1;
  }
}

startServer();
