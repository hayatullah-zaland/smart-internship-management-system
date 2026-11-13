import mongoose from 'mongoose';

const dailyReportSchema = new mongoose.Schema({
  internship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  hours: { type: Number, required: true, min: 0.25, max: 24 },
  tasks: { type: String, required: true, trim: true, maxlength: 5000 },
  learning: { type: String, required: true, trim: true, maxlength: 3000 },
  challenges: { type: String, trim: true, maxlength: 2000, default: '' },
  status: { type: String, enum: ['draft', 'submitted', 'approved', 'changes_requested'], default: 'draft' },
  submittedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  feedback: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true });

dailyReportSchema.index({ internship: 1, date: 1 }, { unique: true });

export const DailyReport = mongoose.model('DailyReport', dailyReportSchema);
