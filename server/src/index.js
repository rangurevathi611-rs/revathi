import fs from 'fs';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { ensureNorthwindDemo } from './seed.js';

fs.mkdirSync(config.storageDir, { recursive: true });
await connectDb();
await ensureNorthwindDemo();

createApp().listen(config.port, () => {
  console.log(`TrustVault API listening on ${config.port}`);
});
