'use strict';
/* v37.33.0 — برگهٔ آماده‌سازی (سرویس‌های ارسال) سفارش فروشگاه در انبار باید در عرض صفحه جا شود
   و اسکرول افقی نخواهد؛ کادر کیلوگرم و بقیهٔ کادرها جمع‌وجور و استانداردند. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ui = read('public/ui2.js');
const compat = read('public/compatibility.css');
const block = compat.slice(compat.indexOf('.sr318-rows{overflow-x:visible'));
const sheet = ui.slice(ui.indexOf('function sr38Sheet(o)'), ui.indexOf('async function sr38Post'));

test('ردیف برگهٔ سرویس حداقل‌عرض اجباری ندارد و اسکرول افقی نمی‌خواهد', () => {
  assert.match(block, /\.sr318-rows\{overflow-x:visible/, 'محفظهٔ ردیف‌ها نباید اسکرول افقی داشته باشد');
  assert.match(block, /\.sr318-row\{min-width:0;width:100%;flex-wrap:wrap/, 'ردیف باید در عرض صفحه جا شود');
  assert.match(block, /\.sr318-sendline\{flex-wrap:wrap;overflow-x:visible/, 'نوار ارسال سرویس‌ها هم نباید اسکرول افقی بخواهد');
});

test('کادر کیلوگرم و بقیهٔ کنترل‌ها جمع‌وجور و هم‌اندازه‌اند', () => {
  // علت درازی کادر وزن، width:100% قاعدهٔ عمومی wh38-cell-box بود؛ اینجا خنثی شده است
  assert.match(block, /\.sr318-wbox\.wh38-cell-box\{width:auto!important;height:30px!important/, 'کادر کیلوگرم نباید کشیده شود');
  assert.match(block, /\.sr318-wbox input\{width:58px;height:28px/, 'ورودی وزن باید جمع‌وجور باشد');
  assert.match(block, /\.sr318-ops \.btn\{height:30px;min-height:30px!important;padding:3px 8px/, 'دکمه‌ها باید کوچک و هم‌ارتفاع باشند');
  assert.match(block, /\.sr318-name\{flex:1 1 110px;min-width:90px;max-width:160px/, 'نام محصول سقف عرض دارد');
});

test('برچسب‌های طولانی دکمه‌ها کوتاه شده‌اند تا ردیف در صفحه جا شود', () => {
  assert.match(sheet, /ثبت وزن<\/button>/, 'دکمهٔ ثبت وزن باید کوتاه باشد');
  assert.doesNotMatch(sheet, /ثبت وزن سرویس \$\{/, 'نام سرویس روی دکمه تکرار نشود؛ سرگروه سرویس را مشخص می‌کند');
  assert.doesNotMatch(sheet, /انتقال به سرویس دوم/, 'برچسب انتقال باید کوتاه باشد');
  assert.match(sheet, /سرویس دوم<\/button>/);
  // عملکردها سر جایشان‌اند
  for (const a of ['sr38-weight', 'sr38-move', 'sr38-complete', 'sr38-oos'])
    assert.ok(sheet.includes(`data-action="${a}"`), `عملیات ${a} حذف شده است`);
});
