'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {weighingsFor}=require('../lib/warehouse-weighing');
test('وزن خالص با دو نوع سبد و کارتن، راک، گاری و چند نوبت از گرم محاسبه می‌شود',()=>{
 const r=weighingsFor([{grossKg:'۵۰٫۵',basket18:2,basket25:1,box300:3,box600:2,rackKg:2,cartKg:4},{grossKg:10}]);
 assert.equal(r.rows[0].tareKg,14.2);assert.equal(r.rows[0].netKg,36.3);assert.equal(r.rows[1].netKg,10);assert.equal(r.netKg,46.3);assert.equal(weighingsFor(undefined),null);
 for(const x of [[{grossKg:2,basket25:1}],[{grossKg:1,cartKg:1}],[{grossKg:4,basket18:1.5}],[{grossKg:2.0001}],[{grossKg:10,rackKg:-1}],[],[{grossKg:'garbage'}]])assert.throws(()=>weighingsFor(x));
});
