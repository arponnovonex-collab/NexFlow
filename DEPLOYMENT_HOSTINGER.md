# NexFlow AI — Hostinger Cloud Hosting Deployment & Production Guide

This guide details the step-by-step production deployment of **NexFlow AI** to **Hostinger Cloud Hosting / Shared Hosting with Apache and MySQL**.

---

## 1. Prerequisites on Hostinger

- **PHP Version:** 8.2 or 8.3 with extensions: `BCMath`, `Ctype`, `cURL`, `DOM`, `Fileinfo`, `JSON`, `Mbstring`, `OpenSSL`, `PCRE`, `PDO`, `PDO_MySQL`, `Tokenizer`, `XML`.
- **MySQL Database:** Create a new database in Hostinger hPanel -> Databases (e.g. `u123456789_nexflow`).
- **SSH Access:** Enabled in hPanel -> Advanced -> SSH Access.
- **Node.js & NPM:** Or pre-compile frontend assets locally via `npm run build` prior to uploading.

---

## 2. Directory Structure on Hostinger

In Hostinger, `public_html` is the root web directory. To keep Laravel source files secure outside the document root:

```
/home/u123456789/
├── nexflow_core/           # Laravel backend, app, config, database, routes, storage
│   ├── app/
│   ├── bootstrap/
│   ├── config/
│   ├── database/
│   ├── storage/
│   ├── .env
│   └── artisan
└── public_html/            # Contents of public/
    ├── build/              # Compiled Vite React assets (CSS, JS, manifest.json)
    ├── index.php           # Front controller updated with path to nexflow_core
    ├── .htaccess           # Apache rewrite rules
    └── favicon.ico
```

### Updating `public_html/index.php`
If files are separated as above, update lines in `public_html/index.php`:
```php
require __DIR__.'/../nexflow_core/vendor/autoload.php';
$app = require_once __DIR__.'/../nexflow_core/bootstrap/app.php';
```

---

## 3. Production Environment Configuration (`.env`)

```ini
APP_NAME="NexFlow AI"
APP_ENV=production
APP_KEY=base64:YOUR_GENERATED_APP_KEY
APP_DEBUG=false
APP_URL=https://yourdomain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=u123456789_nexflow
DB_USERNAME=u123456789_admin
DB_PASSWORD=YOUR_STRONG_PASSWORD

SESSION_DRIVER=database
SESSION_LIFETIME=120

CACHE_STORE=database
QUEUE_CONNECTION=database

# OpenAI Production Key
OPENAI_API_KEY=sk-proj-YOUR_REAL_OPENAI_KEY
OPENAI_MODEL=gpt-4o-mini

# Meta Webhook Verification Token
META_WEBHOOK_VERIFY_TOKEN=nexflow_secure_webhook_token_2026
```

---

## 4. Production Build & Deployment Commands

Run via SSH terminal in your Hostinger core directory:

```bash
# 1. Install production PHP dependencies
composer install --no-dev --optimize-autoloader

# 2. Run Database Migrations and Seeders
php artisan migrate --force
php artisan db:seed --force

# 3. Cache configuration and routes for extreme performance
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 4. Create storage symlink
php artisan storage:link
```

---

## 5. Hostinger Cron & Queue Worker Setup

In Hostinger hPanel -> **Advanced -> Cron Jobs**:

### A. Laravel Scheduler (Runs every minute)
- **Command:**
  ```bash
  * * * * * cd /home/u123456789/nexflow_core && /usr/bin/php artisan schedule:run >> /dev/null 2>&1
  ```
- Handles follow-up overdue status checks, notification reminders, and cleanup.

### B. Reliable Queue Worker on Shared/Cloud Hosting
Since process supervisors (like Supervisor) may not run daemon processes permanently on shared cloud plans, execute queue work per minute with `--stop-when-empty`:
- **Command:**
  ```bash
  * * * * * cd /home/u123456789/nexflow_core && /usr/bin/php artisan queue:work --stop-when-empty --tries=3 --timeout=60 >> /dev/null 2>&1
  ```

---

## 6. Official Meta Graph API & Webhook Setup

1. **Create Meta App:** Go to [developers.facebook.com](https://developers.facebook.com) -> Create App -> Business Type.
2. **Add Products:**
   - **Facebook Login for Business**
   - **Webhooks**
   - **Messenger**
   - **WhatsApp**
3. **Configure Webhook Endpoints:**
   - Callback URL: `https://yourdomain.com/api/webhooks/facebook`
   - Verify Token: Matches `META_WEBHOOK_VERIFY_TOKEN` in `.env`
   - Subscription Fields: `messages`, `messaging_postbacks`, `feed`, `mention`
4. **Permanent Page Access Tokens:**
   - Obtain System User Access Token or permanent Page Token with permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_messaging`.
   - Enter token directly in **Social Connections -> Connect New Channel**. Tokens are encrypted at rest with AES-256-CBC.

---

## 7. Default System Accounts

- **Super Admin:** `admin@nexflow.ai` / `password123`
- **Team Manager:** `manager@nexflow.ai` / `password123`
- **Moderator:** `moderator@nexflow.ai` / `password123`

*(Change passwords immediately upon first production login via the My Profile page).*

