'use strict';
/* v37.33.0 — ۱) ردیف اقلام جزئیات فروشگاه در انبار: محصول/مقدار/واحد/توضیحات تک‌خطی در کادرهای جدا و هم‌اندازه
   ۲) کارت آماده‌سازی فقط فروشگاه، مشتری و تعداد اقلام + جزئیات (نمایش کامل و ثبت وزن)
   ۳) برگهٔ سرویس بدون «تصمیم پایان روز»؛ بستن هر محصول با «تکمیل محصول» و اندازه‌های استاندارد کادرها */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ui = read('public/ui2.js');
const compat = read('public/compatibility.css');

const details = ui.slice(ui.indexOf('async function wh38StoreDetails'), ui.indexOf('function wh38List(orders,kind)'));
const list = ui.slice(ui.indexOf('function wh38StoreList(orders,kind)'), ui.indexOf('/* v37.22.0 — جزئیات کامل'));
const sheet = ui.slice(ui.indexOf('function sr38Sheet(o)'), ui.indexOf('async function sr38Post'));

test('ردیف جزئیات: محصول، مقدار، واحد و توضیحات در یک خط و هرکدام در کادر جدا و هم‌اندازه', () => {
  // v37.35.0 — به درخواست کاربر فرم کوتاه شد: برچسب هر ستون فقط در سطر عنوان می‌آید و
  // داخل کادرها فقط مقدار است؛ کادرهای جدا و تک‌خطی‌بودن ردیف (قرارداد 37.23) سر جایش است.
  assert.match(details, /class="whd23-list whd35-list"/);
  assert.match(details, /whd35-headrow"[^>]*><span><\/span><span>محصول<\/span><span>مقدار<\/span><span>واحد<\/span><span>توضیحات<\/span>/, 'برچسب ستون‌ها باید در سطر عنوان باشد');
  assert.match(details, /class="whd23-box whd23-product"><b title=/);
  assert.match(details, /class="whd23-box"><b>\$\{qty\(it\.requestedQty\)\}<\/b>/);
  assert.match(details, /class="whd23-box whd23-desc"><b title=/);
  assert.doesNotMatch(details, /<label>محصول<\/label>/, 'برچسب داخل کادر ارتفاع را زیاد می‌کرد و حذف شد');
  assert.doesNotMatch(details, /detail-item-row/, 'ردیف قدیمی دولایه نباید بماند');
  assert.match(compat, /\.whd23-row\{display:grid;grid-template-columns:28px 1\.5fr \.55fr \.55fr 1\.5fr;[^}]*align-items:stretch/, 'ردیف باید تک‌خطی با ستون‌های منظم باشد');
  assert.match(compat, /\.whd23-box\{[^}]*border:1px solid[^}]*border-radius:10px[^}]*min-height:46px/, 'هر فیلد کادر جدا با ارتفاع یکسان می‌خواهد');
  assert.match(compat, /\.whd35-list \.whd23-box\{min-height:33px/, 'در فرم فشرده ارتفاع کادرها کمتر است');
  assert.doesNotMatch(details, /detail-modal-grid/, 'شبکهٔ شش‌خانهٔ بلند حذف شده است');
});

test('کارت آماده‌سازی فقط فروشگاه، مشتری و تعداد اقلام را با دکمهٔ جزئیات نشان می‌دهد', () => {
  const prep = list.slice(list.indexOf("if(kind==='preparing')"), list.indexOf('return `<div class="wh38-store-list">${orders.map((o,i)'));
  assert.match(prep, /whsin22-store[^>]*>\$\{esc\(o\.storeName\|\|'فروشگاه'\)\}/, 'نام فروشگاه نیست');
  assert.match(prep, /مشتری: \$\{esc\(o\.customer\?\.name\|\|'—'\)\}/, 'نام مشتری نیست');
  assert.match(prep, /whprep23-count order-summary-cell">\$\{qty\(activeItemsOf\(o\)\.length\)\} قلم/, 'تعداد اقلام نیست');
  assert.match(prep, /data-action="wh38-start" data-id="\$\{o\.id\}">\$\{icon\('eye',14\)\} جزئیات</, 'دکمهٔ جزئیات نیست');
  // اطلاعات مشترک شماره، تاریخ و وضعیت اضافه شده‌اند؛ جزئیات اقلام همچنان در برگه است.
  assert.match(prep, /orderNo/);assert.match(prep, /formatDateTime24/);assert.match(prep, /badge\(o\.status\)/);
  assert.doesNotMatch(prep, /wh38-items|wh38StoreHeader|sr38Chips|wh38-no/);
  // جزئیات همان برگهٔ کاملِ ثبت وزن را باز می‌کند (مسیر قبلی wh38-start)
  assert.match(ui, /else if\(a==='wh38-start'\)\{ el\.disabled=true; const r=await api\('\/api\/orders\/'\+id\+'\/warehouse\/start-preparing'/);
  assert.match(ui, /if\(r\.order&&r\.order\.storeRun&&r\.order\.storeRun\.enabled\) sr38Sheet\(r\.order\); else wh38Sheet\(r\.order\);/);
});

test('برگهٔ سرویس: تصمیم پایان روز حذف شده، تکمیل محصول می‌بندد و کادرها اندازهٔ استاندارد دارند', () => {
  assert.doesNotMatch(sheet, /data-sr38-decision|تصمیم پایان روز/, 'تصمیم پایان روز نباید در ردیف باشد');
  assert.match(sheet, /data-action="sr38-complete"[^>]*>[\s\S]*?تکمیل محصول/, 'دکمهٔ تکمیل محصول باید بماند');
  assert.match(sheet, /data-action="sr38-weight"/);
  const fin = ui.slice(ui.indexOf('async function sr38Finalize'), ui.indexOf('window.renderWarehouse'));
  assert.match(fin, /\[data-sr318-row\]/, 'پایان عملیات باید اقلام باز را بشمارد');
  assert.match(fin, /تکمیل محصول/, 'راهنمای بستن قلم با تکمیل محصول نیست');
  assert.match(fin, /finalize-day',\{method:'POST',body:JSON\.stringify\(\{decisions:\[\]\}\)\}/, 'پایان عملیات بدون تصمیم ارسال می‌شود');
  // اندازه‌های استاندارد: ردیف حداکثر ۹۶۰px، کنترل‌های هم‌ارتفاع ۳۲px
  assert.match(compat, /\.sr318-row\{min-width:0;width:100%/, 'ردیف باید در عرض صفحه جا شود و طول اجباری نداشته باشد');
  assert.match(compat, /\.sr318-ops \.btn\{height:30px;min-height:30px!important/, 'دکمه‌های ردیف باید هم‌اندازه و جمع‌وجور باشند');
  assert.match(compat, /\.sr318-wbox input\{width:58px/, 'کادر وزن باید جمع‌وجور باشد و کشیده نشود');
});
