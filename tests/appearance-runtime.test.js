'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('public/appearance-runtime.js','utf8');
function harness(){let style=null;const calls=[];const c={URLSearchParams,document:{getElementById:()=>style,createElement:()=>({}),head:{appendChild(x){style=x}}},fetch:()=>new Promise(resolve=>calls.push(resolve))};c.window={setInterval(){}};vm.createContext(c);vm.runInContext(code,c);return {c,calls,get style(){return style;}};}
test('appearance runtime creates fixed CSS only for validated known targets',()=>{
 const h=harness(),css=h.c.window.BTAppearance.cssFor({screen:{navigation:{background:'#AABBCC',fontSize:15,spacing:4},unknown:{color:'#ffffff'},input:{background:'red;display:none',fontSize:999},panel:{color:'#000000'}},print:{invoice:{color:'#ff0000'}}});
 assert.match(css,/#appView \.rail\{/);assert.match(css,/background:#AABBCC !important/);assert.match(css,/#appView \.rail-nav \.nav-label\{font-size:15px !important\}/);assert.match(css,/padding:4px !important/);assert.doesNotMatch(css,/display:none|999|unknown|ff0000/);
});
test('only the latest response applies; fetch failure preserves the last good style',async()=>{
 const h=harness(),pending=h.c.window.BTAppearance.refresh();assert.equal(h.calls.length,2);
 h.calls[1]({ok:true,json:async()=>({version:2,settings:{screen:{panel:{color:'#112233'}}}})});await pending;
 h.calls[0]({ok:true,json:async()=>({version:1,settings:{screen:{panel:{color:'#000000'}}}})});await new Promise(r=>setImmediate(r));assert.match(h.style.textContent,/#112233/);assert.doesNotMatch(h.style.textContent,/#000000/);
 const fail=h.c.window.BTAppearance.refresh();h.calls[2]({ok:false});await fail;assert.match(h.style.textContent,/#112233/);
});

test('print appearance accepts only fixed supported elements and safe values',()=>{
 const h=harness(),fn=h.c.window.BTAppearance.printCssFor;
 const settings={print:{invoiceTable:{background:'#eeeeff',fontSize:14,fontFamily:'tahoma'},warehouseTable:{background:'#000000',fontSize:15,fontFamily:'Tahoma;display:none'}}};
 const css=fn(settings,'invoiceTable');assert.match(css,/\.inv38-table th\{background:#eeeeff !important;color:#000000 !important/);assert.match(css,/font-size:14px/);assert.match(css,/font-family:Tahoma/);
 assert.equal(fn(settings,'warehouseTable'),'');assert.equal(fn(settings,'constructor'),'');assert.doesNotMatch(css,/display:none/);
});
