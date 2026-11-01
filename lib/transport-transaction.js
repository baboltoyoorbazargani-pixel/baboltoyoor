'use strict';
const store=require('./store');
// Synchronous work only. The live store writes through; on failure reload it
// from SQLite after rollback so no partial changes survive in the process.
module.exports=function transportTransaction(work){
 store.sql.run('BEGIN IMMEDIATE');
 try{const result=work();store.sql.run('COMMIT');require('./sql-repos').clearCache();return result;}
 catch(e){try{store.sql.run('ROLLBACK');}finally{store.reloadFromSql();}throw e;}
};
