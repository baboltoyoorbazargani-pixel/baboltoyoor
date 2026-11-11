'use strict';
// Run from Task Scheduler/cron. Exit 1 is a signal for external alerting.
// No credentials or backup contents are transmitted. This does not start the app.
require('../lib/load-env').loadEnv();
const config=require('../lib/config'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const url=process.argv[2]||`http://127.0.0.1:${config.PORT}/api/health`;
 const response=await fetch(url,{signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!response.ok)throw Error(`Health HTTP ${response.status}`);
 const health=await response.json();if(health.service!=='baboltoyoor'||health.status!=='ok')throw Error('Unexpected health response');
 const stateFile=path.join(config.DATA_DIR,'auto-backup.json');
 if(fs.existsSync(stateFile)){
  const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
  if(state.enabled){
   if(state.lastError)throw Error('Automatic backup reports a failure');
   const age=Date.now()-Date.parse(state.lastSuccessAt);
   if(!Number.isFinite(age)||age>2*60*60*1000)throw Error('No successful automatic backup in the last two hours');
   if(!state.lastBackup||path.basename(state.lastBackup)!==state.lastBackup||!fs.existsSync(path.join(state.directory,state.lastBackup)))throw Error('Latest automatic backup is missing');
  }
 }
 console.log(JSON.stringify({ok:true,release:health.release,checkedAt:new Date().toISOString()}));
}
main().catch(error=>{console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;});
