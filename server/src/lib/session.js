import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { config } from '../config.js';

const PgSession = connectPgSimple(session);

const sessionPool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 5,
});

export const sessionCookieName = 'peaceone.sid';

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: config.sessionCookieSecure,
  };
}

export function rememberMeMaxAgeMs() {
  return 7 * 24 * 60 * 60 * 1000;
}

export function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

export function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

export const sessionMiddleware = session({
  name: sessionCookieName,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: false,
  store: new PgSession({
    pool: sessionPool,
    tableName: 'session',
    createTableIfMissing: false,
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: config.sessionCookieSecure,
  },
});

export async function closeSessionStore() {
  await sessionPool.end();
}
