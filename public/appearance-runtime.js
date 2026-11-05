'use strict';
// Only these fixed selectors and typed values may be published. No raw CSS or
// operational data is accepted. Only explicitly supported print tables change.
(function(global){
 const selectors={
  navigation:'#appView .rail',
  navigationActive:'#appView .rail-nav .cartable-nav-item.active',
  header:'#appView .workspace-header',
  workspace:'#appView .workspace',
  panel:'#appView .sd-panel, #appView .card',
  buttonPrimary:'#appView .btn-primary, #modal .btn-primary',
  buttonSecondary:'#appView .btn-secondary, #modal .btn-secondary',
  input:'#appView input, #appView select, #appView textarea, #modal input, #modal select, #modal textarea'
 };
 const fontSelectors={navigation:'#appView .rail-nav .nav-label',navigationActive:'#appView .rail-nav .cartable-nav-item.active .nav-label',header:'#appView .workspace-header h1'};
 const fonts={vazirmatn:'"Vazirmatn",Tahoma,Arial,sans-serif',tahoma:'Tahoma,Arial,sans-serif'};
 const lightColor=v=>{if(!safeColor(v))return false;const rgb=[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>=0.5;};
 const safeColor=x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x);
 function cssFor(settings){
  const screen=settings?.screen;if(!screen||typeof screen!=='object'||Array.isArray(screen))return '';
  const rows=[];
  for(const [name,sel] of Object.entries(selectors)){
   const v=screen[name];if(!v||typeof v!=='object')continue;const parts=[];
   if(Object.hasOwn(fonts,v.fontFamily))rows.push(':is('+sel+'), :is('+sel+') *{font-family:'+fonts[v.fontFamily]+' !important}');
   if(safeColor(v.background))parts.push('background:'+v.background+' !important');
   if(safeColor(v.color))parts.push('color:'+v.color+' !important');
   if(Number.isInteger(v.fontSize)&&v.fontSize>=9&&v.fontSize<=30){if(fontSelectors[name])rows.push(fontSelectors[name]+'{font-size:'+v.fontSize+'px !important}');else parts.push('font-size:'+v.fontSize+'px !important');}
   if(Number.isInteger(v.borderRadius)&&v.borderRadius>=0&&v.borderRadius<=30)parts.push('border-radius:'+v.borderRadius+'px !important');
   if(Number.isInteger(v.spacing)&&v.spacing>=0&&v.spacing<=24)parts.push('padding:'+v.spacing+'px !important');
   if(parts.length)rows.push(sel+'{'+parts.join(';')+'}');
  }
  return rows.join('\n');
 }
 const layoutGroups={
  phoneSections:{selector:'#phoneOrderFormV25',items:['customer','items','notes','deposit','submit']},
  phoneCustomer:{selector:'#phoneOrderFormV25 > .sales-remote-customer-grid-v40',items:['name','phone','place','delivery']},
  gateSections:{selector:'#gateForm > .gt-entry-pad',items:['contact','vehicle']},
  gateContact:{selector:'#gateForm .gt-entry-cust',items:['search','name','phone']},
  gateVehicle:{selector:'#gateForm .gt-entry-vehicle-fields',items:['vehicle','carType','purpose']}
 };
 function layoutCssFor(settings){
  const rows=[];
  for(const [group,definition] of Object.entries(layoutGroups)){
   const order=settings?.layout?.[group];
   if(!Array.isArray(order)||order.length!==definition.items.length||new Set(order).size!==order.length||order.some(x=>!definition.items.includes(x)))continue;
   if(group==='gateSections')rows.push(definition.selector+'{display:grid !important}');
   order.forEach((item,index)=>rows.push(definition.selector+' > [data-layout-item="'+item+'"]{order:'+index+' !important}'));
  }
  return rows.join('\n');
 }
 function validGrid(group,settings){
  if(!['phoneCustomer','gateContact'].includes(group))return null;
  const def=layoutGroups[group],v=settings?.grid?.[group];
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==def.items.length)return null;
  for(const key of def.items){const p=v[key];if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==4||!['x','y','w','h'].every(k=>Object.hasOwn(p,k)&&Number.isInteger(p[k]))||p.x<0||p.y<0||p.y>7||p.w<2||p.w>12||p.x+p.w>12||p.h<48||p.h>240)return null;}
  const values=def.items.map(k=>v[k]);if(values.some((a,i)=>values.some((b,j)=>i<j&&a.y===b.y&&a.x<b.x+b.w&&b.x<a.x+a.w)))return null;
  return v;
 }
 function gridCssFor(settings){
  const rows=[];
  for(const group of ['phoneCustomer','gateContact']){
   const v=validGrid(group,settings);if(!v)continue;
   const def=layoutGroups[group],sel='#appView #content '+def.selector;
   const sorted=def.items.slice().sort((a,b)=>v[a].y-v[b].y||v[a].x-v[b].x);
   sorted.forEach((key,i)=>rows.push(sel+' > [data-layout-item="'+key+'"]{order:'+i+' !important}'));
   const desktop=[sel+'{display:grid !important;grid-template-columns:repeat(12,minmax(0,1fr)) !important;grid-auto-rows:minmax(68px,auto) !important}'];
   def.items.forEach(key=>{const p=v[key];desktop.push(sel+' > [data-layout-item="'+key+'"]{grid-column:'+(p.x+1)+' / span '+p.w+' !important;grid-row:'+(p.y+1)+' !important;min-height:'+p.h+'px !important;min-width:0 !important}')});
   rows.push('@media (min-width:640px){'+desktop.join('')+'}');
  }
  return rows.join('\n');
 }
 function applyPrintLayout(settings,target,doc,options={}){
  if((safeMode&&!options.preview)||target!=='warehouseTable')return;
  const items=['head','products','total','signature'],order=settings?.layout?.warehouseSections??items;
  if(!Array.isArray(order)||order.length!==items.length||new Set(order).size!==order.length||order.some(x=>!items.includes(x)))return;
  const root=doc?.querySelector('.whd-doc');if(!root||root.children.length!==items.length)return;
  const children=Array.from(root.children);if(children.some(el=>!items.includes(el.getAttribute('data-layout-item')))||new Set(children.map(el=>el.getAttribute('data-layout-item'))).size!==items.length)return;
  order.forEach(key=>root.appendChild(children.find(el=>el.getAttribute('data-layout-item')===key)));
 }
 const printSelectors={
  invoiceTable:{root:'.inv38-sheet',table:'.inv38-table'},
  warehouseTable:{root:'.whd-doc',table:'.whd-products'},
  storeServiceTable:{root:'.service-sheet',table:'.service-table'}
 };
 function printCssFor(settings,target){
  const sel=Object.hasOwn(printSelectors,target)?printSelectors[target]:null,v=settings?.print?.[target];
  if(!sel||!v||typeof v!=='object'||Array.isArray(v))return '';
  const rows=[];
  if(Object.hasOwn(fonts,v.fontFamily))rows.push(sel.root+', '+sel.root+' *{font-family:'+fonts[v.fontFamily]+' !important}');
  if(lightColor(v.background))rows.push(sel.table+' th{background:'+v.background+' !important;color:#000000 !important;print-color-adjust:exact;-webkit-print-color-adjust:exact}');
  if(Number.isInteger(v.fontSize)&&v.fontSize>=9&&v.fontSize<=14)rows.push(sel.table+' th, '+sel.table+' td{font-size:'+v.fontSize+'px !important}');
  return rows.join('\n');
 }
 const safeMode=new URLSearchParams(global.location?.search||'').get('appearance')==='off';
 let applied=0,latest=null,layoutSettings=null;
 function syncLayout(){
  if(safeMode||!layoutSettings)return;
  for(const [group,definition] of Object.entries(layoutGroups)){
   const wanted=layoutSettings.layout?.[group],valid=Array.isArray(wanted)&&wanted.length===definition.items.length&&new Set(wanted).size===wanted.length&&wanted.every(x=>definition.items.includes(x));
   const grid=validGrid(group,layoutSettings);
   const order=grid?definition.items.slice().sort((a,b)=>grid[a].y-grid[b].y||grid[a].x-grid[b].x):valid?wanted:definition.items;
   const parent=document.querySelector(definition.selector);if(!parent||parent.contains(document.activeElement))continue;
   const children=Array.from(parent.children).filter(el=>definition.items.includes(el.getAttribute('data-layout-item')));
   if(children.length===0)continue;
   // Refuse ambiguous or unexpected structures rather than moving an
   // operational field into a different container.
   if(children.length!==parent.children.length||new Set(children.map(el=>el.getAttribute('data-layout-item'))).size!==children.length)continue;
   const sorted=children.slice().sort((a,b)=>order.indexOf(a.getAttribute('data-layout-item'))-order.indexOf(b.getAttribute('data-layout-item')));
   if(children.every((el,i)=>el===sorted[i]))continue;
   sorted.forEach(el=>parent.appendChild(el));
  }
 }
 function apply(settings){layoutSettings=settings;let style=document.getElementById('bt-published-appearance');if(!style){style=document.createElement('style');style.id='bt-published-appearance';document.head.appendChild(style);}style.textContent=safeMode?'':cssFor(settings)+'\n'+layoutCssFor(settings)+'\n'+gridCssFor(settings);syncLayout();}
 async function refresh(){
  const seq=++applied;
  try{const response=await fetch('/api/appearance',{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw Error('appearance fetch');const data=await response.json();if(seq!==applied)return;latest=data;apply(data.settings);}catch(_){/* Keep the last known style; never replace it with a stale/empty response. */}
 }
 global.BTAppearance={cssFor,layoutCssFor,gridCssFor,applyPrintLayout,printCssFor:(settings,target)=>safeMode?'':printCssFor(settings,target),refresh,safeMode,get latest(){return latest;}};
 if(global.MutationObserver){const content=document.getElementById('content');if(content){let pending=false;const schedule=()=>{if(pending)return;pending=true;global.setTimeout(()=>{pending=false;syncLayout();},0);};new global.MutationObserver(schedule).observe(content,{childList:true,subtree:true});content.addEventListener('focusout',schedule);}}
 void refresh();global.setInterval(refresh,20000);
})(window);
