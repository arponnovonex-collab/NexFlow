<?php

use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CommentAutomationController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\MetaWebhookController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SmsController;
use App\Http\Controllers\Api\SocialAccountController;
use App\Http\Controllers\Api\SteadfastController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/
Route::post('/auth/login', [AuthController::class, 'login']);

// Meta Webhook Challenge & Event Ingestion
Route::get('/webhooks/facebook', [MetaWebhookController::class, 'verify']);
Route::post('/webhooks/facebook', [MetaWebhookController::class, 'handleFacebook']);
Route::get('/webhooks/instagram', [MetaWebhookController::class, 'verify']);
Route::post('/webhooks/instagram', [MetaWebhookController::class, 'handleFacebook']);
Route::get('/webhooks/whatsapp', [MetaWebhookController::class, 'verify']);
Route::post('/webhooks/whatsapp', [MetaWebhookController::class, 'handleFacebook']);

/*
|--------------------------------------------------------------------------
| Authenticated Routes (Sanctum)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {
    // Auth & Profile
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Dashboard
    Route::get('/dashboard/metrics', [DashboardController::class, 'metrics']);

    // Social Accounts & Channels
    Route::post('/social-accounts/verify-all-tokens', [SocialAccountController::class, 'verifyAllTokens']);
    Route::apiResource('social-accounts', SocialAccountController::class);
    Route::get('/social-accounts/{socialAccount}/diagnostics', [SocialAccountController::class, 'diagnostics']);
    Route::post('/social-accounts/{socialAccount}/disconnect', [SocialAccountController::class, 'disconnect']);
    Route::post('/social-accounts/{socialAccount}/reconnect', [SocialAccountController::class, 'reconnect']);
    Route::post('/social-accounts/{socialAccount}/subscribe-webhooks', [SocialAccountController::class, 'subscribeWebhooks']);

    // Product Catalog
    Route::get('/product-categories', [ProductController::class, 'categories']);
    Route::apiResource('products', ProductController::class);

    // Comment Automation
    Route::get('/posts', [CommentAutomationController::class, 'posts']);
    Route::post('/posts/sync', [CommentAutomationController::class, 'syncPosts']);
    Route::put('/posts/{post}', [CommentAutomationController::class, 'updatePost']);
    Route::get('/comments', [CommentAutomationController::class, 'comments']);
    Route::post('/comments/{comment}/reply', [CommentAutomationController::class, 'replyToComment']);
    Route::post('/comments/{comment}/approve', [CommentAutomationController::class, 'approveReply']);
    Route::get('/automation/comment-instructions', [CommentAutomationController::class, 'getCommentInstructions']);
    Route::post('/automation/comment-instructions', [CommentAutomationController::class, 'updateCommentInstructions']);

    // Unified Omnichannel Inbox
    Route::post('/conversations/sync-names', [ConversationController::class, 'syncNames']);
    Route::apiResource('conversations', ConversationController::class)->only(['index', 'show']);
    Route::get('/conversations/{conversation}/latest-messages', [ConversationController::class, 'latestMessages']);
    Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'sendMessage']);
    Route::post('/conversations/{conversation}/suggest-reply', [ConversationController::class, 'suggestReply']);
    Route::post('/conversations/{conversation}/takeover', [ConversationController::class, 'toggleTakeover']);
    Route::put('/conversations/{conversation}/status', [ConversationController::class, 'updateStatus']);
    Route::post('/conversations/{conversation}/assign', [ConversationController::class, 'assign']);

    // Lead CRM & Follow-ups
    Route::get('/leads', [LeadController::class, 'index']);
    Route::put('/leads/{lead}/status', [LeadController::class, 'updateStatus']);
    Route::get('/followups', [LeadController::class, 'followups']);
    Route::post('/followups', [LeadController::class, 'storeFollowup']);
    Route::put('/followups/{followup}', [LeadController::class, 'updateFollowup']);
    Route::get('/customers', [LeadController::class, 'customers']);
    Route::put('/customers/{customer}', [LeadController::class, 'updateCustomer']);

    // Orders & Conversions
    Route::apiResource('orders', OrderController::class)->only(['index', 'store']);
    Route::put('/orders/{order}/status', [OrderController::class, 'updateStatus']);

    // SMS Gateway, Marketing & Auto-SMS
    Route::get('/sms/gateway', [SmsController::class, 'getGatewayConfig']);
    Route::post('/sms/gateway', [SmsController::class, 'saveGatewayConfig']);
    Route::get('/sms/gateway/balance', [SmsController::class, 'checkBalance']);
    Route::post('/sms/gateway/test', [SmsController::class, 'sendTestSms']);
    Route::get('/sms/auto-sms', [SmsController::class, 'getAutoSmsConfig']);
    Route::post('/sms/auto-sms', [SmsController::class, 'saveAutoSmsConfig']);
    Route::get('/sms/marketing/recipients', [SmsController::class, 'getMarketingRecipients']);
    Route::post('/sms/marketing/send', [SmsController::class, 'sendMarketingCampaign']);
    Route::get('/sms/campaigns', [SmsController::class, 'getCampaigns']);
    Route::get('/sms/logs', [SmsController::class, 'getLogs']);

    // Steadfast Courier Integration
    Route::get('/courier/steadfast/settings', [SteadfastController::class, 'getSettings']);
    Route::post('/courier/steadfast/settings', [SteadfastController::class, 'saveSettings']);
    Route::get('/courier/steadfast/balance', [SteadfastController::class, 'checkBalance']);
    Route::post('/courier/steadfast/send-order/{order}', [SteadfastController::class, 'sendOrder']);
    Route::post('/courier/steadfast/send-bulk', [SteadfastController::class, 'sendBulk']);

    // AI Control Center, Rules & Playground
    Route::get('/ai/settings', [AiController::class, 'settings']);
    Route::post('/ai/settings', [AiController::class, 'updateSettings']);
    Route::post('/ai/playground', [AiController::class, 'playground']);
    Route::get('/automation/rules', [AiController::class, 'rules']);
    Route::post('/automation/rules', [AiController::class, 'storeRule']);
    Route::put('/automation/rules/{rule}/toggle', [AiController::class, 'toggleRule']);

    // Team & Moderator Management
    Route::apiResource('users', UserController::class);

    // System Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead']);
    Route::put('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);

    // Analytics & Diagnostics
    Route::get('/analytics/moderators', [AnalyticsController::class, 'moderatorPerformance']);
    Route::get('/analytics/ai-usage', [AnalyticsController::class, 'aiUsage']);
    Route::get('/system/activity-logs', [AnalyticsController::class, 'activityLogs']);
    Route::get('/system/webhooks', [AnalyticsController::class, 'webhookEvents']);
});
