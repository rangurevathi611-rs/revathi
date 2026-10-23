import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AuditEvent } from './models/AuditEvent.js';
import { Document } from './models/Document.js';
import { DocumentGrant } from './models/DocumentGrant.js';
import { Organization } from './models/Organization.js';
import { User } from './models/User.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { readDecrypted, removeStored, storeEncrypted } from './services/crypto.js';

const PASSWORD = 'TrustVault1!';
const MINUTES = `NORTHWIND TRADING — CONFIDENTIAL
Q3 Board Minutes

Circulated only to named recipients.
Resolution: renew the harbor lease and keep the valuation memo inside TrustVault.
`;

export async function seedNorthwind() {
const existing = await Organization.findOne({ slug: 'northwind' });
if (existing) {
  const docs = await Document.find({ organizationId: existing._id });
  for (const doc of docs) {
    await removeStored(doc.storageKey);
  }
  await DocumentGrant.deleteMany({ organizationId: existing._id });
  await Document.deleteMany({ organizationId: existing._id });
  await AuditEvent.deleteMany({ organizationId: existing._id });
  await User.deleteMany({ organizationId: existing._id });
  await existing.deleteOne();
}

const taken = await User.findOne({
  email: { $in: ['owner@northwind.dev', 'member@northwind.dev', 'viewer@northwind.dev'] },
});
if (taken) {
  throw new Error(`Seed email ${taken.email} already belongs to another company`);
}

const organization = await Organization.create({
  name: 'Northwind Trading',
  slug: 'northwind',
});

const passwordHash = await bcrypt.hash(PASSWORD, 12);
const [owner, member, viewer] = await User.create([
  {
    name: 'Ada North',
    email: 'owner@northwind.dev',
    passwordHash,
    organizationId: organization._id,
    role: 'owner',
  },
  {
    name: 'Miles Chen',
    email: 'member@northwind.dev',
    passwordHash,
    organizationId: organization._id,
    role: 'member',
  },
  {
    name: 'Priya Shah',
    email: 'viewer@northwind.dev',
    passwordHash,
    organizationId: organization._id,
    role: 'viewer',
  },
]);

const stored = await storeEncrypted(Buffer.from(MINUTES, 'utf8'));
const document = await Document.create({
  organizationId: organization._id,
  ownerId: owner._id,
  title: 'Q3 Board Minutes',
  originalName: 'q3-board-minutes.txt',
  mimeType: 'text/plain',
  ...stored,
});

await DocumentGrant.create({
  documentId: document._id,
  organizationId: organization._id,
  userId: viewer._id,
  canDownload: true,
  expiresAt: null,
  grantedBy: owner._id,
});

const opened = await readDecrypted(document);
if (opened.toString('utf8') !== MINUTES) {
  throw new Error('Seed file did not decrypt to the original minutes');
}

const base = Date.now();
await AuditEvent.create([
  {
    organizationId: organization._id,
    actorId: owner._id,
    action: 'upload',
    documentId: document._id,
    meta: { title: document.title, originalName: document.originalName, size: document.size },
    ip: '127.0.0.1',
    userAgent: 'trustvault-seed',
    createdAt: new Date(base - 1000 * 60 * 40),
  },
  {
    organizationId: organization._id,
    actorId: owner._id,
    action: 'share',
    documentId: document._id,
    meta: {
      title: document.title,
      name: viewer.name,
      email: viewer.email,
      canDownload: true,
      expiresAt: null,
    },
    ip: '127.0.0.1',
    userAgent: 'trustvault-seed',
    createdAt: new Date(base - 1000 * 60 * 35),
  },
  {
    organizationId: organization._id,
    actorId: viewer._id,
    action: 'view',
    documentId: document._id,
    meta: { title: document.title },
    ip: '127.0.0.1',
    userAgent: 'trustvault-seed',
    createdAt: new Date(base - 1000 * 60 * 12),
  },
]);

console.log('Seeded Northwind Trading');
console.log('  owner@northwind.dev  / TrustVault1!');
console.log('  member@northwind.dev / TrustVault1!  (no access to the minutes)');
console.log('  viewer@northwind.dev / TrustVault1!  (can download the minutes)');
console.log(`Storage directory: ${config.storageDir}`);
}

export async function ensureNorthwindDemo() {
  const existing = await Organization.findOne({ slug: 'northwind' });
  if (existing) {
    const viewer = await User.findOne({
      email: 'viewer@northwind.dev',
      organizationId: existing._id,
      active: true,
    });
    const minutes = await Document.findOne({
      organizationId: existing._id,
      title: 'Q3 Board Minutes',
    });
    const passwordOk = viewer ? await bcrypt.compare(PASSWORD, viewer.passwordHash) : false;
    let fileReady = false;
    if (minutes) {
      try {
        await fs.access(path.join(config.storageDir, minutes.storageKey));
        fileReady = true;
      } catch {
        fileReady = false;
      }
    }
    if (passwordOk && fileReady) return;
  }
  await seedNorthwind();
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  await connectDb();
  await seedNorthwind();
  await mongoose.disconnect();
}
