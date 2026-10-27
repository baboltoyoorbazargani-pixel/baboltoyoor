'use strict';
// لایهٔ ذخیرهسازی SQL (SQLite) — منبع اصلی دادههای سامانه.
// از node:sqlite داخلی Node.js >= 22.5 استفاده میکند؛ هیچ وابستگی خارجی ندارد.
// هر موجودیت جدول خودش را دارد؛ ستونهای پرکاربرد واقعی و ایندکسهستند و
// رکورد کامل هم در ستون payload (JSON) نگهداری میشود تا هیچ فیلدی گم نشود.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const log = require('./logger');

const SQL_SCHEMA_VERSION = 1;
const DB_BASENAME = 'baboltoyoor.db';

function dbFile() { return config.SQLITE_FILE || path.join(config.DATA_DIR, DB_BASENAME); }
function legacyJsonFile() { return path.join(config.DATA_DIR, 'db.json'); }

// ---------------------------------------------------------------- schema spec
// id: تابعی که شناسهٔ پایدار رکورد را برمیگرداند (برای diff/txn لازم است).
// cols: ستونهای واقعی SQL ← کلید فیلد در رکورد. مقادیر مرکب به JSON تبدیل میشوند.
const TABLES = [
  { key: 'roles',            table: 'roles',            id: (r) => r.code,  cols: { title: 'title' }, indexes: [] },
  { key: 'users',            table: 'users',            id: (r) => r.id,    cols: { username: 'username', role_code: 'roleCode', full_name: 'fullName', is_active: 'isActive', must_change_password: 'mustChangePassword' }, indexes: ['username', 'role_code'] },
  { key: 'customers',        table: 'customers',        id: (r) => r.id,    cols: { name: 'name', phone: 'phone', code: 'code', is_active: 'isActive' }, indexes: ['code', 'phone'] },
  { key: 'drivers',          table: 'drivers',          id: (r) => r.id,    cols: { name: 'name', phone: 'phone', is_active: 'isActive', plate_no: 'plateNo' }, indexes: ['name'] },
  { key: 'dispatchReturns',  table: 'dispatch_returns', id: (r) => r.id,    cols: { order_id: 'orderId', order_no: 'orderNo', status: 'status' }, indexes: ['order_id'] },
  { key: 'paymentDevices',   table: 'payment_devices',  id: (r) => r.id,    cols: { title: 'title', terminal_number: 'terminalNumber', is_active: 'isActive' }, indexes: ['terminal_number'] },
  { key: 'visits',           table: 'visits',           id: (r) => r.id,    cols: { customer_id: 'customerId', status: 'status', visit_no: 'visitNo', gate_exit_at: 'gateExitAt' }, indexes: ['customer_id', 'status'] },
  { key: 'orders',           table: 'orders',           id: (r) => r.id,    cols: { order_no: 'orderNo', customer_id: 'customerId', status: 'status', order_type: 'orderType', source: 'source', approval_status: 'approvalStatus', scheduled_date: 'scheduledDate' }, indexes: ['order_no', 'customer_id', 'status'] },
  { key: 'orderItems',       table: 'order_items',      id: (r) => r.id,    cols: { order_id: 'orderId', product_id: 'productId', description: 'description', quantity: 'quantity' }, indexes: ['order_id', 'product_id'] },
  { key: 'payments',         table: 'payments',         id: (r) => r.id,    cols: { order_id: 'orderId', amount: 'amount', method: 'method', invoice_number: 'invoiceNumber' }, indexes: ['order_id', 'invoice_number'] },
  { key: 'notifications',    table: 'notifications',    id: (r) => r.id,    cols: { user_id: 'userId', is_read: 'isRead', type: 'type' }, indexes: ['user_id'] },
  { key: 'products',         table: 'products',         id: (r) => r.id,    cols: { quick_code: 'quickCode', name: 'name', is_active: 'isActive', default_unit: 'defaultUnit' }, indexes: ['quick_code', 'name'] },
  { key: 'priceList',        table: 'price_list',       id: (r) => r.id,    cols: { product_id: 'productId', price: 'price', date: 'date', unit: 'unit' }, indexes: ['product_id', 'date'] },
  { key: 'audit',            table: 'audit',            id: (r) => r.id,    cols: { seq: 'seq', action: 'action', entity_type: 'entityType', entity_id: 'entityId', user_id: 'userId', username: 'username' }, indexes: ['seq', 'action', 'entity_id'] },
  { key: 'idempotency',      table: 'idempotency',      id: (r) => `${r.key || ''}|${r.userId || ''}|${r.route || ''}|${r.createdAt || ''}`, cols: { idem_key: 'key', user_id: 'userId', route: 'route' }, indexes: ['idem_key'] },
];

const NUMERIC = new Set(['seq', 'quantity', 'amount', 'price', 'is_active', 'is_read', 'must_change_password']);

let conn = null;
// آخرین وضعیت ذخیرهشده (collection -> Map<id, payload>) برای UPDATE/DELETE افزایشی
const state = new Map();

function scalar(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'string') return v;
  return JSON.stringify(v);
}
function numeric(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function columnValue(col, rec) {
  const src = rec[col.src];
  return NUMERIC.has(col.name) ? numeric(src) : scalar(src);
}
function createdAt(rec) {
  const v = rec.createdAt ?? rec.created_at ?? rec.date ?? null;
  return v === undefined ? null : scalar(v);
}
function rowsOf(records, spec) {
  const seen = new Set();
  const out = [];
  (Array.isArray(records) ? records : []).forEach((rec, i) => {
    let id = scalar(spec.id(rec));
    if (id === null || id === '') id = `row-${i}`;
    id = String(id);
    if (seen.has(id)) id = `${id}#${i}`;
    seen.add(id);
    out.push({ id, record: rec, payload: JSON.stringify(rec) });
  });
  return out;
}

// ------------------------------------------------------------------ connection
function init() {
  if (conn) return conn;
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  conn = new DatabaseSync(dbFile());
  conn.exec('PRAGMA journal_mode = WAL;');
  conn.exec('PRAGMA synchronous = FULL;');
  conn.exec('PRAGMA foreign_keys = ON;');
  conn.exec('PRAGMA busy_timeout = 5000;');
  createSchema();
  return conn;
}

function createSchema() {
  const stmts = [];
  for (const spec of TABLES) {
    const cols = [
      'id TEXT PRIMARY KEY',
      'created_at TEXT',
      ...Object.keys(spec.cols).map((name) => `${name} ${NUMERIC.has(name) ? 'NUMERIC' : 'TEXT'}`),
      'payload TEXT NOT NULL',
    ];
    stmts.push(`CREATE TABLE IF NOT EXISTS ${spec.table} (${cols.join(', ')})`);
    for (const c of spec.indexes) {
      stmts.push(`CREATE INDEX IF NOT EXISTS idx_${spec.table}_${c} ON ${spec.table} (${c})`);
    }
  }
  stmts.push('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  stmts.push('CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, value NUMERIC NOT NULL)');
  stmts.push('CREATE TABLE IF NOT EXISTS schema_info (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  conn.exec(stmts.join(';\n') + ';');
  conn.prepare('INSERT OR REPLACE INTO schema_info (key, value) VALUES (?, ?)').run('version', String(SQL_SCHEMA_VERSION));
}

function isEmpty() {
  const row = conn.prepare('SELECT COUNT(*) AS n FROM meta').get();
  return Number(row.n) === 0;
}

// ----------------------------------------------------------------------- load
function load() {
  const out = { meta: {}, counters: {} };
  state.clear();
  for (const spec of TABLES) {
    const rows = conn.prepare(`SELECT id, payload FROM ${spec.table}`).all();
    out[spec.key] = rows.map((r) => JSON.parse(r.payload));
    state.set(spec.key, new Map(rows.map((r) => [String(r.id), r.payload])));
  }
  for (const r of conn.prepare('SELECT key, value FROM meta').all()) {
    try { out.meta[r.key] = JSON.parse(r.value); } catch { out.meta[r.key] = r.value; }
  }
  for (const r of conn.prepare('SELECT key, value FROM counters').all()) out.counters[r.key] = Number(r.value);
  return isEmpty() ? null : out;
}

// ----------------------------------------------------------------------- save
function upsertSql(spec) {
  const names = Object.keys(spec.cols);
  const all = ['id', 'created_at', ...names, 'payload'];
  const marks = all.map(() => '?').join(', ');
  return `INSERT OR REPLACE INTO ${spec.table} (${all.join(', ')}) VALUES (${marks})`;
}
function bindRow(spec, row) {
  const values = [row.id, createdAt(row.record)];
  for (const [name, src] of Object.entries(spec.cols)) values.push(columnValue({ name, src }, row.record));
  values.push(row.payload);
  return values;
}

function save(data) {
  if (!conn) init();
  const upserts = new Map();
  const deletes = new Map();
  for (const spec of TABLES) upserts.set(spec.key, upsertSql(spec));
  for (const spec of TABLES) deletes.set(spec.key, `DELETE FROM ${spec.table} WHERE id = ?`);

  conn.exec('BEGIN IMMEDIATE');
  try {
    for (const spec of TABLES) {
      const rows = rowsOf(data[spec.key], spec);
      const current = new Map(rows.map((r) => [r.id, r.payload]));
      const previous = state.get(spec.key) || new Map();
      const up = conn.prepare(upserts.get(spec.key));
      for (const row of rows) {
        if (previous.get(row.id) === row.payload) continue;
        up.run(...bindRow(spec, row));
      }
      const del = conn.prepare(deletes.get(spec.key));
      for (const id of previous.keys()) if (!current.has(id)) del.run(id);
      state.set(spec.key, current);
    }
    // meta / counters کوچکاند؛ در همان تراکنش بازنویسی میشوند
    conn.exec('DELETE FROM meta');
    const putMeta = conn.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(data.meta || {})) putMeta.run(k, JSON.stringify(v));
    conn.exec('DELETE FROM counters');
    const putCounter = conn.prepare('INSERT INTO counters (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(data.counters || {})) putCounter.run(k, Number(v) || 0);
    conn.exec('COMMIT');
  } catch (e) {
    try { conn.exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

// -------------------------------------------------- migration from legacy JSON
function readLegacyJson() {
  const file = legacyJsonFile();
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch (e) {
    throw new Error(`فایل قدیمی db.json قابل خواندن نیست (${file}): ${e.message}`);
  }
}
function archiveLegacyJson() {
  const file = legacyJsonFile();
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = `${file}.migrated-${stamp}`;
  fs.renameSync(file, dest);
  log.info('store', 'legacy JSON archived after SQL migration', { file: dest });
  return dest;
}

// ------------------------------------------------------------ SQL query helper
// فقط خواندنی؛ برای CLI، گزارشگیری و ابزارهای BI.
function query(sql, params = []) {
  if (!conn) init();
  const trimmed = String(sql).trim();
  if (!/^(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(trimmed) || /;/.test(trimmed.replace(/;\s*$/, ''))) {
    throw new Error('فقط پرسوجوهای خواندنی SELECT/PRAGMA/WITH/EXPLAIN مجاز هستند.');
  }
  if (!Array.isArray(params) || params.some((p) => typeof p === 'object' && p !== null && !(p instanceof Uint8Array))) {
    throw new Error('پارامترهای پرسوجو باید اسکالر باشند.');
  }
  return conn.prepare(trimmed).all(...params);
}
function tables() {
  if (!conn) init();
  return conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
}
function stats() {
  if (!conn) init();
  const out = {};
  for (const t of tables()) {
    if (t === 'schema_info') continue;
    out[t] = Number(conn.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n);
  }
  return out;
}
function vacuumInto(dest) {
  if (!conn) init();
  const safe = String(dest).replace(/'/g, "''");
  conn.exec(`VACUUM INTO '${safe}'`);
  return dest;
}
function close() {
  if (conn) { try { conn.close(); } catch { /* ignore */ } conn = null; }
  state.clear();
}

module.exports = {
  init, load, save, isEmpty, readLegacyJson, archiveLegacyJson,
  query, tables, stats, vacuumInto, close, dbFile,
  DB_BASENAME, SQL_SCHEMA_VERSION, TABLES,
};
