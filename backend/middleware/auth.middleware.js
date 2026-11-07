import jwt from 'jsonwebtoken';
import { User } from '../model/user.model.js';

export async function requireAuth(req, res, next) {
  // 1. Read the Authorization header sent by Postman.
  // Example: Bearer eyJhbGci...
  const authorization = req.headers.authorization || '';
  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme.toLowerCase() !== 'bearer' || !token || extra) {
    return res.status(401).json({ success: false, message: 'Please sign in first.' });
  }

  // 2. Check the token's signature and expiry date.
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please sign in again.' });
  }

  // Our sign-in code stores the user's database ID in decoded.sub.
  if (typeof decoded.sub !== 'string' || !/^[a-f0-9]{24}$/i.test(decoded.sub)) {
    return res.status(401).json({ success: false, message: 'Invalid account token.' });
  }

  // 3. Find the account and check that it is still active.
  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Your account is unavailable.' });
  }

  // 4. Save the user on the request so the next function can use it.
  req.user = user;
  // Continue to the route's next function.
  next();
}

// Already used by the create-user route. We can study this part later.
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Please sign in first.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only administrators can create role-based accounts.',
    });
  }

  next();
}
