import { User } from '../model/user.model.js';

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
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: 'Page must be between 1 and 1000000, and limit between 1 and 100. Use whole numbers.',
    });
  }

  const users = await User.find()
    .select('name email role isActive createdAt')
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.status(200).json({ success: true, data: { users, page, limit } });
}
