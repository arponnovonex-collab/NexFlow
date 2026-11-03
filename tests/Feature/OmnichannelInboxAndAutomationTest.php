<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Product;
use App\Models\SocialAccount;
use App\Models\SocialComment;
use App\Models\SocialPost;
use App\Models\User;
use App\Services\OpenAIService;
use App\Services\ProductKnowledgeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OmnichannelInboxAndAutomationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_can_list_and_create_products_with_variants(): void
    {
        $admin = User::where('email', 'admin@nexflow.ai')->first();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/products');
        $response->assertStatus(200)
            ->assertJsonStructure(['status', 'data' => ['data']]);

        $createResponse = $this->actingAs($admin, 'sanctum')->postJson('/api/products', [
            'name' => 'Sapphire Velvet Abaya',
            'sku' => 'NF-ABY-777',
            'selling_price' => 2200.00,
            'regular_price' => 2500.00,
            'availability' => 'in_stock',
            'delivery_charge_inside_dhaka' => 70,
            'delivery_charge_outside_dhaka' => 130,
            'variants' => [
                ['size' => '52', 'stock' => 5],
                ['size' => '54', 'stock' => 10],
            ],
        ]);

        $createResponse->assertStatus(201)
            ->assertJsonPath('product.sku', 'NF-ABY-777');

        $this->assertDatabaseHas('product_variants', [
            'size' => '54',
            'stock' => 10,
        ]);
    }

    public function test_product_knowledge_service_extracts_verified_context(): void
    {
        $service = app(ProductKnowledgeService::class);
        $post = SocialPost::where('platform_post_id', 'post_1001_ruby_launch')->first();

        $context = $service->getVerifiedContextForPost($post);
        $this->assertTrue($context['has_product']);
        $this->assertEquals('Ruby Twinkle Embroidered Dress', $context['products'][0]['name']);
        $this->assertEquals(1250.00, $context['products'][0]['selling_price_bdt']);
        $this->assertEquals(70.00, $context['products'][0]['delivery_inside_dhaka_bdt']);
    }

    public function test_openai_service_generates_accurate_bangla_price_reply(): void
    {
        $knowledgeService = app(ProductKnowledgeService::class);
        $aiService = app(OpenAIService::class);

        $post = SocialPost::where('platform_post_id', 'post_1001_ruby_launch')->first();
        $context = $knowledgeService->getVerifiedContextForPost($post);

        // Test Customer: "price koto apu?"
        $decision = $aiService->generateStructuredReply('price koto apu?', $context, 'friendly', 'comment_reply');

        $this->assertEquals('price_inquiry', $decision['intent']);
        $this->assertStringContainsString('1250', $decision['reply_text']);
        $this->assertEquals('warm', $decision['suggested_lead_status']);
    }

    public function test_comment_auto_reply_workflow(): void
    {
        $admin = User::where('email', 'admin@nexflow.ai')->first();
        $comment = SocialComment::where('platform_comment_id', 'cmt_9981_price')->first();

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/comments/{$comment->id}/reply");
        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('comment_replies', [
            'social_comment_id' => $comment->id,
            'sender_type' => 'ai',
        ]);
    }

    public function test_unified_inbox_messaging_and_human_takeover(): void
    {
        $moderator = User::where('email', 'moderator@nexflow.ai')->first();
        $conversation = Conversation::first();

        // Send Moderator Reply
        $sendResponse = $this->actingAs($moderator, 'sanctum')->postJson("/api/conversations/{$conversation->id}/messages", [
            'text' => 'Hello Ayesha, I am preparing your package right now!',
            'is_internal_note' => false,
        ]);

        $sendResponse->assertStatus(200)
            ->assertJsonPath('data.sender_type', 'moderator');

        $conversation->refresh();
        $this->assertTrue($conversation->is_human_takeover);

        // Request AI Suggest Reply in composer
        $suggestResponse = $this->actingAs($moderator, 'sanctum')->postJson("/api/conversations/{$conversation->id}/suggest-reply");
        $suggestResponse->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'data' => [
                    'suggested_reply',
                    'intent',
                    'suggested_lead_status',
                ],
            ]);
    }

    public function test_lead_status_transition_and_order_conversion(): void
    {
        $moderator = User::where('email', 'moderator@nexflow.ai')->first();
        $lead = Lead::where('status', 'hot')->first();
        $customer = $lead->customer;

        // Transition Lead to Warm manually
        $transitionResponse = $this->actingAs($moderator, 'sanctum')->putJson("/api/leads/{$lead->id}/status", [
            'status' => 'warm',
            'reason' => 'Customer postponed decision to next month',
        ]);

        $transitionResponse->assertStatus(200);
        $this->assertDatabaseHas('lead_status_histories', [
            'lead_id' => $lead->id,
            'previous_status' => 'hot',
            'new_status' => 'warm',
        ]);

        // Create Verified Order for Customer
        $product = Product::first();
        $orderResponse = $this->actingAs($moderator, 'sanctum')->postJson('/api/orders', [
            'customer_id' => $customer->id,
            'conversation_id' => $lead->conversation_id,
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_price' => 1250,
            'delivery_charge' => 70,
            'customer_address' => 'House 10, Road 4, Banani, Dhaka',
            'customer_phone' => '01711223344',
            'notes' => 'Urgent delivery requested',
        ]);

        $orderResponse->assertStatus(201);

        // Check that lead was converted
        $lead->refresh();
        $this->assertEquals('converted', $lead->status);
    }
}

