import mongoose from 'mongoose';

const ACTIONS = [
  'login',
  'upload',
  'view',
  'download',
  'share',
  'revoke',
  'delete',
  'role_change',
];

const auditEventSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ACTIONS, required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditEventSchema.index({ organizationId: 1, createdAt: -1 });

function rejectUpdate(next) {
  next(new Error('Audit events cannot be modified'));
}

for (const hook of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne']) {
  auditEventSchema.pre(hook, rejectUpdate);
}

export const AUDIT_ACTIONS = ACTIONS;
export const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);
