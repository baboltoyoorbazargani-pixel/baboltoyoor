'use strict';
// Only server-created snapshots are selectable; no arbitrary paths or uploaded databases.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { route, fail } = require('../http');
const config = require('../config');
const store = require('../store');
const sec = require('../security');
const ADMIN = { roles: ['admin'] };
const dir = () => path.join(config.DATA_DIR, 'backups');
const namePattern = /^baboltoyor-(?:manual|before-restore)-\d{8}T\d{6}-[a-f0-9]{12}\.db$/;
function safeFile(name) {
  if (!namePattern.test(String(name))) fail(400, 'نام پشتیبان معتبر نیست.');
  const file = path.join(dir(), name);
  let st; try { st = fs.lstatSync(file); } catch { fail(404, 'پشتیبان پیدا نشد.'); }
  if (!st.isFile() || st.isSymbolicLink()) fail(400, 'فایل پشتیبان معتبر نیست.');
  return file;
}
function create(kind) {
  fs.mkdirSync(dir(), { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const name = `baboltoyor-${kind}-${stamp}-${crypto.randomBytes(6).toString('hex')}.db`;
  const file = path.join(dir(), name);
  try { store.sql.vacuumInto(file); } catch (e) { try { fs.unlinkSync(file); } catch {} throw e; }
  try { fs.chmodSync(file, 0o600); } catch { /* Windows uses directory ACLs */ }
  return name;
}
route('GET', '/api/admin/backups', ADMIN, async () => {
  fs.mkdirSync(dir(), { recursive: true, mode: 0o700 });
  const backups = fs.readdirSync(dir()).filter(n => namePattern.test(n)).flatMap(name => {
    try { const st = fs.lstatSync(path.join(dir(), name)); return st.isFile() && !st.isSymbolicLink() ? [{ name, size: st.size, createdAt: st.mtime.toISOString() }] : []; } catch { return []; }
  }).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  return { body: { backups } };
});
route('POST', '/api/admin/backups', ADMIN, async ctx => {
  const name = create('manual');
  store.audit(ctx.user, 'BACKUP_CREATED', 'backup', name, {}, ctx); store.save();
  return { status: 201, body: { name } };
});
route('GET', '/api/admin/backups/:name/download', ADMIN, async ctx => {
  const file = safeFile(ctx.params.name);
  store.audit(ctx.user, 'BACKUP_DOWNLOADED', 'backup', ctx.params.name, {}, ctx); store.save();
  return { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${ctx.params.name}"` }, stream: res => new Promise((resolve, reject) => {
    const input = fs.createReadStream(file); input.on('error', reject); res.on('close', () => { input.destroy(); resolve(); }); input.on('end', resolve); input.pipe(res, { end: false });
  }) };
});
route('POST', '/api/admin/backups/:name/restore', ADMIN, async ctx => {
  if (ctx.body.confirm !== 'RESTORE') fail(400, 'تأیید بازیابی الزامی است.');
  if (!sec.verifyPassword(String(ctx.body.password || ''), ctx.user.passwordHash)) fail(403, 'رمز مدیر صحیح نیست.');
  const file = safeFile(ctx.params.name);
  const safety = create('before-restore');
  try { store.sql.restoreSnapshot(file); store.reloadFromSql(); }
  catch (e) { fail(400, `بازیابی انجام نشد: ${e.message}. نسخهٔ پیش از بازیابی: ${safety}`); }
  // Restored user accounts and passwords replace current ones; no old sessions survive.
  sec.destroyAllSessions();
  store.audit(null, 'BACKUP_RESTORED', 'backup', ctx.params.name, { by: ctx.user.username, safety }, ctx);
  store.save();
  return { body: { ok: true, safety, message: 'بازیابی انجام شد؛ با حساب و رمز موجود در نسخهٔ پشتیبان دوباره وارد شوید.' } };
});
