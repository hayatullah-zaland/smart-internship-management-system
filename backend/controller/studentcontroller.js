import { StudentProfile } from '../model/student-profile.model.js';
import { Department } from '../model/department.model.js';

export async function saveStudentProfile(req, res) {
  const { studentNumber, departmentId, semester, phone } = req.body || {};
  if (typeof studentNumber !== 'string' || !/^[a-z0-9-]{1,30}$/i.test(studentNumber.trim()) ||
      typeof departmentId !== 'string' || !/^[a-f0-9]{24}$/i.test(departmentId) ||
      !Number.isInteger(semester) || semester < 1 || semester > 12 ||
      typeof phone !== 'string' || !/^[+0-9 ()-]{7,25}$/.test(phone.trim()) ||
      phone.replace(/\D/g, '').length < 7) {
    return res.status(400).json({ success: false, message: 'Provide a student number, valid department ID, semester (1-12), and phone number (7-25 characters).' });
  }
  if (!await Department.exists({ _id: departmentId })) {
    return res.status(404).json({ success: false, message: 'Department not found.' });
  }
  try {
    // Only the authenticated student's academic profile is written.
    const profile = await StudentProfile.findOneAndUpdate(
      { user: req.user.id },
      { $set: { studentNumber: studentNumber.trim().toUpperCase(), department: departmentId, semester, phone: phone.trim() } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.json({ success: true, message: 'Student profile saved.', data: { profile } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This student number is already registered or the profile changed. Please check and retry.' });
    throw error;
  }
}

export async function getStudentProfile(req, res) {
  const profile = await StudentProfile.findOne({ user: req.user.id }).populate('department', 'name code');
  if (!profile) return res.status(404).json({ success: false, message: 'Complete your student profile first.' });
  res.json({ success: true, data: { profile } });
}

export async function getStudents(req, res) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'Use valid page and limit values (limit: 1-100).' });
  }
  const profiles = await StudentProfile.find().populate('user', 'name email isActive')
    .populate('department', 'name code').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
  res.json({ success: true, data: { profiles, page, limit } });
}
