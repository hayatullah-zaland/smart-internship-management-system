import mongoose from 'mongoose';

const weeklyReportSchema = new mongoose.Schema({
  internship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weekNumber: { type: Number, required: true, min: 1, max: 10000, validate: Number.isInteger },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  summary: { type: String, required: true, trim: true, maxlength: 5000 },
  learning: { type: String, required: true, trim: true, maxlength: 3000 },
  challenges: { type: String, trim: true, maxlength: 2000, default: '' },
  status: { type: String, enum: ['draft'], default: 'draft' },
}, { timestamps: true });

weeklyReportSchema.index({ internship: 1, weekNumber: 1 }, { unique: true });

export const WeeklyReport = mongoose.model('WeeklyReport', weeklyReportSchema);
