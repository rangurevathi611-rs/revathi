import mongoose from 'mongoose';

const documentGrantSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    canDownload: { type: Boolean, required: true },
    expiresAt: { type: Date, default: null },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

documentGrantSchema.index({ documentId: 1, userId: 1 }, { unique: true });
documentGrantSchema.index({ organizationId: 1, userId: 1 });

export const DocumentGrant = mongoose.model('DocumentGrant', documentGrantSchema);
