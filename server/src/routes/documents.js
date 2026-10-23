import path from 'path';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError, asyncHandler } from '../http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { Document } from '../models/Document.js';
import { DocumentGrant } from '../models/DocumentGrant.js';
import { User } from '../models/User.js';
import { AUDIT_ACTIONS } from '../models/AuditEvent.js';
import { activeGrantQuery, isManager, resolveAccess } from '../services/access.js';
import { listAudit, recordAudit } from '../services/audit.js';
import { readDecrypted, removeStored, storeEncrypted } from '../services/crypto.js';
import {
  contentDisposition,
  escapeRegex,
  isObjectId,
  mimeFromName,
  serializeDocument,
  serializeGrant,
} from '../serializers.js';

const router = Router();

const grantSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'Choose a person to share with'),
  canDownload: z.boolean(),
  expiresAt: z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry must be a date'),
      z.literal(''),
    ])
    .optional(),
});

router.use(authenticate);

async function loadDocument(req) {
  if (!isObjectId(req.params.id)) return null;
  return Document.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  }).populate('ownerId', 'name email');
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { organizationId: req.user.organizationId };
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

    let grantsByDocument = new Map();
    if (!isManager(req.user)) {
      const grants = await DocumentGrant.find(activeGrantQuery(req.user)).select('documentId canDownload');
      grantsByDocument = new Map(grants.map((grant) => [String(grant.documentId), grant]));
      filter.$or = [{ ownerId: req.user.id }, { _id: { $in: grants.map((grant) => grant.documentId) } }];
    }

    const documents = await Document.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('ownerId', 'name email');

    res.json({
      documents: documents.map((doc) => {
        const owns = String(doc.ownerId?._id || doc.ownerId) === String(req.user.id);
        if (isManager(req.user) || owns) {
          return serializeDocument(doc, { download: true, manage: true });
        }
        const grant = grantsByDocument.get(String(doc._id));
        return serializeDocument(doc, { download: Boolean(grant?.canDownload), manage: false });
      }),
    });
  })
);

router.post(
  '/',
  requireRole('owner', 'admin', 'member'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const title = String(req.body.title || '').trim();
    if (!title || title.length > 140) {
      throw new HttpError(400, 'Title must be between 1 and 140 characters');
    }
    if (!req.file) throw new HttpError(400, 'Choose a file to upload');
    if (!req.file.buffer.length) throw new HttpError(400, 'The file is empty');

    const originalName = path.basename(req.file.originalname || '').slice(0, 180);
    const mimeType = mimeFromName(originalName);
    if (!mimeType) {
      throw new HttpError(400, 'Only pdf, doc, docx, txt, png, and jpg files are allowed');
    }

    const stored = await storeEncrypted(req.file.buffer);
    try {
      const doc = await Document.create({
        organizationId: req.user.organizationId,
        ownerId: req.user.id,
        title,
        originalName,
        mimeType,
        ...stored,
      });
      await doc.populate('ownerId', 'name email');
      await recordAudit(req, {
        action: 'upload',
        documentId: doc._id,
        meta: { title: doc.title, originalName: doc.originalName, size: doc.size },
      });
      res.status(201).json({
        document: serializeDocument(doc, { download: true, manage: true }),
      });
    } catch (err) {
      await removeStored(stored.storageKey);
      throw err;
    }
  })
);

router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const doc = await loadDocument(req);
    const access = await resolveAccess(req.user, doc);
    if (!doc || !access.view) throw new HttpError(404, 'Document not found');
    if (!access.download) {
      throw new HttpError(403, 'Download is not permitted for this document');
    }

    let plaintext;
    try {
      plaintext = await readDecrypted(doc);
    } catch (err) {
      console.error(err);
      throw new HttpError(500, 'The file could not be opened');
    }

    await recordAudit(req, {
      action: 'download',
      documentId: doc._id,
      meta: { title: doc.title },
    });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', contentDisposition(doc.originalName));
    res.setHeader('Content-Length', plaintext.length);
    res.setHeader('Cache-Control', 'no-store');
    res.send(plaintext);
  })
);

router.get(
  '/:id/audit',
  asyncHandler(async (req, res) => {
    const doc = await loadDocument(req);
    const access = await resolveAccess(req.user, doc);
    if (!doc || !access.view) throw new HttpError(404, 'Document not found');

    const action = String(req.query.action || '');
    if (action && !AUDIT_ACTIONS.includes(action)) {
      throw new HttpError(400, 'Unknown action');
    }

    const events = await listAudit({
      organizationId: req.user.organizationId,
      documentId: doc._id,
      action: action || undefined,
      includeNetwork: access.manage,
    });
    res.json({ events });
  })
);

router.post(
  '/:id/grants',
  validate(grantSchema),
  asyncHandler(async (req, res) => {
    const doc = await loadDocument(req);
    const access = await resolveAccess(req.user, doc);
    if (!doc || !access.view) throw new HttpError(404, 'Document not found');
    if (!access.manage) throw new HttpError(403, 'You cannot share this document');

    const recipient = await User.findOne({
      _id: req.body.userId,
      organizationId: req.user.organizationId,
      active: true,
    });
    if (!recipient) throw new HttpError(400, 'That person is not an active member of this company');
    if (String(recipient._id) === String(doc.ownerId._id || doc.ownerId)) {
      throw new HttpError(400, 'The document owner already has access');
    }
    if (recipient.role === 'owner' || recipient.role === 'admin') {
      throw new HttpError(400, 'Owners and admins already have access to every document');
    }

    let expiresAt = null;
    if (req.body.expiresAt) {
      const [year, month, day] = req.body.expiresAt.split('-').map(Number);
      expiresAt = new Date(year, month - 1, day, 23, 59, 59, 999);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        throw new HttpError(400, 'Expiry must be a future date');
      }
    }

    const grant = await DocumentGrant.findOneAndUpdate(
      { documentId: doc._id, userId: recipient._id },
      {
        $set: {
          organizationId: req.user.organizationId,
          canDownload: req.body.canDownload,
          expiresAt,
          grantedBy: req.user.id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await grant.populate('userId', 'name email role active');
    await grant.populate('grantedBy', 'name');

    await recordAudit(req, {
      action: 'share',
      documentId: doc._id,
      meta: {
        title: doc.title,
        name: recipient.name,
        email: recipient.email,
        canDownload: req.body.canDownload,
        expiresAt,
      },
    });

    res.status(201).json({ grant: serializeGrant(grant) });
  })
);

router.delete(
  '/:id/grants/:userId',
  asyncHandler(async (req, res) => {
    const doc = await loadDocument(req);
    const access = await resolveAccess(req.user, doc);
    if (!doc || !access.view) throw new HttpError(404, 'Document not found');
    if (!access.manage) throw new HttpError(403, 'You cannot change access for this document');
    if (!isObjectId(req.params.userId)) throw new HttpError(404, 'Grant not found');

    const grant = await DocumentGrant.findOne({
      documentId: doc._id,
      userId: req.params.userId,
      organizationId: req.user.organizationId,
    }).populate('userId', 'name email');
    if (!grant) throw new HttpError(404, 'Grant not found');

    const person = grant.userId && grant.userId.name ? grant.userId : null;
    await grant.deleteOne();

    await recordAudit(req, {
      action: 'revoke',
      documentId: doc._id,
      meta: {
        title: doc.title,
        name: person?.name || 'Former member',
        email: person?.email || '',
      },
    });

    res.json({ ok: true });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await loadDocument(req);
    const access = await resolveAccess(req.user, doc);
    if (!doc || !access.view) throw new HttpError(404, 'Document not found');

    await recordAudit(req, {
      action: 'view',
      documentId: doc._id,
      meta: { title: doc.title },
    });

    let grants;
    if (access.manage) {
      const rows = await DocumentGrant.find({
        documentId: doc._id,
        organizationId: req.user.organizationId,
      })
        .sort({ createdAt: -1 })
        .populate('userId', 'name email role active')
        .populate('grantedBy', 'name');
      grants = rows.map(serializeGrant);
    }

    res.json({
      document: serializeDocument(doc, access),
      grants,
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await loadDocument(req);
    const access = await resolveAccess(req.user, doc);
    if (!doc || !access.view) throw new HttpError(404, 'Document not found');
    if (!access.manage) throw new HttpError(403, 'You cannot delete this document');

    await recordAudit(req, {
      action: 'delete',
      documentId: doc._id,
      meta: { title: doc.title, originalName: doc.originalName },
    });
    await DocumentGrant.deleteMany({ documentId: doc._id, organizationId: req.user.organizationId });
    await doc.deleteOne();
    await removeStored(doc.storageKey);
    res.json({ ok: true });
  })
);

export default router;
