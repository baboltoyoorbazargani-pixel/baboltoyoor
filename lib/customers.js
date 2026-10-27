'use strict';
// سرویس مشتریان: پیدا کردن یا ساختن پرونده‌ی مشتری برای هر ورودی (نگهبانی، فروشگاه، سفارش غیرحضوری).
const store = require('./store');
const core = require('./customer-core');
const { fail } = require('./http');

// ورودی‌ها: customerId / customerCode (وقتی مشتری از فهرست انتخاب شده) یا شماره تماس و پلاک.
// اگر پرونده پیدا شود، فقط فیلدهای ارسال‌شده به‌روز می‌شود؛ در غیر این صورت پرونده‌ی جدید با کد جدید ساخته می‌شود.
function upsertCustomer(db, input) {
  const { customerId, customerCode, name, phone, plate = '', vehicleType, district } = input;
  const found = core.findExisting(db, { customerId, code: customerCode, phone, plate });
  if ((customerId || customerCode) && !found) fail(400, 'مشتری با این کد پیدا نشد. کد را بررسی کنید یا مشتری جدید ثبت کنید.');

  const now = store.nowIso();
  if (found) {
    Object.assign(found, {
      name,
      phone: phone || found.phone,
      plate: plate || found.plate || '',
      vehicleType: vehicleType || found.vehicleType || 'بدون وسیله',
      district: district !== undefined && district !== '' ? district : (found.district || ''),
      lastVisitAt: now,
    });
    return found;
  }
  const customer = {
    id: store.uid(), code: core.nextCode(db), name, phone,
    phone2: '', nationalId: '', company: '', district: district || '', address: '',
    plate, vehicleType: vehicleType || 'بدون وسیله', notes: '',
    createdAt: now, lastVisitAt: null,
  };
  db.customers.push(customer);
  return customer;
}

// خلاصه‌ی یک مشتری برای فهرست و جستجو.
function summarize(db, c) {
  const visits = db.visits.filter((v) => v.customerId === c.id);
  const orders = db.orders.filter((o) => o.customerId === c.id);
  const last = [...visits.map((v) => v.createdAt), ...orders.map((o) => o.createdAt)].filter(Boolean).sort().pop() || c.lastVisitAt || null;
  return { ...c, visitCount: visits.length, orderCount: orders.length, lastActivityAt: last };
}

module.exports = { upsertCustomer, summarize };
