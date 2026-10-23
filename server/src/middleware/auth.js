import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';

export async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub).populate('organizationId');
    if (!user || !user.active || !user.organizationId || !user.organizationId.name) {
      return res.status(401).json({ error: 'Sign in required' });
    }
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId._id,
      organization: {
        id: user.organizationId._id,
        name: user.organizationId.name,
        slug: user.organizationId.slug,
      },
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Sign in required' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission for this action' });
    }
    next();
  };
}
