import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in server/.env`);
  }
  return value;
}

const encryptionKey = Buffer.from(required('ENCRYPTION_KEY'), 'base64');
if (encryptionKey.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes encoded as base64');
}

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error('Missing MONGODB_URI or MONGO_URI');
}

export const config = {
  serverRoot,
  port: Number(process.env.PORT || 4000),
  mongoUri,
  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  encryptionKey,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  accessTtl: '15m',
  refreshTtlDays: 7,
  storageDir: path.join(serverRoot, 'storage'),
};
