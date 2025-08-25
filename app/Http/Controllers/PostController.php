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
            });
        // server-side sorting: accept ?sort=column&direction=asc|desc
        $sortable = ['title', 'audience', 'type', 'updated_at', 'user'];
        $sort = $request->query('sort');
        $direction = strtolower($request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        if (!empty($sort) && in_array($sort, $sortable)) {
            if ($sort === 'user') {
                // sort by author's name
                $query->leftJoin('users', 'posts.user_id', '=', 'users.id')
                    ->select('posts.*')
                    ->orderBy('users.name', $direction);
            } elseif ($sort === 'updated_at') {
                $query->orderBy('updated_at', $direction);
            } else {
                // title, audience, type
                $query->orderBy($sort, $direction);
            }
        } else {
            // default ordering when no explicit sort requested
            $query->orderBy('created_at', 'desc');
        }

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

        // optional: filter by type when provided as query param ?type=board|manual
        $typeParam = $request->query('type');
        if (!empty($typeParam) && in_array($typeParam, ['board', 'manual'])) {
            $query->where('type', $typeParam);
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

    // Render the Inertia edit page with the post and related data (ensure postItems are loaded)
    public function editPage(Post $post)
    {
        $post->load(['user', 'attachments', 'postItems.attachments', 'tags', 'roles', 'allowedUsers']);
        return Inertia::render('posts/edit', [
            'post' => $post,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', Post::class);
        $data = $request->validate([
            'type' => 'nullable|string|in:board,manual',
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
            // If client requested deletion of specific attachment ids, remove their files and DB rows
            if ($request->has('deleted_attachment_ids')) {
                $delIds = $request->input('deleted_attachment_ids');
                if (is_array($delIds)) {
                    foreach ($delIds as $aid) {
                        try {
                            $att = Attachment::find(intval($aid));
                            if ($att) {
                                // remove file from storage (public disk)
                                try {
                                    \Illuminate\Support\Facades\Storage::disk('public')->delete($att->file_path);
                                } catch (\Exception $e) {
                                    // ignore storage deletion errors but continue to remove DB record
                                }
                                $att->delete();
                            }
                        } catch (\Exception $e) {
                            // continue on individual failures
                        }
                    }
                }
            }
            // If manual type, ensure body is an empty string to avoid any server-side checks
            $isManual = (isset($data['type']) && $data['type'] === 'manual');
            $post = Post::create([
                'user_id' => $user->id,
                'title' => $data['title'] ?? null,
                'body' => $isManual ? '' : ($data['body'] ?? null),
                'is_public' => $data['is_public'] ?? true,
                'audience' => $data['audience'] ?? 'all',
                'type' => $data['type'] ?? 'board',
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

                    // handle per-item attachments sent as item_attachments[index][]
                    $key = "item_attachments.{$index}";
                    if ($request->hasFile($key)) {
                        $files = $request->file($key);
                        foreach ($files as $f) {
                            $path = $this->attachmentService->store($f);
                            $pi->attachments()->create([
                                'file_path' => $path,
                                'original_name' => $f->getClientOriginalName(),
                            ]);
                        }
                    }
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
            'type' => 'nullable|string|in:board,manual',
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
            // If client requested deletion of specific attachment ids on update, remove their files and DB rows
            if ($request->has('deleted_attachment_ids')) {
                $delIds = $request->input('deleted_attachment_ids');
                logger()->info('post.update received deleted_attachment_ids', ['ids' => $delIds]);
                if (is_array($delIds)) {
                    foreach ($delIds as $aid) {
                        try {
                            $idInt = intval($aid);
                            $att = Attachment::find($idInt);
                            if ($att) {
                                logger()->info('post.update deleting attachment', ['id' => $idInt, 'path' => $att->file_path]);
                                try {
                                    \Illuminate\Support\Facades\Storage::disk('public')->delete($att->file_path);
                                } catch (\Exception $e) {
                                    logger()->warning('post.update storage delete failed', ['id' => $idInt, 'error' => $e->getMessage()]);
                                }
                                $att->delete();
                                logger()->info('post.update attachment deleted', ['id' => $idInt]);
                            } else {
                                logger()->warning('post.update attachment not found', ['id' => $idInt]);
                            }
                        } catch (\Exception $e) {
                            logger()->error('post.update failed deleting attachment', ['id' => $aid, 'error' => $e->getMessage()]);
                        }
                    }
                }
            }
            // DEBUG: log incoming items payload to storage/logs/laravel.log for diagnosis
            if ($request->has('items')) {
                logger()->info('post.update incoming items', ['items' => $request->input('items')]);
            }
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
                // Upsert items: preserve ids where provided, update content/order, create new ones, delete missing
                $incoming = $data['items'];
                $incomingIds = [];
                foreach ($incoming as $index => $item) {
                    // normalize item id
                    $itemId = !empty($item['id']) ? intval($item['id']) : null;
                    if ($itemId) {
                        $pi = PostItem::where('id', $itemId)->where('post_id', $post->id)->first();
                        if ($pi) {
                            $pi->update(['order' => $index, 'content' => $item['content'] ?? null]);
                        } else {
                            // id provided but not found or not belong to this post -> create new
                            $pi = PostItem::create(['post_id' => $post->id, 'order' => $index, 'content' => $item['content'] ?? null]);
                        }
                    } else {
                        $pi = PostItem::create(['post_id' => $post->id, 'order' => $index, 'content' => $item['content'] ?? null]);
                    }
                    $incomingIds[] = $pi->id;

                    // handle per-item attachments sent as item_attachments[index][]
                    $key = "item_attachments.{$index}";
                    if ($request->hasFile($key)) {
                        $files = $request->file($key);
                        foreach ($files as $f) {
                            $path = $this->attachmentService->store($f);
                            $pi->attachments()->create([
                                'file_path' => $path,
                                'original_name' => $f->getClientOriginalName(),
                            ]);
                        }
                    }
                }

                // delete existing items that were removed in the incoming payload
                if (!empty($incomingIds)) {
                    $post->postItems()->whereNotIn('id', $incomingIds)->delete();
                } else {
                    // no incoming items -> remove all
                    $post->postItems()->delete();
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
