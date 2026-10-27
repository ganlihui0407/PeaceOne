import express from 'express';
import { checkDatabaseConnection } from './db.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', async (_req, res) => {
    let database = 'ok';

    try {
      await checkDatabaseConnection();
    } catch {
      database = 'unavailable';
    }

    const healthy = database === 'ok';

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      server: 'ok',
      database,
      timestamp: new Date().toISOString(),
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  app.use((_err, req, res, _next) => {
    console.error('Request failed', {
      method: req.method,
      path: req.path,
    });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
