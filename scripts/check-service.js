'use strict';
// Run from Task Scheduler/cron independently of the app. Failure exits 1.
require('../lib/load-env').loadEnv();
const config=require('../lib/config'),{checkService,sendAlert}=require('../lib/service-monitor');
const url=process.argv[2]||`http://127.0.0.1:${config.PORT}/api/health`;
checkService({url,dataDir:config.DATA_DIR}).then(result=>console.log(JSON.stringify(result))).catch(async error=>{
 console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;
 if(process.env.BT_ALERT_WEBHOOK_URL){
  try{await sendAlert(process.env.BT_ALERT_WEBHOOK_URL,{token:process.env.BT_ALERT_WEBHOOK_TOKEN||''});}
  catch{console.error('External alert delivery failed; inspect the configured endpoint and credentials.');}
 }
});
