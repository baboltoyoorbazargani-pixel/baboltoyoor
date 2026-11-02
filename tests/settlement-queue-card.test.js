'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('public/app.js','utf8'),ui=fs.readFileSync('public/ui2.js','utf8'),css=fs.readFileSync('public/compatibility.css','utf8');
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
test('صف تسویه از ردیف مشترک و دکمه انتخاب قابل دسترس استفاده می‌کند',()=>{
 const c={fa:v=>String(v).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]),esc,storeAwareOrderName:o=>o.customer?.name||o.storeName||'—',qty:String,formatDateTime24:v=>v||'—',activeItemsOf:o=>o.items||[],badge:()=>'<span>آماده تسویه</span>',stl:{orderId:'internal-id'}};vm.createContext(c);
 vm.runInContext(app.slice(app.indexOf('function orderSummaryRow('),app.indexOf('\nconst app =')),c);
 vm.runInContext(ui.slice(ui.indexOf('function settlementPendingRowsV27(rows){'),ui.indexOf('\nfunction invoiceRowsV27')),c);
 const html=c.settlementPendingRowsV27([{id:'internal-id',orderNo:'000123',status:'SETTLEMENT_PENDING',customer:{name:'مشتری <آزمایشی>'},createdAt:'تاریخ',items:[{}]}]);
 assert.match(html,/order-summary-row stl-queue-item stl-queue-item-card active/);assert.match(html,/data-stl="select" data-id="internal-id"/);assert.match(html,/مشتری &lt;آزمایشی&gt;/);assert.match(html,/شماره سفارش ۰۰۰۱۲۳/);assert.match(html,/تاریخ/);assert.match(html,/۱ قلم|1 قلم/);assert.match(html,/آماده تسویه/);
 assert.match(c.settlementPendingRowsV27([]),/سفارشی در انتظار تسویه نیست/);
});
test('فهرست تسویه امکان پیمایش افقی و همه ردیف‌ها ارتفاع ثابت دارند',()=>{
 assert.match(css, /stl-queue-panel \.stl-queue-list/);assert.match(css,/order-summary-row[\s\S]*?height:54px!important/);assert.match(css,/overflow-x:auto!important/);assert.match(css,/order-summary-actions[\s\S]*?height:36px!important/);
});
