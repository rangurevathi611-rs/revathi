import fs from 'fs';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import memberRoutes from './routes/members.js';
import documentRoutes from './routes/documents.js';
import auditRoutes from './routes/audit.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 400,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Try again later.' },
    })
  );

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/members', memberRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/audit', auditRoutes);

  const clientDist = path.resolve(config.serverRoot, '../client/dist');
  const clientIndex = path.join(clientDist, 'index.html');
  if (fs.existsSync(clientIndex)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(clientIndex);
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
