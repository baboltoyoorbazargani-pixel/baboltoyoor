'use strict';
// New transport planning data is stored on the order, not in a second queue.
// Therefore the warehouse and transport views derive from one persisted order.
// This work-in-progress must not create operational orders until all stages are integrated.
function assertEnabled(){if(process.env.BT_EXPERIMENTAL_TRANSPORT_WORKFLOW!=='1')throw Object.assign(new Error('گردش جدید پخش هنوز فعال نشده است.'),{status:503});}
const MODES=Object.freeze({DELIVERY:'DELIVERY',PICKUP:'PICKUP'});
function deliveryFields(body,orderType,deposit){
  if(body?.transportWorkflow!==true)return {};
  assertEnabled();
  const deliveryMode=orderType==='STORE'?MODES.DELIVERY:String(body.deliveryMode||'');
  if(!Object.values(MODES).includes(deliveryMode))throw Object.assign(new Error('روش تحویل را انتخاب کنید: ارسال توسط پخش یا تحویل در انبار.'),{status:400});
  if(deliveryMode===MODES.DELIVERY&&deposit)throw Object.assign(new Error('سفارش دارای بیعانه قابل ارسال توسط پخش نیست.'),{status:409});
  return {deliveryMode,transportWorkflow:1,transportAssignments:{}};
}
function assignment(order,run,driver,vehicle,actor,now){
  if(order.transportWorkflow!==1||order.deliveryMode!==MODES.DELIVERY)throw Object.assign(new Error('این سفارش در مسیر جدید پخش نیست.'),{status:409});
  if(!['WAREHOUSE_PENDING','WAREHOUSE_PREPARING','SETTLEMENT_PENDING'].includes(order.status))throw Object.assign(new Error('سفارش در وضعیت قابل تخصیص نیست.'),{status:409});
  if(order.orderType==='STORE'?![1,2].includes(run):run!==0)throw Object.assign(new Error('شماره سرویس معتبر نیست.'),{status:400});
  if(!driver||driver.isActive===false||!vehicle||vehicle.kind!=='fleet'||vehicle.isActive===false)throw Object.assign(new Error('راننده و خودرو باید فعال و معتبر باشند.'),{status:400});
  const key=String(run),old=order.transportAssignments?.[key];
  if(order.transportHandovers?.[key])throw Object.assign(new Error('پس از تحویل فیزیکی انبار، تغییر تخصیص مجاز نیست.'),{status:409});
  if(old?.departedAt)throw Object.assign(new Error('تغییر راننده یا خودرو پس از خروج مجاز نیست.'),{status:409});
  if(old&&old.driverId===driver.id&&old.vehicleId===vehicle.id)return order.transportAssignments;
  return {...(order.transportAssignments||{}),[key]:{driverId:driver.id,driverName:driver.fullName,driverPhone:driver.phone||'',vehicleId:vehicle.id,vehicleType:vehicle.vehicleType,vehiclePlate:vehicle.plate,assignedAt:now,assignedBy:actor.id}};
}
function handoverToken(order,run,document){
  return require('node:crypto').createHash('sha256').update(JSON.stringify({run,assignment:order.transportAssignments?.[String(run)]||null,document})).digest('hex');
}
function activeAssignments(db){
  return (db.orders||[]).filter(o=>o.transportWorkflow===1&&o.deliveryMode===MODES.DELIVERY&&['WAREHOUSE_PENDING','WAREHOUSE_PREPARING','SETTLEMENT_PENDING'].includes(o.status)).flatMap(o=>Object.values(o.transportAssignments||{}));
}
function driverHasPlanningHistory(db,id){
  return (db.orders||[]).some(o=>Object.values(o.transportAssignments||{}).some(a=>a.driverId===id)||Object.values(o.transportHandovers||{}).some(h=>h.driverId===id)||(o.transportAssignmentHistory||[]).some(a=>a.driverId===id)) || (db.audit||[]).some(a=>a.action==='TRANSPORT_PLAN_ASSIGNED'&&a.details?.driverId===id);
}
module.exports={MODES,deliveryFields,assignment,assertEnabled,handoverToken,activeAssignments,driverHasPlanningHistory};
