export { assertSafeDestructiveTestOperation } from '../src/lib/testDatabaseGuard.js';

export const TEST_PASSWORD = 'ValidPass1';

export function cookieHeader(response, previous = '') {
  const jar = new Map();
  for (const part of previous.split(';').map((item) => item.trim()).filter(Boolean)) {
    const name = part.split('=')[0];
    jar.set(name, part);
  }
  for (const setCookie of response.headers.getSetCookie()) {
    const pair = setCookie.split(';')[0];
    jar.set(pair.split('=')[0], pair);
  }
  return [...jar.values()].join('; ');
}

export function cookieValue(cookies, name) {
  const match = cookies
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

export function uniqueEmail(createdEmails, prefix, label) {
  const email = `${prefix}${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@peaceone.test`;
  createdEmails.push(email);
  return email;
}

export async function primeCsrf(baseUrl) {
  const response = await fetch(`${baseUrl}/api/csrf-token`);
  const { csrfToken } = await response.json();
  return { csrfToken, cookies: cookieHeader(response) };
}

export async function requestJson(baseUrl, path, { method = 'GET', csrfToken, cookies = '', body, extraHeaders = {} } = {}) {
  const headers = {
    ...extraHeaders,
  };
  if (cookies) {
    headers.Cookie = cookies;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, json, text, cookies: cookieHeader(response, cookies) };
}

export async function postJson(baseUrl, path, session, body, extraHeaders = {}) {
  return requestJson(baseUrl, path, {
    method: 'POST',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body,
    extraHeaders,
  });
}

export function validRegisterBody(email, extras = {}) {
  return {
    fullName: 'Stage Four Five',
    email,
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
    role: 'student-jobseeker',
    currentPosition: 'student',
    terms: true,
    ...extras,
  };
}

export function assertNoSecrets(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (!serialized) {
    return;
  }
  if (serialized.includes(TEST_PASSWORD) || serialized.includes('$2b$') || serialized.includes('$2a$')) {
    throw new Error('Sensitive password material appeared in a response');
  }
  if (/session_secret|csrf_secret|DATABASE_URL/i.test(serialized)) {
    throw new Error('Credential material appeared in a response');
  }
}
