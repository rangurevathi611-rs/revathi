import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { HttpError, asyncHandler } from '../http.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { recordAudit } from '../services/audit.js';
import { clearSessionCookie, hashToken, issueSession, toPublicUser } from '../services/authTokens.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});

const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name must be at least 2 characters').max(80),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Enter a valid email').max(120).transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email').transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Password is required').max(72),
});

async function uniqueSlug(name) {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'company';
  let slug = base;
  let suffix = 2;
  while (await Organization.exists({ slug })) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const existing = await User.findOne({ email: req.body.email });
    if (existing) {
      throw new HttpError(409, 'An account with that email already exists');
    }

    const organization = await Organization.create({
      name: req.body.companyName,
      slug: await uniqueSlug(req.body.companyName),
    });

    try {
      const user = await User.create({
        name: req.body.name,
        email: req.body.email,
        passwordHash: await bcrypt.hash(req.body.password, 12),
        organizationId: organization._id,
        role: 'owner',
      });
      const accessToken = await issueSession(user, res);
      await recordAudit(req, {
        action: 'login',
        actorId: user._id,
        organizationId: organization._id,
        meta: { email: user.email },
      });
      res.status(201).json({ accessToken, user: await toPublicUser(user) });
    } catch (err) {
      if (!res.headersSent) {
        await User.deleteOne({ email: req.body.email, organizationId: organization._id });
        await organization.deleteOne();
      }
      throw err;
    }
  })
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    const matches = user ? await bcrypt.compare(req.body.password, user.passwordHash) : false;
    if (!user || !matches || !user.active) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const accessToken = await issueSession(user, res);
    await recordAudit(req, {
      action: 'login',
      actorId: user._id,
      organizationId: user.organizationId,
      meta: { email: user.email },
    });
    res.json({ accessToken, user: await toPublicUser(user) });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) throw new HttpError(401, 'Sign in required');

    let payload;
    try {
      payload = jwt.verify(token, config.jwtRefreshSecret);
    } catch {
      clearSessionCookie(res);
      throw new HttpError(401, 'Sign in required');
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.active || !user.refreshTokenHash) {
      clearSessionCookie(res);
      throw new HttpError(401, 'Sign in required');
    }

    const presented = Buffer.from(hashToken(token));
    const stored = Buffer.from(user.refreshTokenHash);
    const mismatch = presented.length !== stored.length || !crypto.timingSafeEqual(presented, stored);
    if (mismatch) {
      clearSessionCookie(res);
      throw new HttpError(401, 'Sign in required');
    }

    const accessToken = jwt.sign({ sub: user._id.toString() }, config.jwtSecret, {
      expiresIn: config.accessTtl,
    });
    res.json({ accessToken, user: await toPublicUser(user) });
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.user.id }, { $set: { refreshTokenHash: null } });
    clearSessionCookie(res);
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ user: await toPublicUser(user) });
  })
);

export default router;
