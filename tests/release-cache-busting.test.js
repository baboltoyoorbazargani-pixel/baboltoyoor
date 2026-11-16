'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('changed application and document assets have refreshed cache keys on both page shells',()=>{
 const index=read('public/index.html');
 for(const asset of ['app.js','ui2.js','design.css','warehouse-document.css'])
  assert.match(index,new RegExp(`(?:src|href)="/${asset}\\?v=37\\.48\\.1"`),`${asset} must use the refreshed cache key`);
 const invoice=read('public/invoice-print.html');
 assert.match(invoice,/href="\/design\.css\?v=37\.48\.1"/);
 assert.match(invoice,/href="\/invoice-compact\.css\?v=37\.3\.18"/,'unchanged invoice stylesheet keeps its existing key');
 assert.match(read('lib/http.js'),/Cache-Control': entry\.file\.endsWith\('\.png'\) \? 'public, max-age=86400' : 'no-cache'/,'non-image static files must still revalidate even with a stable URL');
});
