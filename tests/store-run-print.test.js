'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {serviceDocument}=require('../lib/store-run-print');
test('سند قدیمی فقط خالص موجود را نشان می‌دهد و وزن ارسالی ناشناخته را اختراع نمی‌کند',()=>{
 const order={id:'o',orderType:'STORE',storeName:'فروشگاه'};
 const db={orderItems:[],payments:[{orderId:'o',deliveryRun:1,priceLines:[{productName:'مرغ',deliveredKg:3,returnKg:4}]}]};
 const doc=serviceDocument(db,order,1,()=>null);
 assert.deepEqual(doc.lines,[{productName:'مرغ',deliveredKg:null,returnKg:4,shortageKg:null,netKg:3}]);
 assert.equal(serviceDocument(db,order,2,()=>null),null);
});
