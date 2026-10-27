# پایگاهدادهٔ SQL سامانهٔ بابل طیور

از این پس **منبع اصلی دادهها SQLite** است (فایل `DATA_DIR/baboltoyoor.db`)، نه فایل JSON. پیادهسازی با **`node:sqlite` داخلی Node.js** انجام شده؛ بنابراین همچنان **هیچ وابستگی خارجی / `npm install` وجود ندارد**.

> ⚠️ حداقل نسخهٔ Node.js اکنون **۲۲٫۵** است (ماژول `node:sqlite` در Node 20 وجود ندارد). نصبکنندهٔ ویندوز بهصورت خودکار Node 22+ میگیرد.

---

## ۱) معماری

| لایه | فایل | وظیفه |
|---|---|---|
| SQL | `lib/sqlite-store.js` | اتصال، ساخت جداول، بارگذاری، ذخیرهٔ تراکنشی افزایشی، مهاجرت، پرسوجو، پشتیبان |
| منطق | `lib/store.js` | همان API قبلی (`init/get/save/audit/...`) — منبع اصلیاش اکنون SQL است |
| تنظیمات | `lib/config.js` | `DATA_DIR` و `SQLITE_FILE` (اختیاری) |

- **۱۵ جدول واقعی** برای موجودیتها + `meta` و `counters` + `schema_info`.
- هر جدول ستونهای پرکاربرد تایپشده و **ایندکس** دارد (`users.username`، `orders.order_no/status/customer_id`، `audit.seq/action`، `products.quick_code`، …).
- رکورد کامل هر موجودیت در ستون `payload` (JSON) هم ذخیره میشود؛ یعنی فیلدهای تودرتو و آرایهها **بدون تغییر و بدون کمشدن** حفظ میشوند.
- ذخیرهسازی **تراکنشی** (`BEGIN IMMEDIATE` / `COMMIT`) و **افزایشی** است: فقط ردیفهای تغییرکرده `INSERT OR REPLACE` و ردیفهای حذفشده `DELETE` میشوند.
- `PRAGMA journal_mode=WAL`، `synchronous=FULL`، `foreign_keys=ON` — امن در برابر قطع برق.
- زنجیرهٔ هش Audit، شمارندهها، idempotency و قفل تک نمونهای (single-instance) قبلاً همگی پابرجا هستند.

## ۲) جداول

| جدول | محتوا | ستونهای کلیدی |
|---|---|---|
| `users` | کاربران و رمزها | `username`, `role_code`, `full_name`, `is_active` |
| `roles` | ۷ نقش سامانه | `title` |
| `customers` | مشتریان | `name`, `phone`, `code` |
| `products` | کاتالوگ ۶۳ محصول | `quick_code`, `name`, `is_active` |
| `price_list` | قیمتهای روز | `product_id`, `price`, `date` |
| `orders` | سفارشها | `order_no`, `customer_id`, `status`, `order_type`, `source` |
| `order_items` | اقلام سفارش | `order_id`, `product_id`, `quantity` |
| `visits` | تردد نگهبانی | `customer_id`, `status`, `visit_no` |
| `payments` | تسویهها | `order_id`, `amount`, `method`, `invoice_number` |
| `drivers` | رانندگان | `name`, `phone`, `plate_no` |
| `dispatch_returns` | برگشتیهای پخش | `order_id`, `order_no` |
| `payment_devices` | دستگاههای پوز | `terminal_number`, `is_active` |
| `notifications` | اعلانها | `user_id`, `is_read` |
| `audit` | زنجیرهٔ حسابرسی | `seq`, `action`, `entity_type`, `entity_id` |
| `idempotency` | کلیدهای بایدپخشی | `idem_key`, `user_id`, `route` |
| `meta` / `counters` | فراداده و شمارندهها | `key`, `value` |

همهٔ جداول `id`، `created_at` و `payload` دارند.

## ۳) پرسوجوی مستقیم SQL

```bash
# آمار جداول
node scripts/sql-query.js --stats

# فهرست جداول
node scripts/sql-query.js --tables

# پرسوجو (فقط خواندنی، پارامترها امن بایند میشوند)
node scripts/sql-query.js "SELECT order_no, customer_id, status FROM orders WHERE status = ?" SETTLEMENT_PENDING
node scripts/sql-query.js "SELECT username, role_code FROM users WHERE is_active = 1"
node scripts/sql-query.js "SELECT action, COUNT(*) AS n FROM audit GROUP BY action ORDER BY n DESC"
node scripts/sql-query.js "SELECT o.order_no, c.name AS customer, p.name AS product FROM orders o JOIN customers c ON c.id = o.customer_id LEFT JOIN order_items i ON i.order_id = o.id LEFT JOIN products p ON p.id = i.product_id LIMIT 10"
```

`sql-query.js` فقط دستورات `SELECT` / `PRAGMA` / `WITH` / `EXPLAIN` را میپذیرد؛ `UPDATE`، `DROP`، چند دستور پشتسرهم و پارامترهای شیء reject میشوند. متغیرهای محیطی `DATA_DIR` و `SQLITE_FILE` مسیر دیتابیس را تعیین میکنند.

## ۴) مهاجرت از نسخههای قبل (`db.json`)

**کاملاً خودکار است.** در اولین اجرا:

1. اگر `baboltoyoor.db` خالی باشد و `DATA_DIR/db.json` وجود داشته باشد، کل محتوا خوانده میشود.
2. مهاجرتهای منطقی قبلی (`migrate()`، شمارهگذاری سفارش/فاکتور، کد مشتری، کاتالوگ محصولات) اعمال میشود.
3. همهٔ رکوردها در جداول SQL نوشته میشوند.
4. فایل قدیمی به `db.json.migrated-<timestamp>` تغییرنام مییابد (بهعنوان بکاپ) و دیگر خوانده نمیشود.
5. لاگ `JSON database migrated to SQLite` ثبت میشود.

نیازی به دستور دستی نیست؛ فقط نسخهٔ جدید را جایگزین و سرویس را ریاستارت کنید. اگر سرور از نصبکنندهٔ ویندوزی استفاده میکند، همان `BabolToyor-Setup.cmd` را دوباره اجرا کنید.

## ۵) پشتیبانگیری و بازیابی

```bash
# پشتیبان یکپارچه (VACUUM INTO — حتی هنگام کار سامانه امن است)
node scripts/backup-db.js
node scripts/backup-db.js D:\Backup\baboltoyoor-20261027.db
```

- فایل اصلی: `C:\BabolToyor\data\baboltoyoor.db` (در حالت WAL فایلهای `-wal` و `-shm` کنارش موقتاند).
- برای کپی دستی، حتماً اول سرویس را متوقف کنید یا از `backup-db.js` استفاده کنید.
- بازیابی: سرویس را متوقف کنید، فایل بکاپ را به `baboltoyoor.db` کپی کنید، سرویس را بالا بیاورید.

## ۶) نکات عملیاتی

- **یک نمونه در لحظه:** قفل PID قبلی (`.lock`) همچنان برقرار است؛ SQLite هم از نوشتن همزمان جلوگیری میکند.
- **رمز مدیر:** همچنان در `.env` و `INSTALL-INFO.txt`؛ تعویض اجباری در اولین ورود پابرجاست.
- **بدون وابستگی خارجی:** درایور SQLite داخل خود Node است؛ `package.json` همچنان `dependencies` ندارد.
- **هشدار Experimental:** `node:sqlite` در Node 22 یک قابلیت آزمایشی است و یک هشدار stderr میدهد. نصبکنندهٔ ویندوز supervisor را با `--disable-warning=ExperimentalWarning` اجرا میکند تا لاگها تمیز بمانند. در صورت ارتقا به Node 24 بررسی کنید که API تغییری نکرده باشد.
- **تستها:** `tests/sqlite-store.test.js` جداول، مهاجرت، ماندگاری پس از ریاستارت، زنجیرهٔ Audit، بکاپ و قفل فقطخواندنی پرسوجوها را پوشش میدهد.
