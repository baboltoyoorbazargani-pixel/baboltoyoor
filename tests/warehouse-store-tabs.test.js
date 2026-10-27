'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ui=read('public/ui2.js'),css=read('public/theme.css');

test('انبار > فروشگاه‌ها: سه سربرگ افقی (با «سوابق و گزارشات» از v37.36.0) و فقط پنل فعال، با فهرست عمودی',()=>{
  const paint=ui.slice(ui.indexOf('async function wh38Paint(phase)'),ui.indexOf('function wh38Shell(phase)'));
  assert.match(paint,/phase==='stores'/);
  assert.match(paint,/\['incoming','preparing','history'\]\.includes\(app\.wh38\.storeTab\)/);
  assert.match(paint,/wh38StoreTabs\(active,counts\)/);
  assert.match(paint,/data-wh38-store-panel="\$\{active\}"/);
  assert.match(paint,/rows\.length\?wh38StoreList\(rows,active\):empty/);
  // هر دو بخش هم‌زمان روی هم چیده نمی‌شوند
  assert.doesNotMatch(paint,/wh38-section-subtitle|incomingList\+preparingList/);
  const tabs=ui.slice(ui.indexOf('function wh38StoreTabs'),ui.indexOf('function wh38StoreHeader'));
  assert.deepEqual([...tabs.matchAll(/\['(incoming|preparing|history)','([^']+)'\]/g)].map(x=>x[2]),['ورودی','آماده‌سازی و سرویس‌ها','سوابق و گزارشات']);
  assert.match(tabs,/data-wh38-store-tab="\$\{id\}"/);
  assert.match(ui,/e\.target\.closest\('\[data-wh38-store-tab\]'\)/);
  assert.match(ui,/app\.wh38\.storeTab=\['incoming','preparing','history'\]\.includes\(st\.dataset\.wh38StoreTab\)\?st\.dataset\.wh38StoreTab:'incoming'; wh38Paint\('stores'\)/);
  assert.match(css,/\.wh38-store-tabs\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.wh38-store-list\{display:flex;flex-direction:column/);
  // تایمر ۷ ثانیه‌ای همان تابع paint را صدا می‌زند؛ انتخاب سربرگ در state می‌ماند
  assert.match(ui,/app\.wh38 = app\.wh38 \|\| \{ phase:'incoming', timer:null, storeTab:'incoming' \}/);
});

test('سربرگ خلاصهٔ سفارش فروشگاه تک‌خطی است: شماره، فروشگاه، اقلام و زمان — بدون خلاصهٔ چهارخانه و خط تماس جدا',()=>{
  const header=ui.slice(ui.indexOf('function wh38StoreHeader(o)'),ui.indexOf('function wh38StoreList(orders,kind)'));
  assert.match(header,/class="wh38-store-head"/);
  assert.match(header,/orderNo/);
  assert.match(header,/activeItemsOf\(o\)\.length/);
  assert.match(header,/formatDateTime24\(o\.createdAt\)/);
  assert.doesNotMatch(header,/wh38-incoming-cell|wh38-incoming-summary|wh38-incoming-contact|<h3/);
  // مشخصات کامل‌تر فقط در title (راهنما) می‌ماند، نه در ارتفاع کارت
  assert.match(header,/آخرین اقدام/);
  assert.match(header,/title="\$\{esc\(tip\)\}"/);
  assert.match(css,/\.wh38-store-head\{display:flex;align-items:center;[^}]*min-height:26px/);
  assert.match(css,/\.wh38-store-name\{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis/);
  assert.match(css,/\.wh38-store-card\{[^}]*padding:8px 11px/);
});

test('کارت فروشگاه انبار فرم عمودی و اقدام‌های قبلی را حفظ می‌کند و برگهٔ سرویس‌ها هم سربرگ خلاصه دارد',()=>{
  const list=ui.slice(ui.indexOf('function wh38StoreList(orders,kind)'),ui.indexOf('function wh38List(orders,kind)'));
  assert.match(list,/class="wh38-store-list"/);
  assert.match(list,/\$\{wh38StoreHeader\(o\)\}/);
  // v37.33.0 — کارت ورودی فقط جزئیات دارد؛ تأیید در انتهای مودال جزئیات است
  assert.match(list,/data-action="wh38-store-details"/);
  const incomingSeg=list.slice(list.indexOf("if(kind==='incoming')"),list.indexOf('${wh38StoreHeader(o)}'));
  assert.doesNotMatch(incomingSeg,/data-action="wh38-accept"|wh38-items|wh38StoreHeader/);
  assert.match(list,/data-action="wh38-start"/);
  assert.match(list,/sr38Chips\(o\)/);
  const sheet=ui.slice(ui.indexOf('function sr38Sheet(o)'),ui.indexOf('async function sr38Post'));
  assert.match(sheet,/wh38-store-sheet-head">\$\{wh38StoreHeader\(o\)\}/);
  assert.doesNotMatch(sheet,/orderCustomerStripHtml\(o\)/);
  // بازگشت از برگهٔ سرویس‌ها به همان منوی فروشگاه (سربرگ آماده‌سازی) برمی‌گردد
  assert.match(ui,/a==='sr38-back'\)\{ if\(app\.wh38\.phase==='stores'\)\{app\.wh38\.storeTab='preparing'; wh38Shell\('stores'\);\}else wh38Shell\('preparing'\); \}/);
  // تأیید دریافت در سربرگ ورودی فروشگاه، همان سربرگ را تازه می‌کند
  const accept=ui.slice(ui.indexOf("if(a==='wh38-accept')"),ui.indexOf("else if(a==='wh38-start')"));
  assert.match(accept,/app\.wh38\.phase==='incoming'\)wh38Shell\('incoming'\)/);
  assert.match(accept,/app\.wh38\.phase==='stores'\)wh38Paint\('stores'\)/);
});

test('سربرگ خلاصه از نظر XSS ایمن است و اقلام لغوشده را نمی‌شمارد',()=>{
  const header=ui.slice(ui.indexOf('function wh38StoreHeader(o)'),ui.indexOf('function wh38StoreList(orders,kind)'));
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const c={esc,fa:v=>String(v).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]),qty:String,
    storeAwareOrderName:o=>o?.orderType==='STORE'?(o.storeName||'فروشگاه'):(o?.customer?.name||'—'),
    activeItemsOf:o=>(o.items||[]).filter(i=>i.itemStatus!=='CANCELLED'),
    formatDateTime24:s=>s||'—',badge:()=>'[badge]'};
  vm.createContext(c);vm.runInContext(header,c);
  const html=c.wh38StoreHeader({orderType:'STORE',storeName:'<img "x">',orderNo:'B410001',createdAt:'2026-10-14T08:30',dispatchPlace:'بابل',items:[{},{itemStatus:'CANCELLED'}]});
  assert(!html.includes('<img')); assert(html.includes('&lt;img &quot;x&quot;&gt;'));
  assert.match(html,/1 قلم/); assert.match(html,/بابل/);
  assert.equal((html.match(/wh38-store-head/g)||[]).length,1);
});
