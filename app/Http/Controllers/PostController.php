<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\PostItem;
use App\Models\Tag;
use App\Models\Attachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\AttachmentService;
use Inertia\Inertia;

class PostController extends Controller
{
    protected $attachmentService;

    public function __construct(AttachmentService $attachmentService)
    {
        $this->attachmentService = $attachmentService;
    }

    public function index(Request $request)
    {
        $user = $request->user();

    // include views.user so we can determine whether the current user has viewed each post
    $query = Post::with(['user', 'attachments', 'comments', 'reactions', 'tags', 'roles', 'allowedUsers', 'views.user'])
            ->where(function ($q) use ($user) {
                // always show public posts
                $q->where('is_public', true)->where('audience', 'all');

                // restricted audience: include if user is member of any target role or explicitly allowed
                if ($user) {
                    $q->orWhere(function ($q2) use ($user) {
                        $q2->where('audience', 'restricted')
                            ->where(function ($q3) use ($user) {
                                $q3->whereHas('roles', function ($qr) use ($user) {
                                    $qr->whereIn('roles.id', $user->roles->pluck('id')->toArray());
                                })->orWhereHas('allowedUsers', function ($qu) use ($user) {
                                    $qu->where('users.id', $user->id);
                                });
                            });
                    });

                    // also include their own posts (for editing/drafts)
                    $q->orWhere('user_id', $user->id);
                }
            })
            ->orderBy('created_at', 'desc');

        // optional: filter by tag name when provided as query param ?tag=tagname
        $tag = $request->query('tag');
        if (!empty($tag)) {
            $query->whereHas('tags', function ($qt) use ($tag) {
                $qt->where('name', $tag);
            });
        }

        // optional: filter by audience when provided as query param ?audience=all|restricted
        $audienceParam = $request->query('audience');
        if (!empty($audienceParam)) {
            $query->where('audience', $audienceParam);
        }

        // optional: filter by role when provided as query param ?role=rolename or ?role=id
        $role = $request->query('role');
        if (!empty($role)) {
            $query->whereHas('roles', function ($qr) use ($role) {
                if (is_numeric($role)) {
                    $qr->where('roles.id', intval($role));
                } else {
                    $qr->where('roles.name', $role);
                }
            });
        }

        $posts = $query->paginate(15);

        // Attach a simple boolean flag to each post indicating whether the current user has a view record.
        $posts->getCollection()->transform(function ($post) use ($user) {
            try {
                $post->viewed_by_current_user = false;
                if ($user && isset($post->views) && is_iterable($post->views)) {
                    // PostView has user_id; views may be collection of PostView models
                    $post->viewed_by_current_user = collect($post->views)->contains(function ($v) use ($user) {
                        // support both relation with user object or user_id on the view model
                        $uid = $v->user_id ?? ($v->user->id ?? null);
                        return $uid && intval($uid) === intval($user->id);
                    });
                }
            } catch (\Throwable $e) {
                // swallow and leave flag false on error
                $post->viewed_by_current_user = false;
            }
            return $post;
        });

        return response()->json($posts);
    }

    public function show(Post $post)
    {
        // include roles and allowedUsers so edit page can pre-populate selections
        $post->load(['user', 'attachments', 'comments', 'reactions', 'tags', 'postItems.attachments', 'roles', 'allowedUsers']);
        return response()->json($post);
    }

    // Render the Inertia show page with the post passed as a prop.
    public function showPage(Post $post)
    {
        $post->load(['user', 'attachments', 'comments', 'reactions', 'tags', 'postItems.attachments', 'roles', 'allowedUsers']);
        return Inertia::render('posts/show', [
            'post' => $post,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', Post::class);
        $data = $request->validate([
            'title' => 'nullable|string|max:255',
            'body' => 'nullable|string',
            'is_public' => 'boolean',
            'audience' => 'nullable|string', // 'all' or 'restricted'
            'roles' => 'array',
            'roles.*' => 'integer',
            'users' => 'array',
            'users.*' => 'integer',
            'tags' => 'array',
            'tags.*' => 'string',
            'items' => 'array',
            'items.*.content' => 'nullable|string',
        ]);

        $user = $request->user();

        // If both roles and users are empty or not provided, treat as public ('all')
        if (empty($data['roles']) && empty($data['users'])) {
            $data['audience'] = 'all';
        }

        DB::beginTransaction();
        try {
            $post = Post::create([
                'user_id' => $user->id,
                'title' => $data['title'] ?? null,
                'body' => $data['body'] ?? null,
                'is_public' => $data['is_public'] ?? true,
                'audience' => $data['audience'] ?? 'all',
                'type' => 'board',
            ]);

            // tags
            if (!empty($data['tags'])) {
                $tagIds = [];
                foreach ($data['tags'] as $tagName) {
                    $tag = Tag::firstOrCreate(['name' => $tagName]);
                    $tagIds[] = $tag->id;
                }
                $post->tags()->sync($tagIds);
            }

            // items (manual blocks)
            if (!empty($data['items'])) {
                foreach ($data['items'] as $index => $item) {
                    $pi = PostItem::create([
                        'post_id' => $post->id,
                        'order' => $index,
                        'content' => $item['content'] ?? null,
                    ]);
                }
            }

            // attachments
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $path = $this->attachmentService->store($file);
                    $post->attachments()->create([
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                }
            }

            DB::commit();
            // If audience is restricted, sync provided arrays; otherwise clear any existing relations
            if ($post->audience === 'restricted') {
                $post->roles()->sync($data['roles'] ?? []);
                $post->allowedUsers()->sync($data['users'] ?? []);
            } else {
                // audience === 'all' (public) -> ensure no roles/users remain
                $post->roles()->sync([]);
                $post->allowedUsers()->sync([]);
            }
            return response()->json($post, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create post', 'error' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, Post $post)
    {
        $this->authorize('update', $post);

        $data = $request->validate([
            'title' => 'nullable|string|max:255',
            'body' => 'nullable|string',
            'is_public' => 'boolean',
            'audience' => 'nullable|string',
            'roles' => 'array',
            'roles.*' => 'integer',
            'users' => 'array',
            'users.*' => 'integer',
            'tags' => 'array',
            'tags.*' => 'string',
            'items' => 'array',
        ]);

        DB::beginTransaction();
        try {
            $post->update([
                'title' => $data['title'] ?? $post->title,
                'body' => $data['body'] ?? $post->body,
                'is_public' => $data['is_public'] ?? $post->is_public,
                // if both roles and users are empty, force audience to all
                'audience' => (!empty($data['roles']) || !empty($data['users'])) ? ($data['audience'] ?? $post->audience) : 'all',
            ]);

            if (isset($data['tags'])) {
                $tagIds = [];
                foreach ($data['tags'] as $tagName) {
                    $tag = Tag::firstOrCreate(['name' => $tagName]);
                    $tagIds[] = $tag->id;
                }
                $post->tags()->sync($tagIds);
            }

            if (isset($data['items'])) {
                // replace items for simplicity
                $post->postItems()->delete();
                foreach ($data['items'] as $index => $item) {
                    PostItem::create([
                        'post_id' => $post->id,
                        'order' => $index,
                        'content' => $item['content'] ?? null,
                    ]);
                }
            }

            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $path = $this->attachmentService->store($file);
                    $post->attachments()->create([
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                }
            }

            DB::commit();
            // ensure removed selections are reflected: if audience is restricted, sync to provided arrays or empty
            if ($post->audience === 'restricted') {
                $post->roles()->sync($data['roles'] ?? []);
                $post->allowedUsers()->sync($data['users'] ?? []);
            } else {
                // public -> clear any roles/users
                $post->roles()->sync([]);
                $post->allowedUsers()->sync([]);
            }
            return response()->json($post);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update post', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy(Post $post)
    {
        $this->authorize('delete', $post);
        $post->delete();
        return response()->json(['message' => 'deleted']);
    }
}
