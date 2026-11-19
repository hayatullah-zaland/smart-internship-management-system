import mongoose from 'mongoose';

export const MAX_PROFILE_IMAGE_BYTES = 64 * 1024;

export function isValidProfileImage(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || value.length > 23 + 4 * Math.ceil(MAX_PROFILE_IMAGE_BYTES / 3)) return false;
  if (!/^data:image\/jpeg;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  const encoded = value.slice(23);
  const bytes = Buffer.from(encoded, 'base64');
  return bytes.length >= 5 && bytes.length <= MAX_PROFILE_IMAGE_BYTES && bytes.toString('base64') === encoded
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  // Photos are loaded only for the signed-in account, not user directories.
  profileImage: { type: String, default: '', select: false, validate: isValidProfileImage },
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
