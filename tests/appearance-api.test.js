'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
test('پیش‌نویس خصوصی، انتشار اتمی و بازگردانی طراحی با کنترل دسترسی و نسخه', {timeout:45000}, async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-design-'));
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});const base=`http://127.0.0.1:${port}`;
 let proc;const start=async()=>{proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(timer);resolve();}});proc.once('exit',c=>reject(Error('exit '+c)));});};
 const stop=async()=>{if(proc&&proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}};
 const call=async(method,url,body,cookie)=>{const r=await fetch(base+url,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:(r.headers.get('set-cookie')||'').split(';')[0]};};
 try{
  await start();const admin=(await call('POST','/api/login',{username:'admin',password:'Initial!2345'})).cookie;assert(admin);
  assert.equal((await call('POST','/api/account/password',{currentPassword:'Initial!2345',newPassword:'Changed!2345'},admin)).status,200);
  assert.equal((await call('POST','/api/admin/users',{username:'sales1',roleCode:'sales',fullName:'فروش',position:'فروش',password:'Changed!2345',mustChangePassword:false},admin)).status,201);
  const sales=(await call('POST','/api/login',{username:'sales1',password:'Changed!2345'})).cookie;
  let s=await call('GET','/api/appearance');assert.equal(s.data.version,0);assert.deepEqual(s.data.settings,{screen:{},print:{}});
  assert.equal((await call('GET','/api/admin/appearance',null,sales)).status,403);
  const draft={screen:{navigation:{background:'#ABCDEF',fontSize:16}},print:{invoice:{color:'#000000'}},layout:{phoneCustomer:['phone','name','place','delivery'],phoneSections:['customer','items','notes','deposit','submit']}};
  assert.equal((await call('PUT','/api/admin/appearance/draft',{draftRevision:0,settings:draft},sales)).status,403);
  s=await call('PUT','/api/admin/appearance/draft',{draftRevision:0,settings:draft},admin);assert.equal(s.status,200);assert.equal(s.data.draftRevision,1);
  assert.equal((await call('GET','/api/appearance')).data.version,0,'draft must not change live appearance');
  assert.equal((await call('PUT','/api/admin/appearance/draft',{draftRevision:0,settings:draft},admin)).status,409);
  assert.equal((await call('PUT','/api/admin/appearance/draft',{draftRevision:1,settings:{screen:{navigation:{background:'red;display:none'}}}},admin)).status,400);
  assert.equal((await call('PUT','/api/admin/appearance/draft',{draftRevision:1,settings:{screen:{navigation:{display:'none'}}}},admin)).status,400);
  for(const styles of [{background:'#000000'},{fontSize:15},{fontFamily:'url(evil)'},{color:'#ffffff'}])assert.equal((await call('PUT','/api/admin/appearance/draft',{draftRevision:1,settings:{print:{warehouseTable:styles}}},admin)).status,400);
  assert.equal((await call('PUT','/api/admin/appearance/draft',{draftRevision:1,settings:{screen:{panel:{fontFamily:'invalid'}}}},admin)).status,400);
  for(const order of [['name','phone','place','place'],['name','phone','place'],['name','phone','place','delivery','evil']])assert.equal((await call('PUT','/api/admin/appearance/draft',{draftRevision:1,settings:{layout:{phoneCustomer:order}}},admin)).status,400);
  assert.equal((await call('PUT','/api/admin/appearance/draft',{draftRevision:1,settings:{layout:{unknown:['name']}}},admin)).status,400);
  assert.equal((await call('POST','/api/admin/appearance/publish',{version:0,draftRevision:0},admin)).status,409);
  const {DatabaseSync}=require('node:sqlite');let raw=new DatabaseSync(path.join(dir,'baboltoyoor.db'));
  raw.exec("CREATE TRIGGER fail_appearance BEFORE INSERT ON audit WHEN NEW.action='APPEARANCE_PUBLISHED' BEGIN SELECT RAISE(ABORT, 'test failure'); END");raw.close();
  assert.equal((await call('POST','/api/admin/appearance/publish',{version:0,draftRevision:1},admin)).status,500);
  assert.equal((await call('GET','/api/appearance')).data.version,0,'failed audit must roll back publication');
  raw=new DatabaseSync(path.join(dir,'baboltoyoor.db'));raw.exec('DROP TRIGGER fail_appearance');raw.close();
  s=await call('POST','/api/admin/appearance/publish',{version:0,draftRevision:1},admin);assert.equal(s.status,200);assert.equal(s.data.version,1);
  s=await call('GET','/api/appearance');assert.equal(s.data.version,1);assert.equal(s.data.settings.screen.navigation.background,'#abcdef');assert(!('draft' in s.data));
  await stop();await start();s=await call('GET','/api/appearance');assert.equal(s.data.version,1);assert.equal(s.data.settings.print.invoice.color,'#000000');assert.deepEqual(s.data.settings.layout.phoneCustomer,['phone','name','place','delivery']);
  const admin2=(await call('POST','/api/login',{username:'admin',password:'Changed!2345'})).cookie;
  s=await call('POST','/api/admin/appearance/restore',{version:1,draftRevision:2},admin2);assert.equal(s.status,200);assert.equal(s.data.version,2);assert.deepEqual(s.data.published,{screen:{},print:{}});
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}
});
