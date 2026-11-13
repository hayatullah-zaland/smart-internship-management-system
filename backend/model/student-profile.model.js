import mongoose from 'mongoose';

const studentProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  studentNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 30, unique: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  semester: { type: Number, required: true, min: 1, max: 12, validate: Number.isInteger },
  phone: { type: String, required: true, trim: true, maxlength: 25 },
}, { timestamps: true });

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
