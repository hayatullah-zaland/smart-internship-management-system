import jwt from 'jsonwebtoken';
import { User } from '../model/user.model.js';

export async function requireAuth(req, res, next) {
  // Postman sends the token as: Authorization: Bearer YOUR_TOKEN
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Please sign in first.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(authorization.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please sign in again.' });
  }

  if (typeof decoded.sub !== 'string' || !/^[a-f0-9]{24}$/i.test(decoded.sub)) {
    return res.status(401).json({ success: false, message: 'Invalid account token.' });
  }
  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Your account is unavailable.' });
  }
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Only administrators can create role-based accounts.' });
  }

  next();
}
