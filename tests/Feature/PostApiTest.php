<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Post;

class PostApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_posts()
    {
        $response = $this->getJson('/api/posts');
        $response->assertStatus(401); // API with web+auth returns 401 in test environment
    }

    public function test_authenticated_user_can_create_post()
    {
        $this->withoutMiddleware();
        $user = User::factory()->create();
        $this->actingAs($user);

        $payload = [
            'title' => 'テスト投稿',
            'body' => '本文',
            'is_public' => true,
        ];

        $response = $this->postJson('/api/posts', $payload);
        $response->assertStatus(201);
        $this->assertDatabaseHas('posts', ['title' => 'テスト投稿']);
    }
}
