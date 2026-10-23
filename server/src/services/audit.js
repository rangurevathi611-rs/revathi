import { AuditEvent } from '../models/AuditEvent.js';

export async function recordAudit(req, { action, documentId = null, meta = {}, actorId, organizationId }) {
  const resolvedActor = actorId || req.user.id;
  const resolvedOrg = organizationId || req.user.organizationId;

  if (action === 'view' && documentId) {
    const recent = await AuditEvent.findOne({
      actorId: resolvedActor,
      documentId,
      action: 'view',
      createdAt: { $gt: new Date(Date.now() - 10_000) },
    });
    if (recent) return recent;
  }

  return AuditEvent.create({
    organizationId: resolvedOrg,
    actorId: resolvedActor,
    action,
    documentId,
    meta,
    ip: req.ip || '',
    userAgent: req.get('user-agent') || '',
  });
}

export function serializeAudit(event, { includeNetwork = true } = {}) {
  const actorDoc = event.actorId && event.actorId.name ? event.actorId : null;
  const documentDoc = event.documentId && event.documentId.title ? event.documentId : null;
  const meta = event.meta || {};

  return {
    id: event._id,
    action: event.action,
    createdAt: event.createdAt,
    ip: includeNetwork ? event.ip : undefined,
    userAgent: includeNetwork ? event.userAgent : undefined,
    meta,
    actor: actorDoc
      ? { id: actorDoc._id, name: actorDoc.name, email: actorDoc.email }
      : { id: event.actorId || null, name: 'Former member', email: '' },
    document: documentDoc
      ? { id: documentDoc._id, title: documentDoc.title }
      : meta.title
        ? { id: null, title: meta.title }
        : null,
  };
}

export async function listAudit({ organizationId, documentId, action, limit = 200, includeNetwork = true }) {
  const filter = { organizationId };
  if (documentId) filter.documentId = documentId;
  if (action) filter.action = action;

  const events = await AuditEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actorId', 'name email')
    .populate('documentId', 'title');

  return events.map((event) => serializeAudit(event, { includeNetwork }));
}
