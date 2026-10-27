'use strict';
// نقطه ورود سامانه عملیات بابل طیور
require('./lib/load-env').loadEnv();
const http = require('http');
const config = require('./lib/config');
const log = require('./lib/logger');
const store = require('./lib/store');
const sec = require('./lib/security');
const { createHandler } = require('./lib/http');
require('./lib/routes');
const { activateDueRemoteOrders } = require('./lib/domain');

const release = store.acquireLock();
store.init();

const server = http.createServer(createHandler());
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;

// وظایف زمان‌بندی‌شده: فعال‌سازی سفارش‌های آینده و پاک‌سازی نشست‌های منقضی
const timers = [
  setInterval(() => { try { activateDueRemoteOrders(); } catch (e) { log.error('scheduler', 'activation failed', { error: e.message }); } }, 15000),
  setInterval(() => sec.pruneSessions(), 5 * 60 * 1000),
];
timers.forEach((t) => t.unref());

function shutdown(signal) {
  log.info('server', 'shutting down', { signal });
  timers.forEach(clearInterval);
  server.close(() => { release(); process.exit(0); });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (e) => { log.error('process', 'uncaught exception', { error: e.message, stack: e.stack }); });

server.listen(config.PORT, config.HOST, () => {
  log.info('server', 'listening', { host: config.HOST, port: config.PORT, env: config.APP_ENV });
});
