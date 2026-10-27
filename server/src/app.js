import express from 'express';
import cookieParser from 'cookie-parser';
import { checkDatabaseConnection } from './db.js';
import { sessionMiddleware } from './lib/session.js';
import { doubleCsrfProtection, generateCsrfToken, isCsrfError } from './lib/csrf.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { occupationsRouter } from './routes/occupations.js';
import { skillsRouter } from './routes/skills.js';
import { userSkillsRouter } from './routes/userSkills.js';
import { skillGapRouter } from './routes/skillGap.js';
import { careerTargetRouter } from './routes/careerTarget.js';

export function createApp(options = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '32kb' }));
  app.use(sessionMiddleware);
  app.use(cookieParser());
  app.use(apiRateLimit);

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

  app.get('/api/csrf-token', (req, res) => {
    req.session.csrfBound = true;
    const csrfToken = generateCsrfToken(req, res);
    res.status(200).json({ csrfToken });
  });

  app.use(doubleCsrfProtection);
  app.use('/api/auth', authRouter);
  app.use('/api/occupations', occupationsRouter);
  app.use('/api/skills', skillsRouter);
  app.use('/api/me/skills', userSkillsRouter);
  app.use('/api/me/skill-gap', skillGapRouter);
  app.use('/api/me/career-target', careerTargetRouter);

  if (typeof options.registerTestRoutes === 'function') {
    options.registerTestRoutes(app);
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  app.use((err, req, res, _next) => {
    if (isCsrfError(err)) {
      res.status(403).json({ error: 'Invalid CSRF token' });
      return;
    }

    if (err?.type === 'entity.too.large' || err?.status === 413) {
      res.status(413).json({ error: 'Request too large' });
      return;
    }

    if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    console.error('Request failed', {
      method: req.method,
      path: req.path,
    });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
