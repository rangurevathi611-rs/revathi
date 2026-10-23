import path from 'path';
import multer from 'multer';
import { mimeFromName } from '../serializers.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const base = path.basename(file.originalname || '');
    if (!mimeFromName(base)) {
      cb(new Error('Only pdf, doc, docx, txt, png, and jpg files are allowed'));
      return;
    }
    cb(null, true);
  },
});
