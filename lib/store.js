'use strict';
// ذخیره‌سازی اتمیک روی فایل JSON + مهاجرت + شمارنده‌ها + Audit با زنجیره Hash
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const log = require('./logger');
const security = require('./security');
const { PRODUCTS_SEED, PRODUCT_CATALOG_VERSION } = require('./catalog');

const SCHEMA_VERSION = 2;
const DB_FILE = () => path.join(config.DATA_DIR, 'db.json');
const LOCK_FILE = () => path.join(config.DATA_DIR, '.lock');

const ROLES = [
  { code: 'admin', title: 'مدیر سیستم' },
  { code: 'gate', title: 'نگهبانی' },
  { code: 'sales', title: 'فروش' },
  { code: 'warehouse', title: 'انبار' },
  { code: 'store', title: 'فروشگاه' },
  { code: 'dispatch', title: 'واحد پخش' },
  { code: 'driver', title: 'راننده' },
];

let db = null;

function uid() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }
function pad(n) { return String(n).padStart(2, '0'); }
function localDateKey(d = new Date()) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }

// ---------- قفل یک‌نمونه‌ای ----------
function acquireLock() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  const f = LOCK_FILE();
  if (fs.existsSync(f)) {
    const pid = Number(fs.readFileSync(f, 'utf8'));
    let alive = false;
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch { alive = false; }
    if (alive && pid !== process.pid) throw new Error(`یک نمونه دیگر از سامانه با PID ${pid} در حال اجراست.`);
  }
  fs.writeFileSync(f, String(process.pid));
  const release = () => { try { if (fs.readFileSync(f, 'utf8') === String(process.pid)) fs.unlinkSync(f); } catch { /* ignore */ } };
  process.once('exit', release);
  return release;
}

// ---------- ذخیره اتمیک (نوشتن در فایل موقت + fsync + rename) ----------
function persist(data) {
  const file = DB_FILE();
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(data));
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}

function save() {
  const cutoff = Date.now() - config.IDEMPOTENCY_TTL_MS;
  db.idempotency = (db.idempotency || []).filter((x) => Date.parse(x.createdAt) >= cutoff);
  persist(db);
}

// ---------- Seed ----------
function makeSeedDb(adminPassword) {
  return {
    meta: { app: 'baboltoyoor Smart System', version: '37.4.0', schemaVersion: SCHEMA_VERSION, createdAt: nowIso(), productCatalogVersion: '', auditSeq: 0, lastAuditHash: 'GENESIS' },
    roles: ROLES,
    users: [{ id: 'u1', username: 'admin', fullName: 'مدیر سیستم', position: 'مدیر سیستم', passwordHash: security.hashPassword(adminPassword), roleCode: 'admin', isActive: true, mustChangePassword: true, createdAt: nowIso() }],
    customers: [], drivers: [], dispatchReturns: [], paymentDevices: [], visits: [], orders: [], orderItems: [], payments: [], notifications: [], audit: [],
    products: [], priceList: [], idempotency: [], counters: {},
  };
}

// ---------- همگام‌سازی کاتالوگ ----------
function syncProductCatalog(data) {
  data.products ||= [];
  const firstMigration = data.meta.productCatalogVersion !== PRODUCT_CATALOG_VERSION;
  let added = 0;
  for (const row of PRODUCTS_SEED) {
    let p = data.products.find((x) => x.quickCode === row.quickCode);
    if (!p) {
      p = { id: row.id, quickCode: row.quickCode, name: row.name, defaultUnit: row.defaultUnit, isActive: true };
      if (data.products.some((x) => x.id === p.id)) p.id = uid();
      data.products.push(p); added++;
    } else if (firstMigration) {
      p.name = row.name;
      p.defaultUnit ||= row.defaultUnit;
      if (p.isActive === undefined) p.isActive = true;
    }
  }
  data.meta.productCatalogVersion = PRODUCT_CATALOG_VERSION;
  return { added, total: PRODUCTS_SEED.length };
}

// ---------- مهاجرت ----------
function migrate(data) {
  const from = Number(data.meta?.schemaVersion || 1);
  data.meta ||= {};
  data.meta.version='37.6.0';
  data.roles = ROLES;
  for (const k of ['notifications', 'audit', 'payments', 'orders', 'orderItems', 'visits', 'customers', 'drivers', 'dispatchReturns', 'paymentDevices', 'products', 'priceList', 'users', 'idempotency']) data[k] ||= [];
  data.counters ||= {};
  require('./order-numbers').ensureOrderNumbers(data);
  require('./invoice-numbers').ensureInvoiceNumbers(data);
  // کد مشتری برای پرونده‌های قدیمی (بدون کد) — idempotent
  require('./customer-core').ensureCodes(data);
  data.meta.auditSeq ||= 0;
  data.meta.lastAuditHash ||= 'GENESIS';

  if (from < SCHEMA_VERSION) {
    for (const o of data.orders) {
      if (o.orderType === undefined) o.orderType = 'ONSITE';
      if (o.customerId === undefined) { const v = data.visits.find((x) => x.id === o.visitId); if (v) o.customerId = v.customerId; }
      o.scheduledDate ??= null;
      o.scheduledAt ??= o.scheduledDate ? `${o.scheduledDate}T23:59` : null;
      o.dispatchPlace ??= '';
      if (o.approvalStatus === undefined && o.orderType === 'STORE') o.approvalStatus = 'APPROVED';
      o.source ??= o.orderType === 'REMOTE' ? 'SALES_REMOTE' : 'SALES_COUNTER';
      o.notes ??= '';
    }
    for (const u of data.users) {
      if (u.position === undefined) u.position = 'کاربر سامانه';
      u.mustChangePassword ??= false;
      // نصب‌های قدیمی با رمز پیش‌فرض باید در اولین ورود رمز را تغییر دهند
      if (u.username === 'admin' && security.verifyPassword('Admin@12345', u.passwordHash)) u.mustChangePassword = true;
    }
    for (const it of data.orderItems) it.description ??= '';
    // Restore legacy invoice counters; order labels use the global six-digit counter.
    for (const p of data.payments) {
      const m = String(p.invoiceNumber || '').match(/^BT-(\d{8})-(\d+)$/);
      if (m) data.counters[`invoice:${m[1]}`] = Math.max(data.counters[`invoice:${m[1]}`] || 0, Number(m[2]));
    }
    // وضعیت Visit باید با وضعیت سفارش خروج‌شده هم‌گام باشد
    for (const o of data.orders) if (o.status === 'EXITED') { const v = data.visits.find((x) => x.id === o.visitId); if (v) v.status = 'EXITED'; }
    data.meta.schemaVersion = SCHEMA_VERSION;
  }
  const changed = syncProductCatalog(data);
  if (changed.added || from < SCHEMA_VERSION) log.info('store', 'migration applied', { from, to: SCHEMA_VERSION, productsAdded: changed.added });
  return data;
}

// ---------- بارگذاری ----------
function init() {
  const file = DB_FILE();
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) {
    const generated = !config.ADMIN_INITIAL_PASSWORD;
    const pass = config.ADMIN_INITIAL_PASSWORD || security.randomPassword();
    db = makeSeedDb(pass);
    syncProductCatalog(db);
    save();
    log.info('store', 'database initialized', { file });
    if (generated) {
      // رمز تصادفی فقط یک‌بار در کنسول نمایش داده می‌شود و در دیسک ذخیره نمی‌گردد
      process.stdout.write(`\n==== رمز اولیه مدیر (username: admin) ====\n${pass}\nاین رمز فقط یک‌بار نمایش داده می‌شود؛ در اولین ورود باید تغییر کند.\n==========================================\n\n`);
    }
  } else {
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {
      throw new Error(`فایل دیتابیس خراب است (${file}). از آخرین بکاپ بازیابی کنید.`);
    }
    db = migrate(parsed);
    save();
  }
  return db;
}

function get() {
  if (!db) throw new Error('store is not initialized');
  return db;
}

// ---------- شمارنده‌های یکتا (تولید فقط در Backend) ----------
function nextNumber(key) {
  db.counters[key] = (db.counters[key] || 0) + 1;
  return db.counters[key];
}
function nextInvoiceNumber() {
  return require('./invoice-numbers').nextInvoiceNumber(db);
}
function nextOrderNumber() {
  return require('./order-numbers').nextOrderNumber(db);
}
function nextStoreOrderNumber(branchNo) { // v37.6.0 — سری مجزای شعبه‌محور فروشگاه
  return require('./order-numbers').nextStoreOrderNumber(db, branchNo);
}

// ---------- Audit با زنجیره Hash (Append-only) ----------
function auditHash(prev, entry) {
  const { hash, ...rest } = entry; // eslint-disable-line no-unused-vars
  return crypto.createHash('sha256').update(prev + JSON.stringify(rest)).digest('hex');
}
function audit(user, action, entityType, entityId, details = {}, ctx = {}) {
  const prevHash = db.meta.lastAuditHash || 'GENESIS';
  const entry = {
    id: uid(),
    seq: (db.meta.auditSeq = (db.meta.auditSeq || 0) + 1),
    userId: user?.id || null,
    username: user?.username || null,
    action, entityType, entityId: entityId ?? null,
    details,
    ip: ctx.ip || '',
    userAgent: String(ctx.userAgent || '').slice(0, 160),
    createdAt: nowIso(),
    prevHash,
  };
  entry.hash = auditHash(prevHash, entry);
  db.meta.lastAuditHash = entry.hash;
  db.audit.push(entry);
  return entry;
}
function verifyAuditChain() {
  let prev = 'GENESIS';
  let checked = 0;
  for (const e of db.audit) {
    if (!e.hash) continue; // رکوردهای قدیمی قبل از زنجیره
    if (e.prevHash !== prev || auditHash(prev, e) !== e.hash) return { ok: false, brokenAt: e.seq ?? e.id, checked };
    prev = e.hash; checked++;
  }
  return { ok: prev === db.meta.lastAuditHash, checked, lastHash: prev };
}

module.exports = { init, get, save, acquireLock, uid, nowIso, localDateKey, nextInvoiceNumber, nextOrderNumber, nextStoreOrderNumber, audit, verifyAuditChain, ROLES, SCHEMA_VERSION };
