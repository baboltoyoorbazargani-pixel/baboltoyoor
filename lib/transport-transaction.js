'use strict';
const store=require('./store');
// Synchronous work only. The live store writes through; on failure reload it
// from SQLite after rollback so no partial changes survive in the process.
module.exports=function transportTransaction(work){
 store.sql.run('BEGIN IMMEDIATE');
 try{
  // A competing process may have committed after HTTP refresh but before this
  // write lock. Re-read under the lock to avoid stale assignments/invoices.
  // Number repair is done during request refresh, outside this transaction.
  store.reloadFromSql({skipRepair:true});
  const result=work();store.sql.run('COMMIT');require('./sql-repos').clearCache();return result;}
 catch(e){try{store.sql.run('ROLLBACK');}finally{store.reloadFromSql();}throw e;}
};
