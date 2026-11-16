import express from 'express';
import cookieParser from 'cookie-parser';
import { checkDatabaseConnection } from './db.js';
import { sessionMiddleware } from './lib/session.js';
import { doubleCsrfProtection, generateCsrfToken, isCsrfError } from './lib/csrf.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { authRouter } from './routes/auth.js';
import { occupationsRouter } from './routes/occupations.js';
import { mascoOccupationsRouter } from './routes/mascoOccupations.js';
import { mascoCrosswalksRouter } from './routes/mascoCrosswalks.js';
import { skillsRouter } from './routes/skills.js';
import { userSkillsRouter } from './routes/userSkills.js';
import { skillGapRouter } from './routes/skillGap.js';
import { careerTargetRouter } from './routes/careerTarget.js';
import { mePositionChangeRequestsRouter } from './routes/mePositionChangeRequests.js';
import { adminPositionChangeRequestsRouter } from './routes/adminPositionChangeRequests.js';
import { meCompanyRouter } from './routes/meCompany.js';
import { adminCompaniesRouter } from './routes/adminCompanies.js';
import { adminUsersRouter } from './routes/adminUsers.js';
import {
  adminActivityRouter,
  adminContentMonitoringRouter,
  adminReportsRouter,
  adminStatsRouter,
} from './routes/adminPlatform.js';
import { meResumesRouter } from './routes/meResumes.js';
import { meJobsRouter } from './routes/meJobs.js';
import { adminJobsRouter } from './routes/adminJobs.js';
import { jobsRouter } from './routes/jobs.js';
import { meApplicationsRouter } from './routes/meApplications.js';
import { employerApplicationsRouter } from './routes/employerApplications.js';
import { adminApplicationsRouter } from './routes/adminApplications.js';
import { meInterviewsRouter } from './routes/meInterviews.js';
import { employerInterviewsRouter } from './routes/employerInterviews.js';
import { adminInterviewsRouter } from './routes/adminInterviews.js';
import { meNotificationsRouter } from './routes/meNotifications.js';
import { learningRouter } from './routes/learning.js';
import { meLearningRouter } from './routes/meLearning.js';
import { adminLearningRouter } from './routes/adminLearning.js';
import { meRouter } from './routes/me.js';

export function createApp(options = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(securityHeaders);
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
  app.use('/api/masco/occupations', mascoOccupationsRouter);
  app.use('/api/masco/crosswalks', mascoCrosswalksRouter);
  app.use('/api/skills', skillsRouter);
  app.use('/api/me/skills', userSkillsRouter);
  app.use('/api/me/skill-gap', skillGapRouter);
  app.use('/api/me/career-target', careerTargetRouter);
  app.use('/api/me/position-change-requests', mePositionChangeRequestsRouter);
  app.use('/api/admin/position-change-requests', adminPositionChangeRequestsRouter);
  app.use('/api/me/company', meCompanyRouter);
  app.use('/api/admin/users', adminUsersRouter);
  app.use('/api/admin/stats', adminStatsRouter);
  app.use('/api/admin/activity', adminActivityRouter);
  app.use('/api/admin/reports', adminReportsRouter);
  app.use('/api/admin/content-monitoring', adminContentMonitoringRouter);
  app.use('/api/admin/companies', adminCompaniesRouter);
  app.use('/api/me/resumes', meResumesRouter);
  app.use('/api/me/jobs', meJobsRouter);
  app.use('/api/admin/jobs', adminJobsRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/me/applications', meApplicationsRouter);
  app.use('/api/employer/applications', employerApplicationsRouter);
  app.use('/api/admin/applications', adminApplicationsRouter);
  app.use('/api/me/interviews', meInterviewsRouter);
  app.use('/api/employer/interviews', employerInterviewsRouter);
  app.use('/api/admin/interviews', adminInterviewsRouter);
  app.use('/api/me/notifications', meNotificationsRouter);
  app.use('/api/learning', learningRouter);
  app.use('/api/me/learning', meLearningRouter);
  app.use('/api/admin/learning', adminLearningRouter);
  app.use('/api/me', meRouter);

  if (typeof options.registerTestRoutes === 'function') {
    options.registerTestRoutes(app);
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
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
