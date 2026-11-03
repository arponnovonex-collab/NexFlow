-- NexFlow AI MySQL Database Export
-- Compatible with MySQL 8.0+ / MariaDB 10.4+ / Hostinger phpMyAdmin

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- Table structure for table `users`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `role` enum('super_admin','admin','moderator') NOT NULL DEFAULT 'moderator',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `phone` varchar(255) DEFAULT NULL,
  `avatar_url` varchar(255) DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `last_login_ip` varchar(45) DEFAULT NULL,
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `two_factor_secret` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`id`, `name`, `email`, `role`, `status`, `phone`, `avatar_url`, `password`, `created_at`, `updated_at`) VALUES
(1, 'NexFlow Super Admin', 'admin@nexflow.ai', 'super_admin', 'active', '+8801811223344', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', '$2y$12$R.cWkR23v0LhY5332YQY8.kUv7p3V04b4q0G43h9pW8z0J8F2V8aK', NOW(), NOW()),
(2, 'Tariq Manager', 'manager@nexflow.ai', 'admin', 'active', '+8801711223344', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', '$2y$12$R.cWkR23v0LhY5332YQY8.kUv7p3V04b4q0G43h9pW8z0J8F2V8aK', NOW(), NOW()),
(3, 'Sarah Moderator', 'moderator@nexflow.ai', 'moderator', 'active', '+8801911223344', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', '$2y$12$R.cWkR23v0LhY5332YQY8.kUv7p3V04b4q0G43h9pW8z0J8F2V8aK', NOW(), NOW());

-- --------------------------------------------------------
-- Table structure for table `login_histories`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `login_histories`;
CREATE TABLE `login_histories` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'success',
  `login_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `login_histories_user_id_login_at_index` (`user_id`,`login_at`),
  CONSTRAINT `login_histories_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `personal_access_tokens`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `personal_access_tokens`;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `social_accounts`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `social_accounts`;
CREATE TABLE `social_accounts` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `platform` enum('facebook_page','instagram_business','whatsapp_cloud') NOT NULL,
  `account_id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `username` varchar(255) DEFAULT NULL,
  `profile_picture_url` text DEFAULT NULL,
  `access_token` longtext NOT NULL,
  `refresh_token` longtext DEFAULT NULL,
  `token_expires_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `status` enum('connected','disconnected','expired','error') NOT NULL DEFAULT 'connected',
  `permissions` json DEFAULT NULL,
  `webhook_verified` tinyint(1) NOT NULL DEFAULT 0,
  `last_synced_at` timestamp NULL DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `settings` json DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `social_accounts_platform_account_id_unique` (`platform`,`account_id`),
  KEY `social_accounts_account_id_index` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `social_account_assignments`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `social_account_assignments`;
CREATE TABLE `social_account_assignments` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `social_account_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `social_account_assignments_unique` (`social_account_id`,`user_id`),
  KEY `social_account_assignments_user_id_foreign` (`user_id`),
  CONSTRAINT `social_account_assignments_account_foreign` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `social_account_assignments_user_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `webhook_events`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `webhook_events`;
CREATE TABLE `webhook_events` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `platform` varchar(50) NOT NULL,
  `event_id` varchar(255) DEFAULT NULL,
  `event_type` varchar(100) NOT NULL,
  `payload` json NOT NULL,
  `processed` tinyint(1) NOT NULL DEFAULT 0,
  `processed_at` timestamp NULL DEFAULT NULL,
  `error` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `webhook_events_platform_index` (`platform`),
  KEY `webhook_events_event_id_index` (`event_id`),
  KEY `webhook_events_event_type_index` (`event_type`),
  KEY `webhook_events_processed_index` (`processed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `product_categories`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `product_categories`;
CREATE TABLE `product_categories` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_categories_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `product_categories` (`id`, `name`, `slug`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Women\'s Fashion', 'womens-fashion', 'Premium traditional and contemporary outfits for women', 1, NOW(), NOW()),
(2, 'Kids Collection', 'kids-collection', 'Comfortable and trendy clothing for kids', 1, NOW(), NOW());

-- --------------------------------------------------------
-- Table structure for table `products`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `short_description` text DEFAULT NULL,
  `full_description` longtext DEFAULT NULL,
  `regular_price` decimal(10,2) NOT NULL,
  `selling_price` decimal(10,2) NOT NULL,
  `discount_price` decimal(10,2) DEFAULT NULL,
  `material` varchar(255) DEFAULT NULL,
  `features` json DEFAULT NULL,
  `availability` enum('in_stock','out_of_stock','pre_order') NOT NULL DEFAULT 'in_stock',
  `product_url` varchar(255) DEFAULT NULL,
  `delivery_charge_inside_dhaka` decimal(8,2) NOT NULL DEFAULT 70.00,
  `delivery_charge_outside_dhaka` decimal(8,2) NOT NULL DEFAULT 130.00,
  `estimated_delivery_time` varchar(255) NOT NULL DEFAULT '2-4 business days',
  `return_policy` text DEFAULT NULL,
  `exchange_policy` text DEFAULT NULL,
  `faqs` json DEFAULT NULL,
  `internal_notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_sku_unique` (`sku`),
  UNIQUE KEY `products_slug_unique` (`slug`),
  KEY `products_category_id_foreign` (`category_id`),
  CONSTRAINT `products_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `products` (`id`, `category_id`, `name`, `sku`, `slug`, `short_description`, `regular_price`, `selling_price`, `delivery_charge_inside_dhaka`, `delivery_charge_outside_dhaka`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, 'Ruby Twinkle Embroidered Dress', 'NF-DRS-001', 'ruby-twinkle-embroidered-dress', 'Crimson embroidered silk Georgette kurti set with organza dupatta.', 1450.00, 1250.00, 70.00, 130.00, 1, NOW(), NOW()),
(2, 1, 'Pippie Floral Maxi Gown', 'NF-DRS-002', 'pippie-floral-maxi-gown', 'Chic pastel floral tiered maxi gown with inner lining.', 1800.00, 1550.00, 70.00, 130.00, 1, NOW(), NOW());

-- --------------------------------------------------------
-- Table structure for table `product_variants`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `product_variants`;
CREATE TABLE `product_variants` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `size` varchar(50) DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `sku` varchar(255) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_variants_product_id_size_color_index` (`product_id`,`size`,`color`),
  CONSTRAINT `product_variants_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `product_variants` (`product_id`, `size`, `color`, `sku`, `price`, `stock`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'M', 'Ruby Red', 'NF-DRS-001-M-RED', 1250.00, 15, 1, NOW(), NOW()),
(1, 'L', 'Ruby Red', 'NF-DRS-001-L-RED', 1250.00, 8, 1, NOW(), NOW()),
(1, 'XL', 'Ruby Red', 'NF-DRS-001-XL-RED', 1250.00, 4, 1, NOW(), NOW()),
(2, 'Free Size', 'Pastel Mint', 'NF-DRS-002-FREE-MINT', 1550.00, 20, 1, NOW(), NOW());

-- --------------------------------------------------------
-- Table structure for table `social_posts`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `social_posts`;
CREATE TABLE `social_posts` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `social_account_id` bigint(20) UNSIGNED NOT NULL,
  `platform_post_id` varchar(255) NOT NULL,
  `message` text DEFAULT NULL,
  `media_url` text DEFAULT NULL,
  `permalink` text DEFAULT NULL,
  `is_auto_reply_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `reply_tone` varchar(50) NOT NULL DEFAULT 'friendly',
  `ai_model` varchar(50) DEFAULT NULL,
  `manual_approval_required` tinyint(1) NOT NULL DEFAULT 0,
  `published_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `social_posts_platform_post_id_index` (`platform_post_id`),
  KEY `social_posts_social_account_id_foreign` (`social_account_id`),
  CONSTRAINT `social_posts_account_foreign` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `post_product_mappings`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `post_product_mappings`;
CREATE TABLE `post_product_mappings` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `social_post_id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `post_product_mappings_unique` (`social_post_id`,`product_id`),
  KEY `post_product_mappings_product_id_foreign` (`product_id`),
  CONSTRAINT `post_product_mappings_post_foreign` FOREIGN KEY (`social_post_id`) REFERENCES `social_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_product_mappings_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `customers`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `avatar_url` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customers_email_phone_index` (`email`,`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `customer_channel_identities`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `customer_channel_identities`;
CREATE TABLE `customer_channel_identities` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `social_account_id` bigint(20) UNSIGNED NOT NULL,
  `platform` enum('facebook_page','instagram_business','whatsapp_cloud') NOT NULL,
  `platform_customer_id` varchar(255) NOT NULL,
  `profile_name` varchar(255) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `channel_identity_unique` (`social_account_id`,`platform`,`platform_customer_id`),
  KEY `customer_channel_identities_customer_id_foreign` (`customer_id`),
  CONSTRAINT `customer_channel_identities_customer_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_channel_identities_account_foreign` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `conversations`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `conversations`;
CREATE TABLE `conversations` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `social_account_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `platform` enum('facebook_page','instagram_business','whatsapp_cloud') NOT NULL,
  `channel_conversation_id` varchar(255) DEFAULT NULL,
  `status` enum('pending','active','resolved') NOT NULL DEFAULT 'pending',
  `ai_mode` enum('auto','suggestion_only','human_only') NOT NULL DEFAULT 'auto',
  `is_human_takeover` tinyint(1) NOT NULL DEFAULT 0,
  `assigned_to_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `last_message_at` timestamp NULL DEFAULT NULL,
  `unread_count` int(11) NOT NULL DEFAULT 0,
  `priority` enum('normal','urgent') NOT NULL DEFAULT 'normal',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `conversations_status_assigned_to_user_id_index` (`status`,`assigned_to_user_id`),
  KEY `conversations_social_account_id_foreign` (`social_account_id`),
  KEY `conversations_customer_id_foreign` (`customer_id`),
  KEY `conversations_assigned_to_user_id_foreign` (`assigned_to_user_id`),
  CONSTRAINT `conversations_account_foreign` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversations_customer_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversations_user_foreign` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `messages`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint(20) UNSIGNED NOT NULL,
  `sender_type` enum('customer','moderator','ai','system') NOT NULL,
  `sender_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `platform_message_id` varchar(255) DEFAULT NULL,
  `text` text DEFAULT NULL,
  `message_type` varchar(50) NOT NULL DEFAULT 'text',
  `payload` json DEFAULT NULL,
  `delivery_status` enum('pending','sent','delivered','read','failed') NOT NULL DEFAULT 'pending',
  `is_internal_note` tinyint(1) NOT NULL DEFAULT 0,
  `sent_at` timestamp NULL DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `messages_conversation_id_created_at_index` (`conversation_id`,`created_at`),
  KEY `messages_sender_user_id_foreign` (`sender_user_id`),
  CONSTRAINT `messages_conversation_foreign` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_user_foreign` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `social_comments`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `social_comments`;
CREATE TABLE `social_comments` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `social_post_id` bigint(20) UNSIGNED NOT NULL,
  `platform_comment_id` varchar(255) NOT NULL,
  `parent_comment_id` varchar(255) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `platform_user_id` varchar(255) DEFAULT NULL,
  `message` text NOT NULL,
  `intent` varchar(50) DEFAULT NULL,
  `sentiment` varchar(20) DEFAULT NULL,
  `reply_status` enum('unanswered','replied','ignored','requires_approval') NOT NULL DEFAULT 'unanswered',
  `reply_text` text DEFAULT NULL,
  `is_page_owned` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `social_comments_social_post_id_foreign` (`social_post_id`),
  CONSTRAINT `social_comments_post_foreign` FOREIGN KEY (`social_post_id`) REFERENCES `social_posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `comment_replies`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `comment_replies`;
CREATE TABLE `comment_replies` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `social_comment_id` bigint(20) UNSIGNED NOT NULL,
  `reply_text` text NOT NULL,
  `sender_type` enum('ai','moderator') NOT NULL DEFAULT 'ai',
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `platform_reply_id` varchar(255) DEFAULT NULL,
  `status` enum('draft','approved','published','failed') NOT NULL DEFAULT 'published',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `comment_replies_social_comment_id_foreign` (`social_comment_id`),
  KEY `comment_replies_user_id_foreign` (`user_id`),
  CONSTRAINT `comment_replies_comment_foreign` FOREIGN KEY (`social_comment_id`) REFERENCES `social_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comment_replies_user_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `leads`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `leads`;
CREATE TABLE `leads` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `conversation_id` bigint(20) UNSIGNED DEFAULT NULL,
  `assigned_to_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` enum('cold','warm','hot','converted','lost') NOT NULL DEFAULT 'cold',
  `suggested_status` varchar(20) DEFAULT NULL,
  `confidence` decimal(5,2) DEFAULT NULL,
  `related_product_id` bigint(20) UNSIGNED DEFAULT NULL,
  `last_status_change_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `leads_status_assigned_to_user_id_index` (`status`,`assigned_to_user_id`),
  KEY `leads_customer_id_foreign` (`customer_id`),
  KEY `leads_conversation_id_foreign` (`conversation_id`),
  KEY `leads_assigned_to_user_id_foreign` (`assigned_to_user_id`),
  KEY `leads_related_product_id_foreign` (`related_product_id`),
  CONSTRAINT `leads_customer_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leads_conversation_foreign` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leads_user_foreign` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leads_product_foreign` FOREIGN KEY (`related_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `lead_status_histories`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `lead_status_histories`;
CREATE TABLE `lead_status_histories` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `previous_status` varchar(20) DEFAULT NULL,
  `new_status` varchar(20) NOT NULL,
  `changed_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `source` enum('manual','ai','system') NOT NULL DEFAULT 'manual',
  `reason` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lead_status_histories_lead_id_foreign` (`lead_id`),
  CONSTRAINT `lead_status_histories_lead_foreign` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `lead_followups`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `lead_followups`;
CREATE TABLE `lead_followups` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `conversation_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `followup_date` date NOT NULL,
  `followup_time` time DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `status` enum('scheduled','due_today','overdue','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lead_followups_followup_date_status_user_id_index` (`followup_date`,`status`,`user_id`),
  KEY `lead_followups_lead_id_foreign` (`lead_id`),
  CONSTRAINT `lead_followups_lead_foreign` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `orders`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_number` varchar(255) NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `conversation_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `product_id` bigint(20) UNSIGNED DEFAULT NULL,
  `variant_id` bigint(20) UNSIGNED DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `delivery_charge` decimal(8,2) NOT NULL DEFAULT 0.00,
  `total_amount` decimal(10,2) NOT NULL,
  `order_status` enum('draft','pending_confirmation','confirmed','processing','shipped','delivered','cancelled','returned') NOT NULL DEFAULT 'draft',
  `payment_status` enum('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
  `order_source` enum('manual_inbox','web','import') NOT NULL DEFAULT 'manual_inbox',
  `customer_address` text DEFAULT NULL,
  `customer_phone` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_order_number_unique` (`order_number`),
  KEY `orders_order_status_customer_id_index` (`order_status`,`customer_id`),
  KEY `orders_customer_id_foreign` (`customer_id`),
  CONSTRAINT `orders_customer_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `ai_settings`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `ai_settings`;
CREATE TABLE `ai_settings` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` varchar(255) NOT NULL,
  `value` text DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ai_settings_key_unique` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `ai_settings` (`key`, `value`, `description`, `created_at`, `updated_at`) VALUES
('openai_model', 'gpt-4o-mini', 'OpenAI Model', NOW(), NOW()),
('default_tone', 'friendly', 'Default Tone', NOW(), NOW()),
('comment_auto_reply_enabled', 'true', 'Comment Auto Reply Enabled', NOW(), NOW()),
('messenger_auto_reply_enabled', 'true', 'Messenger Auto Reply Enabled', NOW(), NOW()),
('instagram_auto_reply_enabled', 'true', 'Instagram Auto Reply Enabled', NOW(), NOW()),
('whatsapp_auto_reply_enabled', 'true', 'Whatsapp Auto Reply Enabled', NOW(), NOW()),
('daily_token_limit', '250000', 'Daily Token Limit', NOW(), NOW()),
('global_ai_instructions', 'You are a polite, helpful customer support and sales assistant for an e-commerce clothing brand in Bangladesh. Respond naturally in Bangla, English, or Banglish according to customer language. Keep replies concise, warm, and accurate. Always use verified prices, sizes, stock, and delivery charges only. Never invent products or make unapproved commitments.', 'Global Prompt Instructions', NOW(), NOW());

-- --------------------------------------------------------
-- Table structure for table `automation_rules`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `automation_rules`;
CREATE TABLE `automation_rules` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `scope` enum('global','facebook','instagram','whatsapp','page','post') NOT NULL DEFAULT 'global',
  `social_account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `condition_type` varchar(50) NOT NULL,
  `condition_payload` json DEFAULT NULL,
  `action_type` varchar(50) NOT NULL,
  `action_payload` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `priority` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `ai_usage_logs`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `ai_usage_logs`;
CREATE TABLE `ai_usage_logs` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `context_type` varchar(50) NOT NULL,
  `model` varchar(50) NOT NULL,
  `prompt_tokens` int(11) NOT NULL DEFAULT 0,
  `completion_tokens` int(11) NOT NULL DEFAULT 0,
  `total_tokens` int(11) NOT NULL DEFAULT 0,
  `estimated_cost` decimal(8,5) NOT NULL DEFAULT 0.00000,
  `response_payload` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ai_usage_logs_context_type_created_at_index` (`context_type`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `activity_logs`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` bigint(20) UNSIGNED DEFAULT NULL,
  `description` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `activity_logs_action_created_at_index` (`action`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `notifications`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'info',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `link` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_is_read_index` (`user_id`,`is_read`),
  CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `integration_errors`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `integration_errors`;
CREATE TABLE `integration_errors` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `platform` varchar(50) NOT NULL,
  `endpoint` varchar(255) DEFAULT NULL,
  `error_message` text NOT NULL,
  `request_payload` json DEFAULT NULL,
  `response_payload` json DEFAULT NULL,
  `resolved` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `integration_errors_platform_index` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
COMMIT;

