'use strict';
const crypto = require('crypto');
const config = require('./config');

// ---------- رمز عبور (scrypt، سازگار با هش‌های نسخه قبلی) ----------
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, KEYLEN, SCRYPT_OPTS).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expected] = parts;
  const actual = crypto.scryptSync(String(password), salt, KEYLEN, SCRYPT_OPTS).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

// حداقل ۸ کاراکتر، شامل حرف و عدد
function passwordPolicyError(password) {
  const p = String(password || '');
  if (p.length < 8) return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  if (p.length > 128) return 'رمز عبور بیش از حد طولانی است.';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'رمز عبور باید هم حرف انگلیسی و هم عدد داشته باشد.';
  return null;
}

function randomPassword() {
  // ۱۶ کاراکتر با حرف و عدد و علامت
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = crypto.randomBytes(16);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out.slice(0, 12) + '#' + out.slice(12, 15);
}

// ---------- نشست‌ها ----------
const sessions = new Map(); // sid -> { userId, createdAt, lastSeen, ip }

function createSession(userId, ip) {
  const sid = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(sid, { userId, createdAt: now, lastSeen: now, ip: ip || '' });
  return sid;
}
function getSession(sid) {
  const s = sessions.get(sid);
  if (!s) return null;
  const now = Date.now();
  if (now - s.lastSeen > config.SESSION_IDLE_MS || now - s.createdAt > config.SESSION_MAX_MS) {
    sessions.delete(sid);
    return null;
  }
  s.lastSeen = now;
  return s;
}
function sessionCookie(sid, session) {
  const remaining = session ? config.SESSION_MAX_MS - (Date.now() - session.createdAt) : config.SESSION_MAX_MS;
  const seconds = Math.max(0, Math.floor(Math.min(config.SESSION_IDLE_MS, remaining) / 1000));
  return `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${config.COOKIE_SECURE ? '; Secure' : ''}`;
}
function destroySession(sid) { sessions.delete(sid); }
function destroyUserSessions(userId, exceptSid = null) {
  for (const [sid, s] of sessions) if (s.userId === userId && sid !== exceptSid) sessions.delete(sid);
}
function countUserSessions(userId) {
  let n = 0;
  for (const s of sessions.values()) if (s.userId === userId) n++;
  return n;
}
function pruneSessions() {
  const now = Date.now();
  for (const [sid, s] of sessions) {
    if (now - s.lastSeen > config.SESSION_IDLE_MS || now - s.createdAt > config.SESSION_MAX_MS) sessions.delete(sid);
  }
}

// ---------- محدودیت تلاش ورود ----------
const loginAttempts = new Map(); // key -> { count, windowStart, lockedUntil }

function loginKey(ip, username) { return `${ip}|${String(username || '').toLowerCase()}`; }

function loginLockedFor(ip, username) {
  const rec = loginAttempts.get(loginKey(ip, username));
  if (!rec || !rec.lockedUntil) return 0;
  const left = rec.lockedUntil - Date.now();
  if (left <= 0) { loginAttempts.delete(loginKey(ip, username)); return 0; }
  return left;
}
function recordLoginFailure(ip, username) {
  const key = loginKey(ip, username);
  const now = Date.now();
  let rec = loginAttempts.get(key);
  if (!rec || now - rec.windowStart > config.LOGIN_WINDOW_MS) rec = { count: 0, windowStart: now, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= config.LOGIN_MAX_ATTEMPTS) rec.lockedUntil = now + config.LOGIN_LOCK_MS;
  loginAttempts.set(key, rec);
}
function clearLoginFailures(ip, username) { loginAttempts.delete(loginKey(ip, username)); }

// ---------- Headers امنیتی ----------
function securityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

module.exports = {
  hashPassword, verifyPassword, passwordPolicyError, randomPassword,
  createSession, getSession, sessionCookie, destroySession, destroyUserSessions, countUserSessions, pruneSessions,
  loginLockedFor, recordLoginFailure, clearLoginFailures,
  securityHeaders,
};
