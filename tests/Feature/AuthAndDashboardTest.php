<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthAndDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@nexflow.ai',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'token',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'role',
                ],
            ]);

        $this->assertDatabaseHas('login_histories', [
            'status' => 'success',
        ]);
    }

    public function test_user_cannot_login_with_invalid_password(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@nexflow.ai',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_authenticated_user_can_access_me_and_dashboard_metrics(): void
    {
        $user = User::where('email', 'admin@nexflow.ai')->first();

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/auth/me');
        $response->assertStatus(200)
            ->assertJsonPath('user.email', 'admin@nexflow.ai');

        $metricsResponse = $this->actingAs($user, 'sanctum')->getJson('/api/dashboard/metrics');
        $metricsResponse->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'data' => [
                    'metrics' => [
                        'connected_accounts',
                        'facebook_pages',
                        'instagram_accounts',
                        'whatsapp_numbers',
                        'cold_leads',
                        'warm_leads',
                        'hot_leads',
                        'converted_leads',
                    ],
                    'lead_funnel',
                    'platform_breakdown',
                ],
            ]);
    }

    public function test_admin_can_list_and_create_users(): void
    {
        $admin = User::where('email', 'admin@nexflow.ai')->first();

        $listResponse = $this->actingAs($admin, 'sanctum')->getJson('/api/users');
        $listResponse->assertStatus(200);

        $createResponse = $this->actingAs($admin, 'sanctum')->postJson('/api/users', [
            'name' => 'New Moderator Test',
            'email' => 'newmod@nexflow.ai',
            'password' => 'password123',
            'role' => 'moderator',
            'status' => 'active',
            'phone' => '+8801999999999',
        ]);

        $createResponse->assertStatus(201)
            ->assertJsonPath('user.email', 'newmod@nexflow.ai');

        $this->assertDatabaseHas('users', [
            'email' => 'newmod@nexflow.ai',
            'role' => 'moderator',
        ]);
    }
}

