import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  contactEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const Company = mongoose.model('Company', companySchema);
