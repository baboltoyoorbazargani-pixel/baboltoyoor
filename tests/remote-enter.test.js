'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'..','public/app.js'),'utf8');
const source=app.slice(app.indexOf('// در سفارش تلفنی Enter'),app.indexOf('// v37.6.0 — ناوبری Enter در فرم سفارش فروشگاه'));
function harness(rows){
 let handler,focused='',renders=0;const messages=[];const form={querySelector:s=>{const m=s.match(/phone-(\d+)/);return m?{focus(){focused=Number(m[1]);},select(){},scrollIntoView(){}}:null;}};
 class Element{constructor(tag,dataset={},inside=true,type=''){this.tagName=tag;this.dataset=dataset;this.type=type;this.inside=inside;}closest(){return this.inside?form:null;}}
 const context={Element,document:{addEventListener:(type,fn)=>{assert.equal(type,'keydown');handler=fn;}},app:{phoneDraft:rows},toast:m=>messages.push(m),n:v=>Number(v)||0,defaultOrderLine:()=>({productId:'',requestedQty:''}),renderOrderLineArea:()=>renders++};
 vm.createContext(context);vm.runInContext(source,context);
 const press=(target,extra={})=>{const event={key:'Enter',isComposing:false,repeat:false,target,prevented:false,preventDefault(){this.prevented=true;},...extra};handler(event);return event;};
 return {press,Element,rows,messages,get focused(){return focused;},get renders(){return renders;}};
}
test('Enter on quantity adds exactly one line, focuses the next product and reuses an existing row',()=>{
 const h=harness([{productId:'p01',requestedQty:'2'}]);let ev=h.press(new h.Element('INPUT',{opQty:'phone-0'}));assert(ev.prevented);assert.equal(h.rows.length,2);assert.equal(h.focused,1);assert.equal(h.renders,1);
 ev=h.press(new h.Element('INPUT',{opQty:'phone-0'}));assert(ev.prevented);assert.equal(h.rows.length,2);assert.equal(h.focused,1);assert.equal(h.renders,1);
});
test('missing product, invalid quantity, repeating key and 100-line limit do not add or submit',()=>{
 for(const row of [{productId:'',requestedQty:'2'},{productId:'p01',requestedQty:'0'}]){const h=harness([row]);const e=h.press(new h.Element('INPUT',{opQty:'phone-0'}));assert(e.prevented);assert.equal(h.rows.length,1);assert.equal(h.messages.length,1);}
 const h=harness([{productId:'p01',requestedQty:'2'}]);assert(h.press(new h.Element('INPUT',{opQty:'phone-0'}),{repeat:true}).prevented);assert.equal(h.rows.length,1);
 const full=harness(Array.from({length:100},()=>({productId:'p01',requestedQty:'1'})));const e=full.press(new full.Element('INPUT',{opQty:'phone-99'}));assert(e.prevented);assert.equal(full.rows.length,100);assert.match(full.messages[0],/۱۰۰/);
});
test('Enter cannot submit from other fields or the submit button, but notes keep newlines and other forms are untouched',()=>{
 const h=harness([{productId:'p01',requestedQty:'1'}]);
 for(const el of [new h.Element('INPUT',{}),new h.Element('SELECT',{}),new h.Element('BUTTON',{},true,'submit')])assert(h.press(el).prevented);
 assert(!h.press(new h.Element('TEXTAREA')).prevented);assert(!h.press(new h.Element('BUTTON',{},true,'button')).prevented);assert(!h.press(new h.Element('INPUT',{},false)).prevented);assert(!h.press(new h.Element('INPUT'),{isComposing:true}).prevented);assert.equal(h.rows.length,1);
});
