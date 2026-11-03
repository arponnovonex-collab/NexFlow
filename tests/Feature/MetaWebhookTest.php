<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Models\SocialComment;
use App\Models\SocialPost;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MetaWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_meta_webhook_challenge_verification(): void
    {
        // Valid token verification
        $challenge = '1158201444';
        $response = $this->get('/api/webhooks/facebook?hub_mode=subscribe&hub_challenge=' . $challenge . '&hub_verify_token=nexflow_secure_webhook_token_2026');

        $response->assertStatus(200)
            ->assertSee($challenge);

        // Invalid token returns 403
        $forbiddenResponse = $this->get('/api/webhooks/facebook?hub_mode=subscribe&hub_challenge=' . $challenge . '&hub_verify_token=wrong_token');
        $forbiddenResponse->assertStatus(403);
    }

    public function test_incoming_facebook_comment_webhook_triggers_ai_reply(): void
    {
        $account = SocialAccount::where('platform', 'facebook_page')->first();
        $post = SocialPost::where('social_account_id', $account->id)->first();

        $payload = [
            'object' => 'page',
            'entry' => [
                [
                    'id' => $account->account_id,
                    'time' => time(),
                    'changes' => [
                        [
                            'field' => 'feed',
                            'value' => [
                                'item' => 'comment',
                                'verb' => 'add',
                                'comment_id' => 'cmt_real_test_' . uniqid(),
                                'post_id' => $post->platform_post_id,
                                'message' => 'ei dress er price koto apu?',
                                'from' => [
                                    'id' => 'user_12345678',
                                    'name' => 'Tanjila Ahmed',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $response = $this->postJson('/api/webhooks/facebook', $payload);
        $response->assertStatus(200)
            ->assertSee('EVENT_RECEIVED');

        // Check comment was recorded
        $this->assertDatabaseHas('social_comments', [
            'customer_name' => 'Tanjila Ahmed',
            'reply_status' => 'replied',
        ]);

        $comment = SocialComment::where('customer_name', 'Tanjila Ahmed')->first();
        $this->assertNotNull($comment->reply_text);
        $this->assertStringContainsString('1250', $comment->reply_text);
    }
}

