import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true, unique: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    wrappedKey: { type: String, required: true },
    wrapIv: { type: String, required: true },
    wrapAuthTag: { type: String, required: true },
    sha256: { type: String, required: true },
  },
  { timestamps: true }
);

export const Document = mongoose.model('Document', documentSchema);
