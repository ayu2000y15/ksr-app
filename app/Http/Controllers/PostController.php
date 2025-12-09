<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\PostItem;
use App\Models\Tag;
use App\Models\Attachment;
use App\Models\Poll;
use App\Models\Announcement;
use App\Models\PollVote;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\AttachmentService;
use Inertia\Inertia;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Gate;

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

        // views.user を読み込んで、現在のユーザーが各投稿を閲覧したかどうかを判定できるようにする
        // Eager-load poll.options so that index responses include basic poll info
        $query = Post::with(['user', 'attachments', 'comments', 'reactions', 'tags', 'roles', 'allowedUsers', 'views.user', 'pinnedByUsers', 'poll.options']);

        // システム管理者は全ての投稿を閲覧可能
        if (!$user || !$user->hasRole('システム管理者')) {
            $query->where(function ($q) use ($user) {
                // 常に公開投稿を表示する
                $q->where('is_public', true)->where('audience', 'all');

                // 限定公開の場合: ユーザーが対象ロールのメンバーであるか、明示的に許可されている場合に含める
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

                    // ユーザー自身の投稿も含める（編集や下書き用）
                    $q->orWhere('user_id', $user->id);
                }
            });
        }
        // サーバー側ソート: ?sort=column&direction=asc|desc を受け付ける
        // allow sorting by id as well (frontend may request ?sort=id)
        $sortable = ['id', 'title', 'audience', 'type', 'updated_at', 'user', 'sort_order'];
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
            } elseif ($sort === 'sort_order') {
                // sort_orderでソート（nullは最後に）
                $query->orderByRaw('CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END')
                    ->orderBy('sort_order', $direction)
                    ->orderBy('created_at', 'desc');
            } else {
                // title, audience, type
                $query->orderBy($sort, $direction);
            }
        } else {
            // default ordering when no explicit sort requested: sort_order優先、次にcreated_at
            $query->orderByRaw('CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END')
                ->orderBy('sort_order', 'asc')
                ->orderBy('created_at', 'desc');
        }

        // 任意: クエリパラメータ ?tag=tagname が提供された場合、タグ名でフィルタする
        $tag = $request->query('tag');
        if (!empty($tag)) {
            $query->whereHas('tags', function ($qt) use ($tag) {
                $qt->where('name', $tag);
            });
        }

        // 任意: クエリパラメータ ?audience=all|restricted が提供された場合、audience でフィルタする
        $audienceParam = $request->query('audience');
        if (!empty($audienceParam)) {
            $query->where('audience', $audienceParam);
        }

        // 任意: クエリパラメータ ?type=board|manual が提供された場合、type でフィルタする
        $typeParam = $request->query('type');
        if (!empty($typeParam) && in_array($typeParam, ['board', 'manual', 'poll'])) {
            $query->where('type', $typeParam);
        }

        // 任意: クエリパラメータ ?role=rolename または ?role=id が提供された場合、role でフィルタする
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

        // 各投稿に対して、現在のユーザーが閲覧記録を持っているかを示す単純な真偽値フラグを付与する
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
                // エラー時は無視してフラグは false のままにする
                $post->viewed_by_current_user = false;
            }
            // pinned by current user flag
            try {
                $post->pinned_by_current_user = false;
                if ($user && isset($post->pinnedByUsers) && is_iterable($post->pinnedByUsers)) {
                    $post->pinned_by_current_user = collect($post->pinnedByUsers)->contains(function ($v) use ($user) {
                        $uid = $v->id ?? ($v->user_id ?? null);
                        return $uid && intval($uid) === intval($user->id);
                    });
                }
            } catch (\Throwable $e) {
                $post->pinned_by_current_user = false;
            }

            // If this post has a poll, attach a lightweight summary for the frontend
            // so it can render expiry and whether the current user has voted.
            try {
                if (isset($post->poll) && $post->poll) {
                    $poll = $post->poll;
                    $post->poll_summary = [
                        'id' => $poll->id,
                        'expires_at' => $poll->expires_at ? $poll->expires_at->toDateTimeString() : null,
                        'is_anonymous' => (bool) ($poll->is_anonymous ?? false),
                        'allow_multiple_votes' => (bool) ($poll->allow_multiple_votes ?? false),
                        'has_voted' => false,
                    ];

                    if ($user) {
                        $post->poll_summary['has_voted'] = PollVote::where('poll_id', $poll->id)
                            ->where('user_id', $user->id)
                            ->exists();
                    }

                    // include options with votes_count only (do not include voter identities here)
                    $post->poll_summary['options'] = collect($poll->options)->map(function ($opt) {
                        return [
                            'id' => $opt->id,
                            'title' => $opt->value ?? ($opt->title ?? ''),
                            'votes_count' => $opt->votes()->count(),
                        ];
                    })->all();
                }
            } catch (\Throwable $e) {
                // ignore poll summary failures to avoid breaking the whole listing
            }
            return $post;
        });

        return response()->json($posts);
    }

    public function show(Post $post)
    {
        // 関連データをロード
        $post->load(['user', 'attachments', 'comments', 'reactions', 'tags', 'postItems.attachments', 'roles', 'allowedUsers']);

        // 投票の場合、さらに投票データをロード
        if ($post->type === 'poll') {
            $post->load('poll.options.votes.user');

            if ($post->poll) {
                // 匿名投票かつ閲覧権限がない場合、投票者情報を隠す
                if ($post->poll->is_anonymous && Gate::denies('viewAnonymousVotes', $post->poll)) {
                    $post->poll->options->each(function ($option) {
                        $option->unsetRelation('votes'); // votesリレーションごと削除するのがシンプル
                        // もし得票数だけ残したい場合は、以下のように加工する
                        // $option->votes_count = $option->votes->count();
                        // $option->unsetRelation('votes');
                    });
                }
            }
        }

        return response()->json($post);
    }

    // Render the Inertia show page with the post passed as a prop.
    public function showPage(Post $post)
    {
        // 上記 show メソッドと同様のロジックを適用
        $post->load(['user', 'attachments', 'comments', 'reactions', 'tags', 'postItems.attachments', 'roles', 'allowedUsers']);

        if ($post->type === 'poll') {
            $post->load('poll.options.votes.user');

            if ($post->poll) {
                if ($post->poll->is_anonymous && Gate::denies('viewAnonymousVotes', $post->poll)) {
                    $post->poll->options->each(function ($option) {
                        $option->votes_count = $option->votes->count(); // Inertia側で扱いやすいように得票数を追加
                        $option->unsetRelation('votes');
                    });
                }
            }
        }

        return Inertia::render('posts/show', [
            'post' => $post,
        ]);
    }

    // Render the Inertia edit page with the post and related data (ensure postItems are loaded)
    public function editPage(Post $post)
    {
        // ensure poll and its options are loaded so edit page can display existing poll data
        $post->load(['user', 'attachments', 'postItems.attachments', 'tags', 'roles', 'allowedUsers', 'poll.options']);
        return Inertia::render('posts/edit', [
            'post' => $post,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', Post::class);
        $data = $request->validate([
            'type' => 'nullable|string|in:board,manual,poll',
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

            // 投票用のバリデーション
            'poll' => 'required_if:type,poll|array',
            'poll.description' => 'nullable|string',
            'poll.expires_at' => 'nullable|date',
            'poll.option_type' => 'required_if:type,poll|string|in:text,date',
            'poll.allow_multiple_votes' => 'required_if:type,poll|boolean',
            'poll.is_anonymous' => 'required_if:type,poll|boolean',
            'poll.options' => 'required_if:type,poll|array|min:2',
            'poll.options.*.value' => 'required|string',
            // attachments: allow images, docs, spreadsheets and common video formats up to 10MB each
            'attachments' => 'array',
            'attachments.*' => 'file|mimes:png,jpg,jpeg,gif,pdf,txt,xlsx,mp4,mov,webm,mkv,avi|max:10240',
            // per-item attachments (item_attachments[index] => array of files)
            'item_attachments' => 'array',
            'item_attachments.*' => 'array',
            'item_attachments.*.*' => 'file|mimes:png,jpg,jpeg,gif,pdf,txt,xlsx,mp4,mov,webm,mkv,avi|max:10240',
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
            $post = Post::create([
                'user_id' => $user->id,
                'title' => $data['title'] ?? null,
                'body' => ($data['type'] === 'manual' || $data['type'] === 'poll') ? '' : ($data['body'] ?? null),
                'is_public' => $data['is_public'] ?? true,
                'audience' => $data['audience'] ?? 'all',
                'type' => $data['type'] ?? 'board',
                'sort_order' => 0,
            ]);

            if ($post->type === 'poll') {
                $pollData = $data['poll'];
                $poll = $post->poll()->create([
                    // use nested description or fallback to poll_description top-level field
                    'description' => $pollData['description'] ?? $request->input('poll_description') ?? null,
                    'expires_at' => $pollData['expires_at'] ?? null,
                    'option_type' => $pollData['option_type'],
                    'allow_multiple_votes' => $pollData['allow_multiple_votes'],
                    'is_anonymous' => $pollData['is_anonymous'],
                ]);

                foreach ($pollData['options'] as $index => $optionData) {
                    $poll->options()->create([
                        'value' => $optionData['value'],
                        'order' => $index,
                    ]);
                }
            }

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
            // allow 'poll' here as well so updating poll posts (or sending type=poll) doesn't fail
            'type' => 'nullable|string|in:board,manual,poll',
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

            // --- 投票用のバリデーション ---
            'poll' => [Rule::requiredIf($post->type === 'poll' || $request->input('type') === 'poll'), 'array'],
            'poll.description' => 'nullable|string',
            'poll.expires_at' => 'nullable|date|after:now',
            'poll.option_type' => 'required_if:type,poll|string|in:text,date',
            'poll.allow_multiple_votes' => 'required_if:type,poll|boolean',
            'poll.is_anonymous' => 'required_if:type,poll|boolean',
            'poll.options' => 'required_if:type,poll|array|min:2',
            'poll.options.*.id' => 'nullable|integer',
            'poll.options.*.value' => 'required|string|max:255',
            // attachments allowed on update as well
            'attachments' => 'array',
            'attachments.*' => 'file|mimes:png,jpg,jpeg,gif,pdf,txt,xlsx,mp4,mov,webm,mkv,avi|max:10240',
            'item_attachments' => 'array',
            'item_attachments.*' => 'array',
            'item_attachments.*.*' => 'file|mimes:png,jpg,jpeg,gif,pdf,txt,xlsx,mp4,mov,webm,mkv,avi|max:10240',
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
                'body' => ($post->type === 'manual' || $post->type === 'poll') ? '' : ($data['body'] ?? $post->body),
                'is_public' => $data['is_public'] ?? $post->is_public,
                'audience' => (!empty($data['roles']) || !empty($data['users'])) ? ($data['audience'] ?? $post->audience) : 'all',
            ]);

            // --- 投票の更新処理 ---
            if ($post->type === 'poll' && isset($data['poll'])) {
                $pollData = $data['poll'];

                $poll = $post->poll()->updateOrCreate([], [ // post_idで検索し、なければ作成
                    'description' => $pollData['description'] ?? $request->input('poll_description') ?? null,
                    'expires_at' => $pollData['expires_at'] ?? null,
                    'option_type' => $pollData['option_type'],
                    'allow_multiple_votes' => $pollData['allow_multiple_votes'],
                    'is_anonymous' => $pollData['is_anonymous'],
                ]);

                $incomingOptionIds = [];
                foreach ($pollData['options'] as $index => $optionData) {
                    $optionId = $optionData['id'] ?? null;

                    $option = $poll->options()->updateOrCreate(
                        ['id' => $optionId], // IDで検索
                        [
                            'value' => $optionData['value'], // 値と順序を更新または設定
                            'order' => $index,
                        ]
                    );
                    $incomingOptionIds[] = $option->id;
                }

                // フロントから送られてこなかった選択肢を削除
                $poll->options()->whereNotIn('id', $incomingOptionIds)->delete();
            }

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

    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|exists:posts,id',
            'items.*.sort_order' => 'required|integer',
        ]);

        try {
            DB::beginTransaction();

            foreach ($validated['items'] as $item) {
                Post::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
            }

            DB::commit();
            return response()->json(['message' => '並び順を更新しました']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => '並び順の更新に失敗しました', 'error' => $e->getMessage()], 500);
        }
    }
}
