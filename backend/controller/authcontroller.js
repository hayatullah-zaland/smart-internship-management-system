import bcrypt from 'bcrypt';
import validator from 'validator';
import jwt from 'jsonwebtoken';
import { User, isValidProfileImage } from '../model/user.model.js';

export async function getProfile(req, res) {
  const user = await User.findById(req.user.id).select('+profileImage');
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Your account is unavailable.' });
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        profileImage: user.profileImage || '',
      },
    },
  });
}

export async function updateProfile(req, res) {
  // Accept only editable fields belonging to the authenticated account.
  let { name, email, profileImage } = req.body || {};
  if (name === undefined && email === undefined && profileImage === undefined) {
    return res.status(400).json({ success: false, message: 'Please provide a name, email or profile photo to update.' });
  }
  if (profileImage !== undefined && !isValidProfileImage(profileImage)) {
    return res.status(400).json({ success: false, message: 'Profile photo must be a JPEG image up to 64 KB, or empty to remove it.' });
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Name must be between 2 and 100 characters.' });
    }
    name = name.trim();
  }

  if (email !== undefined) {
    if (typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    email = email.trim().toLowerCase();
    if (email.length > 254 || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // 2. Allow the current email, but not another account's email.
    const existingUser = await User.exists({ email, _id: { $ne: req.user._id } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
  }

  const user = await User.findById(req.user.id).select('+profileImage');
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Your account is unavailable.' });
  }
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (profileImage !== undefined) user.profileImage = profileImage;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully.',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        profileImage: user.profileImage || '',
      },
    },
  });
}

export async function changePassword(req, res) {
  // 1. Check both passwords before accessing the database.
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ success: false, message: 'Current and new passwords are required and must be text.' });
  }
  if (!currentPassword || Buffer.byteLength(currentPassword, 'utf8') > 72) {
    return res.status(400).json({ success: false, message: 'Please enter a valid current password.' });
  }
  if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({
      success: false,
      message: 'New password must have at least 8 characters and must not exceed 72 UTF-8 bytes.',
    });
  }

  // 2. Load the hidden password hash for the signed-in account only.
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Your account is unavailable.' });
  }
  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
  }

  // 3. Save only the hash, never the plain-text password.
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.status(200).json({ success: true, message: 'Password changed successfully.' });
}

export async function signup(req, res) {
  // 1. Get and check the form fields.
  let { name, email, password } = req.body || {};

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required and must be text.' });
  }

  name = name.trim();
  email = email.trim().toLowerCase();

  // Public sign-up creates students. An authenticated admin may choose any role.
  const role = req.user?.role === 'admin' ? (req.body.role || 'student') : 'student';
  const roles = ['student', 'admin', 'academic_supervisor', 'company_representative'];
  if (!roles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Please choose a valid user role.' });
  }

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
  // 3. Hash the password and save the account.
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role });

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

export async function signin(req, res) {
  // 1. Check the email and password.
  let { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Email and password are required and must be text.' });
  }

  email = email.trim().toLowerCase();
  if (!validator.isEmail(email) || email.length > 254 || !password || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email and password.' });
  }

  // 2. Find the account, including its normally hidden password hash.
  const user = await User.findOne({ email }).select('+passwordHash +profileImage');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
  }

  // 3. Compare the password with the saved hash.
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Your account is deactivated.' });
  }

  // 4. Create a short-lived token for any of the four user roles.
  const token = jwt.sign({ role: user.role }, process.env.JWT_SECRET, {
    subject: user.id,
    expiresIn: '15m',
    algorithm: 'HS256',
  });

  res.status(200).json({
    success: true,
    message: 'Signed in successfully.',
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        profileImage: user.profileImage || '',
      },
    },
  });
}
