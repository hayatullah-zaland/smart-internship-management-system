import mongoose from 'mongoose';

const opportunitySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deadline: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1, max: 1000, validate: Number.isInteger },
  status: { type: String, enum: ['open', 'closed', 'archived'], default: 'open' },
}, { timestamps: true });

export const Opportunity = mongoose.model('Opportunity', opportunitySchema);
