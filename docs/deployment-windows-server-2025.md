# نصب روی Windows Server 2025 (نسخه 37.2.10)

## خلاصه
فایل `dist\BabolToyorSmart-Setup-37.2.10.exe` را روی سرور اجرا کنید (با دسترسی Administrator). نصب‌کننده همه چیز را خودکار انجام می‌دهد:

1. نصب **Node.js 22 LTS** اگر نصب نباشد (دانلود از nodejs.org و بررسی SHA256).
2. کپی فایل‌های برنامه در `C:\BabolToyorSmart`.
3. ساخت فایل `.env` با رمز اولیه تصادفی مدیر (فقط یک بار، و فقط اگر پایگاه داده وجود نداشته باشد).
4. ثبت **Windows Service** با نام `BabolToyorSmart` (شروع خودکار با سرور و راه‌اندازی مجدد در خطا).
5. باز کردن فایروال برای `TCP 80` در پروفایل‌های Domain و Private.
6. اجرای سرویس و بررسی سلامت برنامه؛ ساخت میان‌بر روی دسکتاپ و Start Menu.

## نصب
1. فایل Setup را روی سرور کپی و با **Run as administrator** اجرا کنید.
2. مسیر نصب را تغییر ندهید مگر لازم باشد.
3. صبر کنید تا پیام «Installation finished» ظاهر شود (نصب Node.js ممکن است چند دقیقه طول بکشد).
4. فایل `C:\BabolToyorSmart\INITIAL-ADMIN-PASSWORD.txt` را باز کنید، با نام کاربری `admin` وارد شوید، رمز را فوراً تغییر دهید و **سپس این فایل را حذف کنید**.

آدرس برنامه روی خود سرور: `http://localhost`
از کامپیوترهای داخل شبکه فقط آی‌پی سرور را وارد کنید: `http://IP-سرور` (بدون پورت)

نصب‌کننده سامانه را روی پورت ۸۰ قرار می‌دهد. اگر پورت ۸۰ توسط برنامه دیگری مثل IIS اشغال باشد، نصب با پیام مشخص متوقف می‌شود؛ آن برنامه را متوقف کنید یا از پورت دیگری استفاده کنید.

## ارتقا
Setup جدید را روی نصب قبلی اجرا کنید. سرویس متوقف می‌شود، فایل‌های برنامه جایگزین می‌شوند و این موارد **دست‌نخورده** می‌مانند:
- `C:\BabolToyorSmart\data` (پایگاه داده)
- `C:\BabolToyorSmart\.env` (تنظیمات)
- `C:\BabolToyorSmart\logs`

مهاجرت داده‌ها هنگام اولین اجرای نسخه جدید به‌طور خودکار انجام می‌شود.

## پشتیبان‌گیری (مهم)
فایل اصلی داده: `C:\BabolToyorSmart\data\db.json`

روزانه از کل پوشه `data` و `.env` پشتیبان بگیرید. برای پشتیبان‌گیری امن، قبل از کپی سرویس را متوقف کنید:
```powershell
Stop-Service BabolToyorSmart
Copy-Item C:\BabolToyorSmart\data -Destination D:\Backup\data-$(Get-Date -Format yyyyMMdd) -Recurse
Start-Service BabolToyorSmart
```

## بررسی وضعیت و عیب‌یابی
- وضعیت سرویس: `Get-Service BabolToyorSmart` (باید `Running` باشد).
- لاگ نصب: `C:\BabolToyorSmart\logs\install.log`
- لاگ برنامه: `C:\BabolToyorSmart\service\BabolToyorSmart.out.log` و `.err.log`
- تست شبکه از یک کامپیوتر دیگر: `Test-NetConnection IP-سرور -Port 80`
- اگر سرویس بالا نمی‌آید: فایل `.env` را بررسی کنید (مقدار `PORT` باید با پورت فایروال یکی باشد).

## حذف برنامه
از **Apps & Features** (یا Settings → Apps) «Babol Toyor Smart System» را حذف کنید. سرویس، قانون فایروال و میان‌برها حذف می‌شوند؛ اما `data`، `.env` و `logs` برای امنیت داده‌ها نگه داشته می‌شوند.

## امنیت
- `.env` فقط برای SYSTEM و Administrators قابل خواندن است.
- نرم‌افزار فقط روی شبکه داخلی باز می‌شود (پروفایل Domain و Private). برای محدودیت بیشتر، در `Firewall with Advanced Security` قانون `Babol Toyor Smart - TCP 80` را به زیرشبکه داخلی محدود کنید.
- پشت Reverse Proxy با HTTPS، در `.env` مقدار `COOKIE_SECURE=true` و `TRUST_PROXY=true` را تنظیم کنید.

## ساخت نصب‌کننده (برای توسعه‌دهنده)
روی لینوکس یا macOS با NSIS:
```bash
sudo apt-get install -y nsis
bash installer/build.sh
```
خروجی: `dist/BabolToyorSmart-Setup-<version>.exe`
