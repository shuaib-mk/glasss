import crypto from 'crypto';

const COOKIE_NAME = 'sunni_admin_session';
const SESSION_DURATION_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60_000;
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttempts = new Map();

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getSessionSecret() {
  return (process.env.ADMIN_SESSION_SECRET || '').trim();
}

function sign(payload) {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '')
    .split(';')
    .map(value => value.trim().split('='))
    .filter(parts => parts.length === 2)
    .map(([key, value]) => [key, decodeURIComponent(value)]));
}

function getClientId(req) {
  return String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
}

export function verifyAdminPassword(req, password) {
  const expectedPassword = (process.env.ADMIN_PASSWORD || '').trim();
  const sessionSecret = getSessionSecret();
  if (!expectedPassword || !sessionSecret) {
    const error = new Error('Server admin authentication is not configured.');
    error.status = 503;
    throw error;
  }

  const clientId = getClientId(req);
  const now = Date.now();
  const state = loginAttempts.get(clientId);
  if (state && state.resetAt > now && state.count >= MAX_LOGIN_ATTEMPTS) {
    const error = new Error('Too many login attempts. Please wait 15 minutes.');
    error.status = 429;
    throw error;
  }
  if (!state || state.resetAt <= now) loginAttempts.set(clientId, { count: 0, resetAt: now + LOGIN_WINDOW_MS });

  if (!safeEqual(password, expectedPassword)) {
    loginAttempts.get(clientId).count += 1;
    return false;
  }

  loginAttempts.delete(clientId);
  return true;
}

export function createAdminSessionCookie(req) {
  const now = Math.floor(Date.now() / 1_000);
  const payload = Buffer.from(JSON.stringify({ issuedAt: now, expiresAt: now + SESSION_DURATION_SECONDS, nonce: crypto.randomUUID() })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env.VERCEL || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_DURATION_SECONDS}${secure}`;
}

export function clearAdminSessionCookie(req) {
  const secure = process.env.VERCEL || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${secure}`;
}

export function isAdminAuthenticated(req) {
  const secret = getSessionSecret();
  if (!secret) return false;
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(session.expiresAt) > Math.floor(Date.now() / 1_000);
  } catch {
    return false;
  }
}

export function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  try {
    const originUrl = new URL(origin);
    const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    if (originUrl.host === requestHost) return;
  } catch {}
  const error = new Error('Cross-origin admin requests are not allowed.');
  error.status = 403;
  throw error;
}
