import { User } from '../model/user.model.js';
import validator from 'validator';
import { StudentProfile } from '../model/student-profile.model.js';
import { Application } from '../model/application.model.js';
import { Internship } from '../model/internship.model.js';
import { Company } from '../model/company.model.js';
import { Opportunity } from '../model/opportunity.model.js';
import { DailyReport } from '../model/daily-report.model.js';
import { WeeklyReport } from '../model/weekly-report.model.js';
import { Evaluation } from '../model/evaluation.model.js';

export async function updateUser(req, res) {
  const { id } = req.params;
  let { name, email } = req.body || {};
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid user ID.' });
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({ success: false, message: 'Name must be between 2 and 100 characters.' });
  }
  if (typeof email !== 'string' || email.trim().length > 254 || !validator.isEmail(email.trim())) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }
  name = name.trim();
  email = email.trim().toLowerCase();
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user.role === 'admin') {
    return res.status(403).json({ success: false, message: 'Administrator accounts are protected. Use My account to edit your own details.' });
  }
  if (await User.exists({ email, _id: { $ne: user._id } })) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }
  // Changing a name or email must not change the user's role or academic history.
  user.name = name;
  user.email = email;
  await user.save();
  res.json({ success: true, message: 'User updated successfully.', data: { user: {
    id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive,
  } } });
}

async function hasUserRecords(id) {
  const references = [
    [StudentProfile, { user: id }],
    [Application, { $or: [{ student: id }, { reviewedBy: id }] }],
    [Internship, { $or: [{ student: id }, { supervisor: id }, { createdBy: id }] }],
    [Company, { $or: [{ representative: id }, { createdBy: id }] }],
    [Opportunity, { createdBy: id }],
    [DailyReport, { $or: [{ student: id }, { reviewedBy: id }] }],
    [WeeklyReport, { student: id }],
    [Evaluation, { $or: [{ student: id }, { evaluator: id }] }],
  ];
  for (const [model, filter] of references) {
    if (await model.exists(filter)) return true;
  }
  return false;
}

export async function deleteUser(req, res) {
  const { id } = req.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid user ID.' });
  }
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user.role === 'admin' || user.id === req.user.id) {
    return res.status(403).json({ success: false, message: 'Administrator accounts cannot be deleted.' });
  }
  if (user.isActive) {
    return res.status(409).json({ success: false, message: 'Deactivate this account before deleting it.' });
  }
  if (await hasUserRecords(id)) {
    return res.status(409).json({ success: false, message: 'This user has project records and cannot be deleted. Keep the account inactive to preserve its history.' });
  }
  // Recheck protected fields in the delete itself in case the account changed.
  const deleted = await User.findOneAndDelete({ _id: id, role: { $ne: 'admin' }, isActive: false });
  if (!deleted) {
    return res.status(409).json({ success: false, message: 'This account changed. Refresh users before trying again.' });
  }
  res.json({ success: true, message: 'User deleted successfully.', data: { userId: user.id } });
}

export async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body || {};

  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid user ID.' });
  }
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be true or false.' });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  // Keep administrator accounts available for managing the system.
  if (user.role === 'admin') {
    return res.status(403).json({ success: false, message: 'Administrator account status cannot be changed here.' });
  }

  user.isActive = isActive;
  await user.save();

  res.status(200).json({
    success: true,
    message: isActive ? 'Account activated successfully.' : 'Account deactivated successfully.',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    },
  });
}

export async function getUsers(req, res) {
  // Return a small page instead of loading every account at once.
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const role = req.query.role;
  if (role !== undefined && (typeof role !== 'string' || !User.schema.path('role').enumValues.includes(role))) {
    return res.status(400).json({ success: false, message: 'Choose a valid account role.' });
  }
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: 'Page must be between 1 and 1000000, and limit between 1 and 100. Use whole numbers.',
    });
  }

  const users = await User.find(role ? { role } : {})
    .select('name email role isActive createdAt')
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.status(200).json({ success: true, data: { users, page, limit } });
}
