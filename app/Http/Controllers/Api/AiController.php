<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiSetting;
use App\Models\AiUsageLog;
use App\Models\AutomationRule;
use App\Models\Product;
use App\Models\SocialAccount;
use App\Services\OpenAIService;
use App\Services\ProductKnowledgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiController extends Controller
{
    public function __construct(
        protected ProductKnowledgeService $knowledgeService,
        protected OpenAIService $aiService
    ) {}

    /**
     * Get all AI settings.
     */
    public function settings(): JsonResponse
    {
        $settings = AiSetting::pluck('value', 'key')->toArray();

        return response()->json([
            'status' => 'success',
            'data' => $settings,
        ]);
    }

    /**
     * Update AI settings.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'openai_model' => 'nullable|string',
            'openai_api_key' => 'nullable|string',
            'global_ai_instructions' => 'nullable|string',
            'comment_ai_instructions' => 'nullable|string',
            'default_tone' => 'nullable|string',
            'comment_auto_reply_enabled' => 'nullable|string',
            'messenger_auto_reply_enabled' => 'nullable|string',
            'instagram_auto_reply_enabled' => 'nullable|string',
            'whatsapp_auto_reply_enabled' => 'nullable|string',
            'daily_token_limit' => 'nullable|numeric',
        ]);

        foreach ($validated as $key => $val) {
            if ($val !== null) {
                AiSetting::updateOrCreate(['key' => $key], ['value' => (string) $val]);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'AI settings updated successfully',
            'data' => AiSetting::pluck('value', 'key'),
        ]);
    }

    /**
     * AI Playground test generator.
     */
    public function playground(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_message' => 'required|string',
            'product_id' => 'nullable|exists:products,id',
            'tone' => 'nullable|in:friendly,professional,sales_focused',
            'model' => 'nullable|string',
        ]);

        $productContext = ['products' => []];
        if (! empty($validated['product_id'])) {
            $product = Product::find($validated['product_id']);
            $productContext = ['products' => [$this->knowledgeService->getVerifiedContextForProduct($product)]];
        }

        $start = microtime(true);
        $decision = $this->aiService->generateStructuredReply(
            $validated['customer_message'],
            $productContext,
            $validated['tone'] ?? 'friendly',
            'playground'
        );
        $latency = round((microtime(true) - $start) * 1000, 2);

        return response()->json([
            'status' => 'success',
            'data' => [
                'decision' => $decision,
                'latency_ms' => $latency,
                'tokens' => [
                    'prompt' => 140,
                    'completion' => 60,
                    'total' => 200,
                    'estimated_cost' => 0.000035,
                ],
            ],
        ]);
    }

    /**
     * List automation rules.
     */
    public function rules(): JsonResponse
    {
        $rules = AutomationRule::with('socialAccount:id,name,platform')->orderBy('priority', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $rules,
        ]);
    }

    /**
     * Store new automation rule.
     */
    public function storeRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'scope' => 'required|in:global,facebook,instagram,whatsapp,page,post',
            'social_account_id' => 'nullable|exists:social_accounts,id',
            'condition_type' => 'required|string',
            'condition_payload' => 'nullable|array',
            'action_type' => 'required|string',
            'action_payload' => 'nullable|array',
            'priority' => 'nullable|integer',
        ]);

        $rule = AutomationRule::create([
            ...$validated,
            'is_active' => true,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Automation rule created successfully',
            'data' => $rule,
        ], 201);
    }

    /**
     * Toggle automation rule.
     */
    public function toggleRule(Request $request, AutomationRule $rule): JsonResponse
    {
        $rule->update(['is_active' => ! $rule->is_active]);

        return response()->json([
            'status' => 'success',
            'message' => 'Rule status updated',
            'data' => $rule,
        ]);
    }
}

