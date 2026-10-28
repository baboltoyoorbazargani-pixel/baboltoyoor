'use strict';
const SR=require('./store-runs');
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
 return {orderId:order.id,orderNo:order.orderNo||'—',storeName:order.storeName||'فروشگاه',dispatchPlace:order.dispatchPlace||'',run,sentAt:sh?.sentAt||d?.sentAt||pay?.verifiedAt||null,lines};
}
module.exports={serviceDocument};
