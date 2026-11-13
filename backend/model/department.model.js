import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20, unique: true },
}, { timestamps: true });

export const Department = mongoose.model('Department', departmentSchema);
