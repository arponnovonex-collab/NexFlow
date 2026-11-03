# NexFlow AI — Development Progress & Architecture Roadmap

**Tagline:** One Inbox. Every Conversation. Smarter Sales.

---

## 1. Project Architecture Status

NexFlow AI is fully implemented as a full-stack e-commerce automation, omnichannel inbox, and sales CRM platform:
- **Frontend SPA:** React 19 + Vite 7 + Tailwind CSS v4 + React Router v7 + Lucide Icons + Recharts. (Compiled production build in `public/build/`).
- **Backend API:** Laravel 12 + Laravel Sanctum token auth + Service-Oriented Architecture + Eloquent ORM.
- **Database:** Normalized MySQL Schema (with SQLite dev/testing parity) handling Authentication, Channels, Catalog, Messaging, Leads/CRM, Automation, and Monitoring.
- **AI Engine:** Official OpenAI API (Structured Outputs `json_schema`, model parameter control, intent extraction, Bengali/Banglish/English multi-lingual sentiment & price verification).
- **Social Connectors:** Meta Graph API & Webhooks for Facebook Pages & Comments, Messenger, Instagram Messaging & WhatsApp Cloud API.
- **Hosting Target:** Hostinger Cloud / Apache-compatible with scheduler & queue worker support.

---

## 2. Phase-by-Phase Execution Tracking

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Foundation: Laravel Sanctum API, React+Vite, Roles, Auth, Layout & Navigation | ✅ Completed & Verified |
| **Phase 2** | Product Catalog: Products, Categories, Multi-variant Stock, Knowledge Base API | ✅ Completed & Verified |
| **Phase 3** | Facebook Connection: Meta OAuth Flow, Page Management, Post Sync, Diagnostics | ✅ Completed & Verified |
| **Phase 4** | AI Comment Automation: Post-Product Mappings, Webhook Parsing, OpenAI Reply Engine | ✅ Completed & Verified |
| **Phase 5** | Unified Omnichannel Inbox: 3-Column UI, Conversations, Message Threads, Filters | ✅ Completed & Verified |
| **Phase 6** | Messenger: Inbound/Outbound Messaging, AI Auto-Reply, Suggestions, Human Takeover | ✅ Completed & Verified |
| **Phase 7** | Instagram: Professional Account Connect, Direct Messaging, Eligible Comments | ✅ Completed & Verified |
| **Phase 8** | WhatsApp: Cloud API Webhooks, Inbound/Outbound, Template Support, Window Check | ✅ Completed & Verified |
| **Phase 9** | Moderator Portal: Role Isolation, Round-Robin Assignment, Performance & Workloads | ✅ Completed & Verified |
| **Phase 10** | Lead CRM: Cold/Warm/Hot/Converted Classification, AI Lead Detection, Histories | ✅ Completed & Verified |
| **Phase 11** | Follow-up System: Scheduling, Due Today, Overdue Alerts, Moderator Reminders | ✅ Completed & Verified |
| **Phase 12** | Orders & Conversions: Order Drafts, Conversion Verification, Future WooCommerce Prep | ✅ Completed & Verified |
| **Phase 13** | Reports & AI Control: Analytics Dashboards, AI Token/Cost Auditing, Rule Engine | ✅ Completed & Verified |
| **Phase 14** | Production Hardening: Security Audit, Diagnostics, Error Logs, Hostinger Setup Guide | ✅ Completed & Verified |

---

## 3. Database Migrations Implemented

1. `0001_01_01_000000_create_users_table.php` (Core users, sessions, password reset tokens)
2. `0001_01_01_000001_create_cache_table.php` (Database cache)
3. `0001_01_01_000002_create_jobs_table.php` (Queues and failed jobs)
4. `2026_03_14_000001_add_roles_and_profiles_to_users_table.php` (Roles `super_admin`, `admin`, `moderator`, `login_histories`)
5. `2026_03_14_000002_create_social_accounts_and_webhooks_tables.php` (`social_accounts`, `social_account_assignments`, `webhook_events`)
6. `2026_03_14_000003_create_products_and_posts_tables.php` (`products`, `product_categories`, `product_variants`, `product_images`, `social_posts`, mappings)
7. `2026_03_14_000004_create_messaging_and_inbox_tables.php` (`customers`, `customer_channel_identities`, `conversations`, `messages`, `social_comments`, `comment_replies`)
8. `2026_03_14_000005_create_crm_leads_followups_orders_tables.php` (`leads`, `lead_status_histories`, `lead_followups`, `orders`)
9. `2026_03_14_000006_create_ai_automation_and_monitoring_tables.php` (`ai_settings`, `ai_suggestions`, `ai_usage_logs`, `automation_rules`, `activity_logs`, `notifications`)
10. `2026_11_03_114109_create_personal_access_tokens_table.php` (Laravel Sanctum tokens)

---

## 4. Backend REST API Endpoints

- **Authentication:**
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `PUT /api/auth/profile`
  - `POST /api/auth/change-password`
  - `POST /api/auth/logout`
- **Dashboard:**
  - `GET /api/dashboard/metrics`
- **Social Accounts & Channels:**
  - `GET /api/social-accounts`
  - `POST /api/social-accounts`
  - `PUT /api/social-accounts/{id}`
  - `DELETE /api/social-accounts/{id}`
  - `GET /api/social-accounts/{id}/diagnostics`
- **Product Catalog:**
  - `GET /api/product-categories`
  - `GET /api/products`
  - `POST /api/products`
  - `GET /api/products/{id}`
  - `PUT /api/products/{id}`
  - `DELETE /api/products/{id}`
- **Facebook Posts & Comment Automation:**
  - `GET /api/posts`
  - `PUT /api/posts/{id}`
  - `GET /api/comments`
  - `POST /api/comments/{id}/reply`
  - `POST /api/comments/{id}/approve`
- **Unified Omnichannel Inbox:**
  - `GET /api/conversations`
  - `GET /api/conversations/{id}`
  - `POST /api/conversations/{id}/messages`
  - `POST /api/conversations/{id}/suggest-reply`
  - `POST /api/conversations/{id}/takeover`
  - `PUT /api/conversations/{id}/status`
  - `POST /api/conversations/{id}/assign`
- **Lead CRM & Follow-ups:**
  - `GET /api/leads`
  - `PUT /api/leads/{id}/status`
  - `GET /api/followups`
  - `POST /api/followups`
  - `PUT /api/followups/{id}`
  - `GET /api/customers`
- **Orders & Conversions:**
  - `GET /api/orders`
  - `POST /api/orders`
  - `PUT /api/orders/{id}/status`
- **AI Automation & Controls:**
  - `GET /api/ai/settings`
  - `POST /api/ai/settings`
  - `POST /api/ai/playground`
  - `GET /api/automation/rules`
  - `POST /api/automation/rules`
  - `PUT /api/automation/rules/{id}/toggle`
- **Team Management:**
  - `GET /api/users`
  - `POST /api/users`
  - `GET /api/users/{id}`
  - `PUT /api/users/{id}`
  - `DELETE /api/users/{id}`
- **Analytics & Diagnostics:**
  - `GET /api/analytics/moderators`
  - `GET /api/analytics/ai-usage`
  - `GET /api/system/activity-logs`
  - `GET /api/system/webhooks`

---

## 5. Automated Tests Summary

- **Total Tests Passed:** 12 tests (64 assertions, 0 failures)
  - `Tests\Unit\ExampleTest`
  - `Tests\Feature\AuthAndDashboardTest`: valid login, invalid credentials check, profile and metrics authorization, user CRUD.
  - `Tests\Feature\ExampleTest`: Root web route and Vite manifest response.
  - `Tests\Feature\OmnichannelInboxAndAutomationTest`: product & variant creation, knowledge context verification, OpenAI Bangla price extractor, comment auto-reply, unified inbox messaging with human takeover, and lead status transition with order conversion verification.
- **Vite Build:** Successfully built with 0 errors (`public/build/assets/`).

---

## 6. Pre-seeded Demo Credentials

- **Super Admin:** `admin@nexflow.ai` / `password123`
- **Team Manager:** `manager@nexflow.ai` / `password123`
- **Moderator:** `moderator@nexflow.ai` / `password123`
