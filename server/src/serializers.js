import mongoose from 'mongoose';

export function isObjectId(id) {
  return mongoose.isValidObjectId(id);
}

export function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
}

export function serializeDocument(doc, access) {
  const owner = doc.ownerId && doc.ownerId.name ? doc.ownerId : null;
  const ownerId = owner ? owner._id : doc.ownerId;
  return {
    id: doc._id,
    title: doc.title,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    size: doc.size,
    sha256: doc.sha256,
    createdAt: doc.createdAt,
    owner: owner
      ? { id: owner._id, name: owner.name, email: owner.email }
      : { id: ownerId, name: 'Unknown', email: '' },
    canDownload: Boolean(access.download),
    canManage: Boolean(access.manage),
  };
}

export function serializeGrant(grant) {
  const person = grant.userId && grant.userId.name ? grant.userId : null;
  const granter = grant.grantedBy && grant.grantedBy.name ? grant.grantedBy : null;
  return {
    id: grant._id,
    canDownload: grant.canDownload,
    expiresAt: grant.expiresAt,
    expired: Boolean(grant.expiresAt && grant.expiresAt <= new Date()),
    createdAt: grant.createdAt,
    user: person
      ? {
          id: person._id,
          name: person.name,
          email: person.email,
          role: person.role,
          active: person.active,
        }
      : { id: grant.userId, name: 'Former member', email: '', role: '', active: false },
    grantedBy: granter
      ? { id: granter._id, name: granter.name }
      : { id: grant.grantedBy || null, name: 'Former member' },
  };
}

export function contentDisposition(filename) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export function mimeFromName(filename) {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return null;
  return MIME_BY_EXT[filename.slice(dot).toLowerCase()] || null;
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
