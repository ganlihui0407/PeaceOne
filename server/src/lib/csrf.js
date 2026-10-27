import { doubleCsrf } from 'csrf-csrf';
import { config } from '../config.js';

export const csrfCookieName = config.sessionCookieSecure
  ? '__Host-peaceone.csrf'
  : 'peaceone.csrf';

const {
  doubleCsrfProtection,
  generateCsrfToken,
  invalidCsrfTokenError,
} = doubleCsrf({
  getSecret: () => config.csrfSecret,
  getSessionIdentifier: (req) => {
    if (!req.sessionID) {
      throw new Error('Session is required for CSRF');
    }
    return req.sessionID;
  },
  cookieName: csrfCookieName,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: config.sessionCookieSecure,
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

export { doubleCsrfProtection, generateCsrfToken, invalidCsrfTokenError };

export function isCsrfError(err) {
  return Boolean(
    err &&
      (err === invalidCsrfTokenError ||
        err.code === 'EBADCSRFTOKEN' ||
        err.code === invalidCsrfTokenError?.code),
  );
}
