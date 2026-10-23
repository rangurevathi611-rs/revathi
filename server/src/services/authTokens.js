import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { Organization } from '../models/Organization.js';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: config.refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}

export async function issueSession(user, res) {
  const accessToken = jwt.sign({ sub: user._id.toString() }, config.jwtSecret, {
    expiresIn: config.accessTtl,
  });
  const refreshToken = jwt.sign({ sub: user._id.toString() }, config.jwtRefreshSecret, {
    expiresIn: `${config.refreshTtlDays}d`,
  });
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  res.cookie('refreshToken', refreshToken, cookieOptions());
  return accessToken;
}

export function clearSessionCookie(res) {
  res.clearCookie('refreshToken', { path: '/api/auth' });
}

export async function toPublicUser(user) {
  let org = user.organizationId;
  if (!org || !org.name) {
    org = await Organization.findById(user.organizationId);
  }
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: {
      id: org._id,
      name: org.name,
      slug: org.slug,
    },
  };
}
