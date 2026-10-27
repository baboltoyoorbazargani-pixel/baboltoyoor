'use strict';
/* v37.33.0 — کارتابل انبار، منوی فروشگاه، سربرگ ورودی:
   کارت فقط نام فروشگاه، نام مشتری، شمارهٔ سفارش و تاریخ/ساعت + دکمهٔ جزئیات؛
   فهرست کامل در جزئیات می‌آید و تأیید در پایان فهرست، سفارش را وارد آماده‌سازی می‌کند. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ui = read('public/ui2.js');

const list = ui.slice(ui.indexOf('function wh38StoreList(orders,kind)'), ui.indexOf('/* v37.33.0 — جزئیات کامل'));
const details = ui.slice(ui.indexOf('async function wh38StoreDetails'), ui.indexOf('function wh38List(orders,kind)'));

test('کارت ورودی فقط فروشگاه، مشتری، شماره سفارش و تاریخ/ساعت را با دکمهٔ جزئیات نشان می‌دهد', () => {
  const incoming = list.slice(list.indexOf("if(kind==='incoming')"), list.indexOf("if(kind==='preparing')"));
  assert.match(incoming, /whsin22-store[^>]*>\$\{esc\(o\.storeName\|\|'فروشگاه'\)\}/, 'نام فروشگاه روی کارت نیست');
  assert.match(incoming, /whsin22-customer">مشتری: \$\{esc\(o\.customer\?\.name\|\|'—'\)\}/, 'نام مشتری روی کارت نیست');
  assert.match(incoming, /شماره سفارش \$\{esc\(fa\(o\.orderNo/, 'شماره سفارش روی کارت نیست');
  assert.match(incoming, /formatDateTime24\(o\.createdAt\)/, 'تاریخ و ساعت روی کارت نیست');
  assert.match(incoming, /data-action="wh38-store-details"/, 'دکمهٔ جزئیات روی کارت نیست');
  // روی کارت ورودی نه فهرست اقلام هست، نه دکمهٔ تأیید و نه سربرگ قدیمی
  assert.doesNotMatch(incoming, /wh38-items|data-action="wh38-accept"|wh38StoreHeader|activeItemsOf/);
  const css = read('public/compatibility.css').slice(read('public/compatibility.css').indexOf('whsin22'));
  assert.match(css, /\.whsin22-card\.wh38-store-card\{display:flex;flex-direction:row;align-items:center;flex-wrap:nowrap/);
  assert.match(css, /min-height:52px/);
});

test('جزئیات، فهرست کامل اقلام را نشان می‌دهد و تأیید در پایان فهرست است', () => {
  assert.match(details, /activeItemsOf\(o\)/);
  assert.match(details, /class="whd23-list whd35-list"/, 'فهرست اقلام در جزئیات نیست'); // v37.35.0 — فرم فشرده
  assert.match(details, /class="whd23-box whd23-product"/, 'کادر محصول در ردیف جزئیات نیست');
  assert.match(details, /it\.product\?\.name/);
  assert.match(details, /qty\(it\.requestedQty\)/);
  assert.match(details, /o\.customer\?\.name/, 'نام مشتری در جزئیات نیست');
  const listPos = details.indexOf('class="whd23-list');
  const acceptPos = details.indexOf('data-action="wh38-accept-details"');
  assert.ok(listPos >= 0 && acceptPos > listPos, 'دکمهٔ تأیید باید بعد از فهرست اقلام (پایان فهرست) باشد');
  assert.match(details, /تأیید دریافت و ورود به آماده‌سازی/);
  assert.match(details, /o\.status==='WAREHOUSE_PENDING'/, 'تأیید فقط برای سفارشِ در صف ورودی فعال است');
});

test('تأیید از جزئیات همان مسیر ورود به آماده‌سازی را صدا می‌زند و فهرست تازه می‌شود', () => {
  assert.match(details, /async function wh38AcceptFromDetails\(id,btn\)/);
  assert.match(details, /api\('\/api\/orders\/'\+id\+'\/warehouse\/accept',\{method:'POST'\}\)/);
  assert.match(details, /closeModal\(\)/);
  assert.match(details, /app\.wh38\.phase==='stores'\) wh38Paint\('stores'\)/);
  // هندلر دکمهٔ جزئیات روی کارت و هندلر تأیید داخل مودال
  assert.match(ui, /else if\(a==='wh38-store-details'\)\{ wh38StoreDetails\(id\); \}/);
  assert.match(read('public/app.js'), /if\(a==='wh38-accept-details'\)return wh38AcceptFromDetails\(el\.dataset\.id,el\)/);
  // سربرگ آماده‌سازی دست نخورده است: برگهٔ سرویس‌ها با همان دکمه باز می‌شود
  const preparing = list.slice(list.indexOf('return `<div class="wh38-store-list">'));
  assert.match(preparing, /data-action="wh38-start"/);
  assert.match(preparing, /sr38Chips\(o\)/);
});
