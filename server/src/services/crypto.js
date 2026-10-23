import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';

function masterKey() {
  return config.encryptionKey;
}

// Each file gets its own data key. The data key is wrapped with the server key
// so a stolen storage directory is not readable without ENCRYPTION_KEY.
export async function storeEncrypted(buffer) {
  const dataKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const wrapIv = crypto.randomBytes(12);
  const wrapper = crypto.createCipheriv(ALGORITHM, masterKey(), wrapIv);
  const wrappedKey = Buffer.concat([wrapper.update(dataKey), wrapper.final()]);
  const wrapAuthTag = wrapper.getAuthTag();

  const storageKey = crypto.randomBytes(16).toString('hex');
  await fs.mkdir(config.storageDir, { recursive: true });
  await fs.writeFile(path.join(config.storageDir, storageKey), ciphertext, { mode: 0o600 });

  return {
    storageKey,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    wrappedKey: wrappedKey.toString('base64'),
    wrapIv: wrapIv.toString('base64'),
    wrapAuthTag: wrapAuthTag.toString('base64'),
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    size: buffer.length,
  };
}

export async function readDecrypted(doc) {
  const wrappedKey = Buffer.from(doc.wrappedKey, 'base64');
  const wrapIv = Buffer.from(doc.wrapIv, 'base64');
  const wrapAuthTag = Buffer.from(doc.wrapAuthTag, 'base64');
  const unwrapper = crypto.createDecipheriv(ALGORITHM, masterKey(), wrapIv);
  unwrapper.setAuthTag(wrapAuthTag);
  const dataKey = Buffer.concat([unwrapper.update(wrappedKey), unwrapper.final()]);

  const ciphertext = await fs.readFile(path.join(config.storageDir, doc.storageKey));
  const iv = Buffer.from(doc.iv, 'base64');
  const authTag = Buffer.from(doc.authTag, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, dataKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export async function removeStored(storageKey) {
  try {
    await fs.unlink(path.join(config.storageDir, storageKey));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}
