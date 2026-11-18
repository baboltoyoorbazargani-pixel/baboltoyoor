'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('changed application and document assets have refreshed cache keys on both page shells',()=>{
 const index=read('public/index.html');
 for(const [asset,version] of [['app.js','37.49.3'],['ui2.js','37.49.4'],['invoice-compact.css','37.3.21'],['design.css','37.48.1'],['warehouse-document.css','37.49.1'],['compatibility.css','37.49.2']])
  assert.ok(index.includes(`/${asset}?v=${version}`),`${asset} must use the refreshed cache key`);
 const invoice=read('public/invoice-print.html');
 assert.match(invoice,/href="\/design\.css\?v=37\.48\.1"/);
 assert.match(invoice,/href="\/invoice-compact\.css\?v=37\.3\.21"/,'updated invoice stylesheet uses its refreshed key');
 assert.match(read('lib/http.js'),/Cache-Control': entry\.file\.endsWith\('\.png'\) \? 'public, max-age=86400' : 'no-cache'/,'non-image static files must still revalidate even with a stable URL');
});
