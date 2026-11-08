'use strict';
const SR=require('./store-runs');
const {storeDisplayName}=require('./store-name');
// Read-only weighted shipment document; never merge the two services or expose prices.
function serviceDocument(db,order,run,getProduct){
 if(!order||order.orderType!=='STORE'||![1,2].includes(run))return null;
 const sh=SR.runShipmentOf(order,run),d=SR.runDispatchOf(order,run);
 const pay=db.payments.find(p=>p.orderId===order.id&&Number(p.deliveryRun)===run);
 if(!sh&&!d&&!pay)return null;
 const weights=Object.keys(sh?.weights||{}).length?sh.weights:(d?.shipmentWeights||{});
 const ids=sh?.itemIds?.length?sh.itemIds:(d?.shipmentItemIds?.length?d.shipmentItemIds:Object.keys(weights));
 const items=db.orderItems.filter(i=>i.orderId===order.id);
 let lines=ids.map(id=>{const item=items.find(i=>i.id===id);if(!item)return null;
   const amount=Object.prototype.hasOwnProperty.call(weights,id)?Number(weights[id]):(run===1?SR.r1Kg(item):SR.r2Kg(item));
   const delivery=Array.isArray(d?.lines)?d.lines.find(x=>x.itemId===id):null;
   return amount>0?{productName:d?.priceLines?.find(x=>x.itemId===id)?.productName||getProduct(item.productId)?.name||'کالای حذف‌شده',deliveredKg:amount,returnKg:delivery?Number(delivery.returnKg||0):null,shortageKg:delivery?Number(delivery.shortageKg||0):null,netKg:delivery?.netKg==null?null:Number(delivery.netKg)}:null;
 }).filter(Boolean);
 if(!lines.length&&Array.isArray(pay?.priceLines))lines=pay.priceLines.filter(x=>Number.isFinite(Number(x.deliveredKg))&&Number(x.deliveredKg)>=0).map(x=>({productName:x.productName||'کالا',deliveredKg:null,returnKg:x.returnKg==null?null:Number(x.returnKg),shortageKg:null,netKg:Number(x.deliveredKg)}));
 if(!lines.length)return null;
 return {storeOrderKind:order.storeOrderKind||'BULK',orderId:order.id,orderNo:order.orderNo||'—',storeName:storeDisplayName(order.storeName,order.branchNo),dispatchPlace:order.dispatchPlace||'',run,sentAt:sh?.sentAt||d?.sentAt||pay?.verifiedAt||null,lines};
}
module.exports={serviceDocument};

// Separate warehouse handover document. Only the outgoing weight belongs here;
// returned/net weights describe later events and must not be substituted for it.
function warehouseServiceDocument(db,order,run,getProduct){
 const saved=order?.transportWorkflow===1&&order?.transportHandovers?.[String(run)]?.document;
 if(saved)return {...saved,handedOverToDriver:true};
 const report=serviceDocument(db,order,run,getProduct);
 if(!report)return null;
 const sh=SR.runShipmentOf(order,run),dispatch=SR.runDispatchOf(order,run);
 const weights=Object.keys(sh?.weights||{}).length?sh.weights:(dispatch?.shipmentWeights||{});
 const ids=sh?.itemIds?.length?sh.itemIds:(dispatch?.shipmentItemIds?.length?dispatch.shipmentItemIds:Object.keys(weights));
 const items=(db.orderItems||[]).filter(i=>i.orderId===order.id);
 let lines=ids.map(id=>{
   const item=items.find(i=>i.id===id);if(!item)return null;
   const amount=Object.prototype.hasOwnProperty.call(weights,id)?Number(weights[id]):(run===1?SR.r1Kg(item):SR.r2Kg(item));
   if(!(amount>0))return null;
   return {productName:dispatch?.priceLines?.find(x=>x.itemId===id)?.productName||getProduct(item.productId)?.name||'کالای حذف‌شده',requestedQty:item.requestedQty??null,requestedUnit:item.requestedUnit||'',deliveredKg:amount, weighings:(run===1?item.runR1||[]:item.runR2||[]).flatMap(e=>Array.isArray(e.weighings)?e.weighings:[]), missingWeighings:(run===1?item.runR1||[]:item.runR2||[]).some(e=>!Array.isArray(e.weighings))};
 }).filter(Boolean);
 // Old payment-only records have net, not outgoing, weight. Never invent the missing weight.
 if(!lines.length)lines=report.lines.map(x=>({productName:x.productName,requestedQty:null,requestedUnit:'',deliveredKg:x.deliveredKg}));
 const planned=order.transportWorkflow===1 ? order.transportAssignments?.[String(run)] : null;
 const driverName=String(order.transportWorkflow===1 ? planned?.driverName||'' : dispatch?.driverName||'').trim();
 const driverStatus=driverName?'ASSIGNED':((order.transportWorkflow===1||sh?.status==='PENDING_SALES'||dispatch?.status==='PENDING_ASSIGN')?'PENDING':'UNKNOWN');
 return {...(order.transportWorkflow===1?{handedOverToDriver:false}:{}),driverStatus,storeOrderKind:order.storeOrderKind||'BULK',orderId:order.id,orderNo:order.orderNo||'—',warehouseDocumentNo:order.storeWarehouseDocumentNos?.[run]||'',storeName:report.storeName,createdAt:order.createdAt||null,run,sentAt:report.sentAt,driverName,lines};
}
module.exports.warehouseServiceDocument=warehouseServiceDocument;
