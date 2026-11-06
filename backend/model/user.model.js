import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['student', 'admin', 'academic_supervisor', 'company_representative'],
    default: 'student',
  },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  toJSON: { transform(_doc, result) { delete result.passwordHash; delete result.__v; return result; } },
});

export const User = mongoose.model('User', userSchema);
