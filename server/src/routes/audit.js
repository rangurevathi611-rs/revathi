import { Router } from 'express';
import { HttpError, asyncHandler } from '../http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AUDIT_ACTIONS } from '../models/AuditEvent.js';
import { listAudit } from '../services/audit.js';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const action = String(req.query.action || '');
    if (action && !AUDIT_ACTIONS.includes(action)) {
      throw new HttpError(400, 'Unknown action');
    }
    const events = await listAudit({
      organizationId: req.user.organizationId,
      action: action || undefined,
      includeNetwork: true,
    });
    res.json({ events });
  })
);

export default router;
