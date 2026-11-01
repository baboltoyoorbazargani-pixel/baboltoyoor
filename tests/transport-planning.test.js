'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
process.env.BT_EXPERIMENTAL_TRANSPORT_WORKFLOW='1';
const {deliveryFields,assignment}=require('../lib/transport-planning');
test('روش تحویل و تخصیص مستقل از وزن و بدون تغییر سوابق',()=>{
 assert.throws(()=>deliveryFields({transportWorkflow:true},'REMOTE',null),/روش تحویل/);
 assert.throws(()=>deliveryFields({transportWorkflow:true,deliveryMode:'DELIVERY'},'REMOTE',{amount:1}),/بیعانه/);
 assert.equal(deliveryFields({transportWorkflow:true},'STORE',null).deliveryMode,'DELIVERY');
 assert.deepEqual(deliveryFields({},'REMOTE',null),{});
 const order={id:'o',orderType:'REMOTE',status:'WAREHOUSE_PENDING',...deliveryFields({transportWorkflow:true,deliveryMode:'DELIVERY'},'REMOTE',null)};
 const driver={id:'d',fullName:'راننده',phone:'09121112233',isActive:true},vehicle={id:'v',kind:'fleet',vehicleType:'وانت',plate:'12ب34567',isActive:true};
 const next=assignment(order,0,driver,vehicle,{id:'u'},'2026-01-01');assert.equal(order.transportAssignments['0'],undefined);order.transportAssignments=next;
 driver.fullName='نام تازه';vehicle.plate='22ب34567';assert.equal(next['0'].driverName,'راننده');assert.equal(next['0'].vehiclePlate,'12ب34567');
 assert.equal(assignment(order,0,driver,vehicle,{id:'u'},'2026-01-02'),order.transportAssignments);
 order.transportAssignments['0'].departedAt='2026-01-03';assert.throws(()=>assignment(order,0,driver,{...vehicle,id:'v2'},{id:'u'},'x'),/پس از خروج/);
 assert.throws(()=>assignment({...order,status:'SCHEDULED_REMOTE'},0,driver,vehicle,{id:'u'},'x'),/وضعیت/);
 assert.throws(()=>assignment({...order,transportAssignments:{}},0,{...driver,isActive:false},vehicle,{id:'u'},'x'),/فعال/);
});
test('کد ناتمام به‌صورت پیش‌فرض غیرفعال است',()=>{
 const before=process.env.BT_EXPERIMENTAL_TRANSPORT_WORKFLOW;delete process.env.BT_EXPERIMENTAL_TRANSPORT_WORKFLOW;
 try{assert.throws(()=>deliveryFields({transportWorkflow:true,deliveryMode:'DELIVERY'},'REMOTE',null),e=>e.status===503);assert.deepEqual(deliveryFields({},'REMOTE',null),{});}finally{process.env.BT_EXPERIMENTAL_TRANSPORT_WORKFLOW=before;}
});
