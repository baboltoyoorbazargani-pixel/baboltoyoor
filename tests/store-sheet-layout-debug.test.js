'use strict';
/* v37.33.0 — عیب‌یابی واقعی برگهٔ سرویس با مرورگر: ردیف اسیر گرید عمومی فرم‌ها بود
   (display:grid با ستون‌های مساوی و ستون ۷۶px برای دکمه‌ها؛ ارتفاع ردیف ۱۹۲px).
   این تست‌ها قفل می‌کنند که override قطعی با اولویت بالاتر سر جایش بماند. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const compat = read('public/compatibility.css');
const block = compat.slice(compat.indexOf('v37.33.0'));

test('ردیف برگهٔ سرویس از گرید عمومی فرم‌ها آزاد و فلکس تک‌خطی قطعی است', () => {
  assert.match(block, /#appView #content \.wh38-prep-item\.sr318-row\{display:flex!important;grid-template-columns:none!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important/);
  assert.match(block, /\.sr318-row>\.sr318-ops\{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;[^}]*margin-inline-start:auto!important/, 'دکمه‌ها نباید ستونی شوند');
  assert.match(block, /\.sr318-row>\.sr318-num\{margin:0!important\}/, 'حاشیهٔ ۳۵px قدیمی نشان ردیف نباید ارتفاع ردیف را بلند کند');
  assert.match(block, /\.sr318-wbox input\{height:26px!important/, 'ورودی وزن نباید ۴۴px عمومی فرم‌ها را بگیرد');
  // بلاک اصلاحی باید بعد از همهٔ لایه‌های قبلی sr318 بیاید تا برندهٔ نهایی باشد
  assert.ok(compat.indexOf('v37.33.0') > compat.indexOf('v37.24.0'), 'ترتیب بلوک‌های اصلاحی به‌هم ریخته است');
  assert.ok(compat.indexOf('v37.24.0') > compat.indexOf('v37.18.0'), 'ترتیب بلوک‌های اصلاحی به‌هم ریخته است');
});

test('در صفحهٔ باریک دکمه‌ها منظم به خط دوم می‌روند، نه اسکرول افقی', () => {
  assert.match(block, /@media \(max-width:1150px\)\{\s*#appView #content \.wh38-prep-item\.sr318-row\{flex-wrap:wrap!important\}/);
  assert.match(block, /\.sr318-row>\.sr318-ops\{flex:1 1 100%!important/);
});
