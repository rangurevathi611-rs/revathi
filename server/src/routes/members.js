import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { HttpError, asyncHandler } from '../http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { canEditMember, isManager } from '../services/access.js';
import { recordAudit } from '../services/audit.js';
import { isObjectId, serializeUser } from '../serializers.js';

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Enter a valid email').max(120).transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  role: z.enum(['admin', 'member', 'viewer']),
});

const updateSchema = z
  .object({
    role: z.enum(['admin', 'member', 'viewer']).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.active !== undefined, {
    message: 'Nothing to update',
  });

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'viewer') {
      throw new HttpError(403, 'You do not have permission for this action');
    }
    const filter = { organizationId: req.user.organizationId };
    const includeInactive = isManager(req.user) && req.query.includeInactive === '1';
    if (!includeInactive) filter.active = true;

    const users = await User.find(filter).sort({ name: 1 });
    const rank = { owner: 0, admin: 1, member: 2, viewer: 3 };
    users.sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));
    res.json({ members: users.map(serializeUser) });
  })
);

router.post(
  '/',
  requireRole('owner', 'admin'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (req.body.role === 'admin' && req.user.role !== 'owner') {
      throw new HttpError(403, 'Only the owner can appoint an admin');
    }

    const existing = await User.findOne({ email: req.body.email });
    if (existing) {
      throw new HttpError(409, 'An account with that email already exists');
    }

    const member = await User.create({
      name: req.body.name,
      email: req.body.email,
      passwordHash: await bcrypt.hash(req.body.password, 12),
      organizationId: req.user.organizationId,
      role: req.body.role,
    });

    await recordAudit(req, {
      action: 'role_change',
      meta: {
        event: 'added',
        name: member.name,
        email: member.email,
        role: member.role,
      },
    });

    res.status(201).json({ member: serializeUser(member) });
  })
);

router.patch(
  '/:id',
  requireRole('owner', 'admin'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) throw new HttpError(404, 'Member not found');
    const member = await User.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!member) throw new HttpError(404, 'Member not found');
    if (!canEditMember(req.user, member)) {
      throw new HttpError(403, 'You cannot change this member');
    }
    if (req.body.role === 'admin' && req.user.role !== 'owner') {
      throw new HttpError(403, 'Only the owner can appoint an admin');
    }

    const previousRole = member.role;
    const wasActive = member.active;
    if (req.body.role) member.role = req.body.role;
    if (req.body.active !== undefined) member.active = req.body.active;
    if (!member.active) member.refreshTokenHash = null;
    await member.save();

    if (req.body.role && req.body.role !== previousRole) {
      await recordAudit(req, {
        action: 'role_change',
        meta: {
          event: 'role',
          name: member.name,
          email: member.email,
          from: previousRole,
          to: member.role,
        },
      });
    }

    if (req.body.active !== undefined && req.body.active !== wasActive) {
      await recordAudit(req, {
        action: 'role_change',
        meta: {
          event: member.active ? 'reactivated' : 'deactivated',
          name: member.name,
          email: member.email,
          role: member.role,
        },
      });
    }

    res.json({ member: serializeUser(member) });
  })
);

router.delete(
  '/:id',
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) throw new HttpError(404, 'Member not found');
    const member = await User.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!member) throw new HttpError(404, 'Member not found');
    if (!canEditMember(req.user, member)) {
      throw new HttpError(403, 'You cannot remove this member');
    }
    if (!member.active) throw new HttpError(400, 'This member is already deactivated');

    member.active = false;
    member.refreshTokenHash = null;
    await member.save();

    await recordAudit(req, {
      action: 'role_change',
      meta: {
        event: 'deactivated',
        name: member.name,
        email: member.email,
        role: member.role,
      },
    });

    res.json({ member: serializeUser(member) });
  })
);

export default router;
