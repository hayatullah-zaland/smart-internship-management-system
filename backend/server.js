import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { User } from './model/user.model.js';
import { Application } from './model/application.model.js';
import { Internship } from './model/internship.model.js';
import { DailyReport } from './model/daily-report.model.js';
import { WeeklyReport } from './model/weekly-report.model.js';
import { Department } from './model/department.model.js';
import { StudentProfile } from './model/student-profile.model.js';
import { Evaluation } from './model/evaluation.model.js';

// Load settings from the .env file.
dotenv.config({ path: new URL('./.env', import.meta.url) });

// Connect to MongoDB before starting the server.
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must have at least 32 characters');
    }
    const port = Number(process.env.PORT || 5000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
    const app = createApp();
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await User.init(); // Wait for the unique email index.
    await Application.init(); // Wait for the duplicate-application index.
    // Backfill the simple ongoing flag on placements created before this field existed.
    await Internship.updateMany(
      { isOngoing: { $exists: false }, status: { $in: ['assigned', 'active'] } },
      { $set: { isOngoing: true } },
    );
    await Internship.updateMany(
      { isOngoing: { $exists: false }, status: { $in: ['completed', 'cancelled'] } },
      { $set: { isOngoing: false } },
    );
    await Internship.init(); // Enforce seat, application, and ongoing-student uniqueness.
    await DailyReport.init(); // One daily report per internship and calendar date.
    await WeeklyReport.init(); // One weekly report per internship and week number.
    await Department.init();
    await StudentProfile.init();
    await Evaluation.init();
    console.log('MongoDB connected successfully.');

    const server = app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
    server.on('error', async () => {
      console.error('Cannot start the server. Check whether the port is already in use.');
      await mongoose.disconnect();
      process.exitCode = 1;
    });
    async function shutdown() {
      server.close(async () => {
        await mongoose.disconnect();
      });
      setTimeout(() => process.exit(1), 10000).unref();
    }
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch {
    console.error('Startup failed. Check MONGODB_URI, JWT_SECRET, PORT, MongoDB availability, and the production frontend build.');
    await mongoose.disconnect();
    process.exitCode = 1;
  }
}

startServer();
