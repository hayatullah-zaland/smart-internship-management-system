import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'withdrawn'],
    default: 'pending',
  },
}, { timestamps: true });

// The database also rejects simultaneous duplicate applications.
applicationSchema.index({ student: 1, opportunity: 1 }, { unique: true });

export const Application = mongoose.model('Application', applicationSchema);
