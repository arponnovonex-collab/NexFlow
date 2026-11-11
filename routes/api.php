<?php

use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AppearanceController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CallCenterController;
use App\Http\Controllers\Api\CommentAutomationController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EpbxWebhookController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\MediaFolderController;
use App\Http\Controllers\Api\MetaWebhookController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SavedMessageController;
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
Route::get('/appearance', [AppearanceController::class, 'get']);

// Meta Webhook Challenge & Event Ingestion
Route::get('/webhooks/facebook', [MetaWebhookController::class, 'verify']);
Route::post('/webhooks/facebook', [MetaWebhookController::class, 'handleFacebook']);
Route::get('/webhooks/instagram', [MetaWebhookController::class, 'verify']);
Route::post('/webhooks/instagram', [MetaWebhookController::class, 'handleFacebook']);
Route::get('/webhooks/whatsapp', [MetaWebhookController::class, 'verify']);
Route::post('/webhooks/whatsapp', [MetaWebhookController::class, 'handleFacebook']);
Route::post('/webhooks/epbx', [EpbxWebhookController::class, 'handle']);

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
    Route::post('/conversations/{conversation}/sync', [ConversationController::class, 'sync']);
    Route::apiResource('conversations', ConversationController::class)->only(['index', 'show']);
    Route::get('/conversations/{conversation}/latest-messages', [ConversationController::class, 'latestMessages']);
    Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'sendMessage']);
    Route::post('/conversations/{conversation}/suggest-reply', [ConversationController::class, 'suggestReply']);
    Route::post('/conversations/{conversation}/takeover', [ConversationController::class, 'toggleTakeover']);
    Route::put('/conversations/{conversation}/status', [ConversationController::class, 'updateStatus']);
    Route::post('/conversations/{conversation}/assign', [ConversationController::class, 'assign']);

    // Shortcuts & Saved SMS / Quick Replies
    Route::get('/saved-messages', [SavedMessageController::class, 'index']);
    Route::post('/saved-messages', [SavedMessageController::class, 'store']);
    Route::get('/saved-messages/{savedMessage}', [SavedMessageController::class, 'show']);
    Route::put('/saved-messages/{savedMessage}', [SavedMessageController::class, 'update']);
    Route::delete('/saved-messages/{savedMessage}', [SavedMessageController::class, 'destroy']);
    Route::post('/saved-messages/{savedMessage}/use', [SavedMessageController::class, 'incrementUsage']);

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

    // Call Center & ePBX.bd Integration
    Route::get('/call-center/settings', [CallCenterController::class, 'getSettings']);
    Route::post('/call-center/settings', [CallCenterController::class, 'saveSettings']);
    Route::post('/call-center/test-connection', [CallCenterController::class, 'testConnection']);
    Route::post('/call-center/originate', [CallCenterController::class, 'originateCall']);
    Route::get('/call-center/logs', [CallCenterController::class, 'getCallLogs']);
    Route::post('/call-center/logs', [CallCenterController::class, 'storeCallLog']);
    Route::post('/call-center/sync-logs', [CallCenterController::class, 'syncLogs']);
    Route::get('/call-center/recordings', [CallCenterController::class, 'getRecordings']);
    Route::get('/call-center/recordings/{uniqueid}', [CallCenterController::class, 'streamRecording']);
    Route::put('/call-center/logs/{callLog}', [CallCenterController::class, 'updateCallLog']);
    Route::get('/call-center/customer-lookup', [CallCenterController::class, 'lookupCustomer']);

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

    // Branding & Appearance Customization
    Route::post('/appearance', [AppearanceController::class, 'update']);

    // WordPress-style Media Library & Product Folders
    Route::get('/media', [MediaController::class, 'index']);
    Route::post('/media/upload', [MediaController::class, 'upload']);
    Route::post('/media/move-folder', [MediaController::class, 'moveToFolder']);
    Route::post('/media/bulk-delete', [MediaController::class, 'bulkDestroy']);
    Route::delete('/media/{media}', [MediaController::class, 'destroy']);
    Route::get('/media/folders', [MediaFolderController::class, 'index']);
    Route::post('/media/folders', [MediaFolderController::class, 'store']);
    Route::put('/media/folders/{folder}', [MediaFolderController::class, 'update']);
    Route::delete('/media/folders/{folder}', [MediaFolderController::class, 'destroy']);
});
