import mongoose from 'mongoose';

const internshipSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  slot: { type: Number, required: true, min: 1, max: 1000, validate: Number.isInteger, select: false },
  status: { type: String, enum: ['assigned', 'active', 'completed', 'cancelled'], default: 'assigned' },
  statusHistory: {
    type: [{
      _id: false,
      from: { type: String, enum: ['assigned', 'active'], required: true },
      to: { type: String, enum: ['active', 'completed', 'cancelled'], required: true },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      changedAt: { type: Date, required: true },
      reason: { type: String, trim: true, maxlength: 1000, default: '' },
    }],
    default: [],
  },
}, { timestamps: true });

internshipSchema.index({ application: 1 }, { unique: true });
internshipSchema.index({ opportunity: 1, slot: 1 }, { unique: true });
internshipSchema.index({ student: 1 }, {
  unique: true,
  partialFilterExpression: { status: { $in: ['assigned', 'active'] } },
});

export const Internship = mongoose.model('Internship', internshipSchema);
