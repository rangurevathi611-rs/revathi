import { DocumentGrant } from '../models/DocumentGrant.js';

export function isManager(user) {
  return user.role === 'owner' || user.role === 'admin';
}

export function canEditMember(actor, target) {
  if (String(actor.id) === String(target._id)) return false;
  if (target.role === 'owner') return false;
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin' && (target.role === 'member' || target.role === 'viewer')) return true;
  return false;
}

export function grantIsCurrent(grant, now = new Date()) {
  if (!grant) return false;
  if (grant.expiresAt && grant.expiresAt <= now) return false;
  return true;
}

export async function resolveAccess(user, doc) {
  if (!doc || String(doc.organizationId) !== String(user.organizationId)) {
    return { view: false, download: false, manage: false };
  }

  const manages =
    isManager(user) || String(doc.ownerId?._id || doc.ownerId) === String(user.id);
  if (manages) {
    return { view: true, download: true, manage: true };
  }

  const grant = await DocumentGrant.findOne({
    documentId: doc._id,
    userId: user.id,
    organizationId: user.organizationId,
  });

  if (!grantIsCurrent(grant)) {
    return { view: false, download: false, manage: false };
  }

  return { view: true, download: Boolean(grant.canDownload), manage: false };
}

export function activeGrantQuery(user) {
  return {
    organizationId: user.organizationId,
    userId: user.id,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };
}
