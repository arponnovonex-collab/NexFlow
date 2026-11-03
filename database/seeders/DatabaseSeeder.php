<?php

namespace Database\Seeders;

use App\Models\AiSetting;
use App\Models\Conversation;
use App\Models\ConversationTag;
use App\Models\Customer;
use App\Models\CustomerChannelIdentity;
use App\Models\Lead;
use App\Models\LeadFollowup;
use App\Models\LeadStatusHistory;
use App\Models\Message;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\SocialAccount;
use App\Models\SocialComment;
use App\Models\SocialPost;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Users & Roles
        $superAdmin = User::firstOrCreate(
            ['email' => 'admin@nexflow.ai'],
            [
                'name' => 'NexFlow Super Admin',
                'password' => Hash::make('password123'),
                'role' => 'super_admin',
                'status' => 'active',
                'phone' => '+8801811223344',
                'avatar_url' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            ]
        );

        $manager = User::firstOrCreate(
            ['email' => 'manager@nexflow.ai'],
            [
                'name' => 'Tariq Manager',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'status' => 'active',
                'phone' => '+8801711223344',
                'avatar_url' => 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            ]
        );

        $moderator = User::firstOrCreate(
            ['email' => 'moderator@nexflow.ai'],
            [
                'name' => 'Sarah Moderator',
                'password' => Hash::make('password123'),
                'role' => 'moderator',
                'status' => 'active',
                'phone' => '+8801911223344',
                'avatar_url' => 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
            ]
        );

        // 2. AI Settings
        $aiSettings = [
            'openai_api_key' => 'sk-mock-key-configure-in-settings',
            'openai_model' => 'gpt-4o-mini',
            'global_ai_instructions' => 'You are a polite, helpful customer support and sales assistant for an e-commerce brand in Bangladesh. Respond naturally in Bangla, English, or Banglish according to customer language. Keep replies concise, warm, and accurate. Always use verified prices, sizes, stock, and delivery charges only. Never invent products or make unapproved commitments.',
            'default_tone' => 'friendly',
            'comment_auto_reply_enabled' => 'true',
            'messenger_auto_reply_enabled' => 'true',
            'instagram_auto_reply_enabled' => 'true',
            'whatsapp_auto_reply_enabled' => 'true',
            'daily_token_limit' => '250000',
            'monthly_token_limit' => '5000000',
            'temperature' => '0.3',
        ];

        foreach ($aiSettings as $key => $val) {
            AiSetting::updateOrCreate(['key' => $key], ['value' => $val, 'description' => ucfirst(str_replace('_', ' ', $key))]);
        }

        // 3. Product Catalog
        $womenCategory = ProductCategory::firstOrCreate(
            ['slug' => 'womens-fashion'],
            ['name' => "Women's Fashion", 'description' => 'Premium traditional and contemporary outfits for women']
        );

        $kidsCategory = ProductCategory::firstOrCreate(
            ['slug' => 'kids-collection'],
            ['name' => 'Kids Collection', 'description' => 'Comfortable and trendy clothing for kids']
        );

        $product1 = Product::firstOrCreate(
            ['sku' => 'NF-DRS-001'],
            [
                'category_id' => $womenCategory->id,
                'name' => 'Ruby Twinkle Embroidered Dress',
                'slug' => 'ruby-twinkle-embroidered-dress',
                'short_description' => 'Elegant crimson embroidered silk Georgette kurti set with organza dupatta.',
                'full_description' => 'Crafted with premium silk Georgette, featuring intricate hand embroidery on neck and sleeves. Comes with matching tailored pants and soft organza dupatta.',
                'regular_price' => 1450.00,
                'selling_price' => 1250.00,
                'discount_price' => 1250.00,
                'material' => 'Silk Georgette & Organza',
                'features' => ['Hand Embroidered', 'Breathable Fabric', 'Organza Dupatta Included'],
                'availability' => 'in_stock',
                'product_url' => 'https://nexflowfashion.example.com/products/ruby-twinkle',
                'delivery_charge_inside_dhaka' => 70.00,
                'delivery_charge_outside_dhaka' => 130.00,
                'estimated_delivery_time' => '2-3 days inside Dhaka, 3-5 days outside Dhaka',
                'return_policy' => '7 days easy return with tag intact',
                'exchange_policy' => 'Size exchange available within 3 days of delivery',
                'faqs' => [
                    ['q' => 'Is color guaranteed?', 'a' => 'Yes, 100% color fastness guaranteed.'],
                    ['q' => 'Can I pay cash on delivery?', 'a' => 'Yes, Cash on Delivery is available all over Bangladesh.'],
                ],
                'internal_notes' => 'Best selling Eid collection item.',
                'is_active' => true,
            ]
        );

        ProductVariant::firstOrCreate(['product_id' => $product1->id, 'size' => 'M', 'color' => 'Ruby Red'], [
            'sku' => 'NF-DRS-001-M-RED',
            'price' => 1250.00,
            'stock' => 15,
            'is_active' => true,
        ]);

        ProductVariant::firstOrCreate(['product_id' => $product1->id, 'size' => 'L', 'color' => 'Ruby Red'], [
            'sku' => 'NF-DRS-001-L-RED',
            'price' => 1250.00,
            'stock' => 8,
            'is_active' => true,
        ]);

        ProductVariant::firstOrCreate(['product_id' => $product1->id, 'size' => 'XL', 'color' => 'Ruby Red'], [
            'sku' => 'NF-DRS-001-XL-RED',
            'price' => 1250.00,
            'stock' => 4,
            'is_active' => true,
        ]);

        $product2 = Product::firstOrCreate(
            ['sku' => 'NF-DRS-002'],
            [
                'category_id' => $womenCategory->id,
                'name' => 'Pippie Floral Maxi Gown',
                'slug' => 'pippie-floral-maxi-gown',
                'short_description' => 'Chic pastel floral tiered maxi gown with lightweight inner lining.',
                'full_description' => 'A relaxed silhouette featuring pastel floral digital print, puff sleeves, and tiered hem.',
                'regular_price' => 1800.00,
                'selling_price' => 1550.00,
                'material' => 'Chiffon & Cotton Lining',
                'features' => ['Puff Sleeves', 'Digital Floral Print', 'Tiered Flare'],
                'availability' => 'in_stock',
                'delivery_charge_inside_dhaka' => 70.00,
                'delivery_charge_outside_dhaka' => 130.00,
                'estimated_delivery_time' => '2-3 days inside Dhaka',
                'return_policy' => '7 days easy return',
                'exchange_policy' => 'Exchange available within 3 days',
                'is_active' => true,
            ]
        );

        ProductVariant::firstOrCreate(['product_id' => $product2->id, 'size' => 'Free Size', 'color' => 'Pastel Mint'], [
            'sku' => 'NF-DRS-002-FREE-MINT',
            'price' => 1550.00,
            'stock' => 20,
            'is_active' => true,
        ]);

        $product3 = Product::firstOrCreate(
            ['sku' => 'NF-KID-003'],
            [
                'category_id' => $kidsCategory->id,
                'name' => 'Organic Cotton Romper (4Y)',
                'slug' => 'organic-cotton-romper-4y',
                'short_description' => 'Ultra-soft 100% organic cotton jumpsuit for 3-4 year old kids.',
                'regular_price' => 750.00,
                'selling_price' => 650.00,
                'material' => '100% Organic Combed Cotton',
                'availability' => 'in_stock',
                'delivery_charge_inside_dhaka' => 70.00,
                'delivery_charge_outside_dhaka' => 130.00,
                'is_active' => true,
            ]
        );

        ProductVariant::firstOrCreate(['product_id' => $product3->id, 'size' => '4 Year', 'color' => 'Sky Blue'], [
            'sku' => 'NF-KID-003-4Y-BLUE',
            'price' => 650.00,
            'stock' => 12,
            'is_active' => true,
        ]);

        // 4. Social Accounts
        $fbPage = SocialAccount::firstOrCreate(
            ['platform' => 'facebook_page', 'account_id' => 'fb_page_109283748291'],
            [
                'name' => 'NexFlow Fashion BD',
                'username' => 'nexflow.fashion.bd',
                'profile_picture_url' => 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100',
                'access_token' => 'EAAXMOCK_TOKEN_FACEBOOK_PAGE_PERMANENT_TEST',
                'token_expires_at' => null,
                'is_active' => true,
                'status' => 'connected',
                'permissions' => [
                    'pages_show_list' => 'granted',
                    'pages_read_engagement' => 'granted',
                    'pages_manage_posts' => 'granted',
                    'pages_messaging' => 'granted',
                    'pages_read_user_content' => 'granted',
                ],
                'webhook_verified' => true,
                'last_synced_at' => now(),
                'settings' => [
                    'auto_reply_comments' => true,
                    'auto_reply_messages' => true,
                    'ai_mode' => 'auto',
                    'default_tone' => 'friendly',
                ],
                'metadata' => [
                    'category' => 'Clothing (Brand)',
                    'followers_count' => 45200,
                    'likes' => 42100,
                ],
            ]
        );

        $igAccount = SocialAccount::firstOrCreate(
            ['platform' => 'instagram_business', 'account_id' => 'ig_biz_178414002938192'],
            [
                'name' => 'NexFlow Lifestyle Instagram',
                'username' => 'nexflow_lifestyle',
                'profile_picture_url' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
                'access_token' => 'IG_MOCK_TOKEN_PERMANENT_TEST',
                'is_active' => true,
                'status' => 'connected',
                'permissions' => [
                    'instagram_basic' => 'granted',
                    'instagram_manage_messages' => 'granted',
                    'instagram_manage_comments' => 'granted',
                ],
                'webhook_verified' => true,
                'last_synced_at' => now(),
                'settings' => [
                    'ai_mode' => 'auto',
                    'default_tone' => 'friendly',
                ],
                'metadata' => [
                    'followers_count' => 18900,
                ],
            ]
        );

        $waAccount = SocialAccount::firstOrCreate(
            ['platform' => 'whatsapp_cloud', 'account_id' => 'wa_phone_99283746182'],
            [
                'name' => 'NexFlow Official WhatsApp Sales',
                'username' => '+8801800000000',
                'profile_picture_url' => 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=100',
                'access_token' => 'WA_CLOUD_MOCK_TOKEN_TEST',
                'is_active' => true,
                'status' => 'connected',
                'permissions' => [
                    'whatsapp_business_messaging' => 'granted',
                    'whatsapp_business_management' => 'granted',
                ],
                'webhook_verified' => true,
                'last_synced_at' => now(),
                'settings' => [
                    'ai_mode' => 'auto',
                    'messaging_window_hours' => 24,
                ],
                'metadata' => [
                    'waba_id' => '1029384756',
                    'display_phone_number' => '+880 1800-000000',
                    'quality_rating' => 'GREEN',
                ],
            ]
        );

        // Assign accounts to moderator
        $fbPage->assignedUsers()->syncWithoutDetaching([$moderator->id, $manager->id]);
        $igAccount->assignedUsers()->syncWithoutDetaching([$moderator->id]);
        $waAccount->assignedUsers()->syncWithoutDetaching([$moderator->id, $manager->id]);

        // Mappings
        $fbPage->products()->syncWithoutDetaching([$product1->id, $product2->id, $product3->id]);

        // 5. Facebook Post & Product Mapping
        $post1 = SocialPost::firstOrCreate(
            ['social_account_id' => $fbPage->id, 'platform_post_id' => 'post_1001_ruby_launch'],
            [
                'message' => '✨ New Arrival Alert! Experience royalty with our Ruby Twinkle embroidered dress. Limited stock available now! Inbox us or comment below to order. #EidFashion #NexFlow',
                'media_url' => 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600',
                'permalink' => 'https://facebook.com/nexflow.fashion.bd/posts/1001',
                'is_auto_reply_enabled' => true,
                'reply_tone' => 'friendly',
                'published_at' => now()->subDays(2),
            ]
        );
        $post1->products()->syncWithoutDetaching([$product1->id]);

        $post2 = SocialPost::firstOrCreate(
            ['social_account_id' => $fbPage->id, 'platform_post_id' => 'post_1002_pippie_gown'],
            [
                'message' => '🌸 Gentle vibes with our Pippie Floral Maxi Gown. Perfect for sunny outings and brunch dates! Order today.',
                'media_url' => 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600',
                'permalink' => 'https://facebook.com/nexflow.fashion.bd/posts/1002',
                'is_auto_reply_enabled' => true,
                'reply_tone' => 'friendly',
                'published_at' => now()->subDay(),
            ]
        );
        $post2->products()->syncWithoutDetaching([$product2->id]);

        // Sample Social Comments
        SocialComment::firstOrCreate(
            ['social_post_id' => $post1->id, 'platform_comment_id' => 'cmt_9981_price'],
            [
                'customer_name' => 'Farhana Akter',
                'platform_user_id' => 'fb_user_339182',
                'message' => 'price koto apu?',
                'intent' => 'price_inquiry',
                'sentiment' => 'positive',
                'reply_status' => 'replied',
                'reply_text' => 'আপু, Ruby Twinkle dressটির দাম ১২৫০ টাকা। অর্ডার করতে চাইলে আমাদের ইনবক্স করতে পারেন। ঢাকার ভেতরে ডেলিভারি চার্জ ৭০ টাকা।',
                'is_page_owned' => false,
            ]
        );

        SocialComment::firstOrCreate(
            ['social_post_id' => $post1->id, 'platform_comment_id' => 'cmt_9982_size'],
            [
                'customer_name' => 'Sumaiya Rahman',
                'platform_user_id' => 'fb_user_448291',
                'message' => 'M size available ache ki? delivery koto din lagbe?',
                'intent' => 'size_inquiry',
                'sentiment' => 'positive',
                'reply_status' => 'replied',
                'reply_text' => 'জি আপু, Ruby Twinkle dress-এর M সাইজ এভেইলেবল আছে। ঢাকার ভেতরে ২-৩ দিনের মধ্যে ডেলিভারি পাবেন। অর্ডার কনফার্ম করতে ইনবক্স করুন।',
                'is_page_owned' => false,
            ]
        );

        // 6. Customers & Omnichannel Conversations
        $customer1 = Customer::firstOrCreate(
            ['name' => 'Ayesha Siddiqua'],
            [
                'email' => 'ayesha@example.com',
                'phone' => '+8801723456789',
                'avatar_url' => 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
                'notes' => 'Interested in Ruby Twinkle M size. Delivery to Dhanmondi.',
            ]
        );

        CustomerChannelIdentity::firstOrCreate(
            ['social_account_id' => $fbPage->id, 'platform' => 'facebook_page', 'platform_customer_id' => 'psid_88291029381'],
            ['customer_id' => $customer1->id, 'profile_name' => 'Ayesha Siddiqua']
        );

        $conv1 = Conversation::firstOrCreate(
            ['social_account_id' => $fbPage->id, 'customer_id' => $customer1->id],
            [
                'platform' => 'facebook_page',
                'channel_conversation_id' => 't_88291029381',
                'status' => 'active',
                'ai_mode' => 'auto',
                'is_human_takeover' => false,
                'assigned_to_user_id' => $moderator->id,
                'last_message_at' => now()->subMinutes(12),
                'unread_count' => 0,
                'priority' => 'urgent',
            ]
        );

        ConversationTag::firstOrCreate(['conversation_id' => $conv1->id, 'tag' => 'Ruby Twinkle']);
        ConversationTag::firstOrCreate(['conversation_id' => $conv1->id, 'tag' => 'Hot Lead']);

        Message::firstOrCreate(
            ['conversation_id' => $conv1->id, 'platform_message_id' => 'm_001_in'],
            [
                'sender_type' => 'customer',
                'text' => 'Hello! Ami Ruby Twinkle dress ta nite chai. Cash on delivery hobe?',
                'delivery_status' => 'delivered',
                'created_at' => now()->subMinutes(20),
            ]
        );

        Message::firstOrCreate(
            ['conversation_id' => $conv1->id, 'platform_message_id' => 'm_002_ai'],
            [
                'sender_type' => 'ai',
                'text' => 'হ্যালো আপু! জি, সারাদেশে ক্যাশ অন ডেলিভারি সুবিধা রয়েছে। Ruby Twinkle dress-টির দাম ১২৫০ টাকা এবং ঢাকার ভেতরে ডেলিভারি চার্জ ৭০ টাকা। অর্ডারটি কনফার্ম করতে আপনার কাঙ্ক্ষিত সাইজ (M/L/XL), ডেলিভারি ঠিকানা এবং ফোন নম্বরটি পাঠিয়ে দিন।',
                'delivery_status' => 'sent',
                'created_at' => now()->subMinutes(18),
            ]
        );

        Message::firstOrCreate(
            ['conversation_id' => $conv1->id, 'platform_message_id' => 'm_003_in'],
            [
                'sender_type' => 'customer',
                'text' => 'M size nibo. Address: House 24, Road 7, Dhanmondi, Dhaka. Phone: 01723456789',
                'delivery_status' => 'delivered',
                'created_at' => now()->subMinutes(12),
            ]
        );

        // Lead for Customer 1: HOT LEAD
        $lead1 = Lead::firstOrCreate(
            ['customer_id' => $customer1->id],
            [
                'conversation_id' => $conv1->id,
                'assigned_to_user_id' => $moderator->id,
                'status' => 'hot',
                'suggested_status' => 'hot',
                'confidence' => 0.95,
                'related_product_id' => $product1->id,
                'last_status_change_at' => now()->subMinutes(10),
                'notes' => 'Customer provided delivery address and phone number. Ready for order confirmation.',
            ]
        );

        LeadStatusHistory::firstOrCreate(
            ['lead_id' => $lead1->id, 'new_status' => 'hot'],
            [
                'previous_status' => 'warm',
                'changed_by_user_id' => $moderator->id,
                'source' => 'manual',
                'reason' => 'Customer shared complete shipping address and confirmed size.',
            ]
        );

        // Followup for Lead 1
        LeadFollowup::firstOrCreate(
            ['lead_id' => $lead1->id, 'user_id' => $moderator->id],
            [
                'conversation_id' => $conv1->id,
                'followup_date' => now()->toDateString(),
                'followup_time' => '14:30:00',
                'notes' => 'Call customer to confirm order dispatch and finalize invoice.',
                'priority' => 'high',
                'status' => 'due_today',
            ]
        );

        // Customer 2: Instagram Customer (Warm Lead)
        $customer2 = Customer::firstOrCreate(
            ['name' => 'Nabila Tanjim'],
            [
                'avatar_url' => 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
                'notes' => 'Asking about Pippie dress material and wash instructions.',
            ]
        );

        CustomerChannelIdentity::firstOrCreate(
            ['social_account_id' => $igAccount->id, 'platform' => 'instagram_business', 'platform_customer_id' => 'igsid_992019283'],
            ['customer_id' => $customer2->id, 'profile_name' => 'nabila_t']
        );

        $conv2 = Conversation::firstOrCreate(
            ['social_account_id' => $igAccount->id, 'customer_id' => $customer2->id],
            [
                'platform' => 'instagram_business',
                'channel_conversation_id' => 't_ig_992019283',
                'status' => 'pending',
                'ai_mode' => 'suggestion_only',
                'is_human_takeover' => false,
                'assigned_to_user_id' => $moderator->id,
                'last_message_at' => now()->subHours(2),
                'unread_count' => 1,
                'priority' => 'normal',
            ]
        );

        Message::firstOrCreate(
            ['conversation_id' => $conv2->id, 'platform_message_id' => 'm_ig_001'],
            [
                'sender_type' => 'customer',
                'text' => 'Hi, is Pippie maxi gown cotton or georgette? Can I wash in machine?',
                'delivery_status' => 'delivered',
                'created_at' => now()->subHours(2),
            ]
        );

        Lead::firstOrCreate(
            ['customer_id' => $customer2->id],
            [
                'conversation_id' => $conv2->id,
                'assigned_to_user_id' => $moderator->id,
                'status' => 'warm',
                'suggested_status' => 'warm',
                'confidence' => 0.88,
                'related_product_id' => $product2->id,
                'last_status_change_at' => now()->subHours(2),
                'notes' => 'Product inquiry on fabric specs.',
            ]
        );

        // Customer 3: WhatsApp Customer (Converted Order)
        $customer3 = Customer::firstOrCreate(
            ['name' => 'Mahmudul Hasan'],
            [
                'phone' => '+8801712987654',
                'avatar_url' => 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
                'notes' => 'Repeat buyer. Ordered kids romper.',
            ]
        );

        CustomerChannelIdentity::firstOrCreate(
            ['social_account_id' => $waAccount->id, 'platform' => 'whatsapp_cloud', 'platform_customer_id' => '8801712987654'],
            ['customer_id' => $customer3->id, 'profile_name' => 'Mahmudul Hasan']
        );

        $conv3 = Conversation::firstOrCreate(
            ['social_account_id' => $waAccount->id, 'customer_id' => $customer3->id],
            [
                'platform' => 'whatsapp_cloud',
                'channel_conversation_id' => 't_wa_8801712987654',
                'status' => 'resolved',
                'ai_mode' => 'auto',
                'is_human_takeover' => false,
                'assigned_to_user_id' => $moderator->id,
                'last_message_at' => now()->subDay(),
                'unread_count' => 0,
                'priority' => 'normal',
            ]
        );

        $lead3 = Lead::firstOrCreate(
            ['customer_id' => $customer3->id],
            [
                'conversation_id' => $conv3->id,
                'assigned_to_user_id' => $moderator->id,
                'status' => 'converted',
                'suggested_status' => 'converted',
                'confidence' => 1.0,
                'related_product_id' => $product3->id,
                'last_status_change_at' => now()->subDay(),
                'notes' => 'Order verified and confirmed via WhatsApp.',
            ]
        );

        // Order for Customer 3
        Order::firstOrCreate(
            ['order_number' => 'NEX-ORD-2026-0001'],
            [
                'customer_id' => $customer3->id,
                'conversation_id' => $conv3->id,
                'user_id' => $moderator->id,
                'product_id' => $product3->id,
                'quantity' => 2,
                'unit_price' => 650.00,
                'delivery_charge' => 70.00,
                'total_amount' => 1370.00,
                'order_status' => 'confirmed',
                'payment_status' => 'unpaid',
                'order_source' => 'manual_inbox',
                'customer_address' => 'Mirpur DOHS, Road 4, House 12, Dhaka',
                'customer_phone' => '+8801712987654',
                'notes' => 'Gift wrap requested.',
            ]
        );
    }
}
