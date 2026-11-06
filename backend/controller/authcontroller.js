import bcrypt from 'bcrypt';
import validator from 'validator';
import { User } from '../model/user.model.js';

export async function signup(req, res) {
  // 1. Get and check the form fields.
  let { name, email, password } = req.body || {};

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required and must be text.' });
  }

  name = name.trim();
  email = email.trim().toLowerCase();

  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ success: false, message: 'Name must be between 2 and 100 characters.' });
  }
  if (email.length > 254 || !validator.isEmail(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({
      success: false,
      message: 'Password must have at least 8 characters and must not exceed 72 UTF-8 bytes.',
    });
  }

  // 2. Check whether the email is already registered.
  const existingUser = await User.exists({ email });
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }
  // 3. Hash the password and save a student account.
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: 'student' });

  // 4. Send the account details without the password.
  res.status(201).json({
    success: true,
    message: 'Account created successfully.',
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
