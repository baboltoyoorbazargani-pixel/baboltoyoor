'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ui=read('public/ui2.js');
const sheet=ui.slice(ui.indexOf('function wh38Sheet(o)'),ui.indexOf('function wh38Total()'));
const css=read('public/form-layout.css');
test('warehouse preparation has four peer cells and a separate simple out-of-stock tick',()=>{
 assert.equal((sheet.match(/class="wh38-cell-box/g)||[]).length,4);
 assert.match(sheet,/class="wh38-stock-cell"[\s\S]*?<label class="wh38-oos"[^>]*><input type="checkbox"/);
 assert.doesNotMatch(sheet,/این قلم موجود نیست/);
 assert.match(sheet,/aria-label="عدم موجودی/);
 assert.match(sheet,/for="wh38-weight-/);
 assert.match(sheet,/title="\$\{esc\(it\.description/);
});
test('warehouse row uses equal width columns, 44px boxes, and scroll on narrow screens',()=>{
 assert.match(css,/grid-template-columns:28px repeat\(4,minmax\(0,1fr\)\) 76px!important/);
 assert.match(css,/\.wh38-cell-box \{[\s\S]*?height:44px!important;min-height:44px!important/);
 assert.match(css,/\.wh38-prep-items \{[\s\S]*?grid-template-columns:minmax\(920px,1fr\)!important/);
 assert.match(css,/\.wh38-prep-items \{[\s\S]*?overflow-x:auto!important/);
 assert.match(css,/\.wh38-oos \{[\s\S]*?border:0!important[\s\S]*?background:transparent!important/);
 assert.match(css,/\.wh38-oos input\[type="checkbox"\] \{[\s\S]*?width:18px!important;height:18px!important/);
});
test('weight entry and out-of-stock event mapping and finalization rules remain intact',()=>{
 assert.match(sheet,/w\.disabled=ch\.checked; if\(ch\.checked\)w\.value=''/);
 assert.match(sheet,/wh38Total\(\)/);
 const finalize=ui.slice(ui.indexOf('async function wh38Finalize(id)'),ui.indexOf('window.renderWarehouse='));
 assert.match(finalize,/deliveredKg:out\?0:n\(w\.value\), outOfStock:out/);
 assert.match(finalize,/!x\.outOfStock&&x\.deliveredKg<=0/);
 assert.match(finalize,/api\('\/api\/orders\/\s*'\+id\+'\/warehouse'/);
});
