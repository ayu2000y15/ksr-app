<?php

namespace App\Http\Controllers;

use App\Models\TaskCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TaskCategoryPageController extends Controller
{
    public function index()
    {
        // reuse task-related permission if available; fallback to system admin check on server side
        $categories = TaskCategory::orderBy('order_column')->get();
        return Inertia::render('tasks/categories/index', ['categories' => $categories]);
    }

    public function create()
    {
        return Inertia::render('tasks/categories/create');
    }

    public function edit(TaskCategory $category)
    {
        return Inertia::render('tasks/categories/edit', ['category' => $category]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'order_column' => 'required|integer',
            'color' => ['nullable', 'regex:/^#([0-9A-Fa-f]{6})$/'],
        ]);
        TaskCategory::create($data);
        return redirect()->route('tasks.categories.index');
    }

    public function update(Request $request, TaskCategory $category)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'order_column' => 'required|integer',
            'color' => ['nullable', 'regex:/^#([0-9A-Fa-f]{6})$/'],
        ]);
        $category->update($data);
        return redirect()->route('tasks.categories.index');
    }

    public function destroy(Request $request, TaskCategory $category)
    {
        try {
            // check if any tasks reference this category
            $referenced = \App\Models\Task::where('task_category_id', $category->id)->exists();
            if ($referenced) {
                $msg = 'このカテゴリは既に使用されているため削除できません';
                if ($request->wantsJson() || $request->ajax()) {
                    return response()->json(['error' => $msg], 409);
                }
                return redirect()->route('tasks.categories.index')->with('error', $msg);
            }

            $category->delete();
            $msg = 'カテゴリを削除しました';
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['success' => $msg]);
            }
            return redirect()->route('tasks.categories.index')->with('success', $msg);
        } catch (\Illuminate\Database\QueryException $e) {
            // foreign key constraint or other DB error
            $msg = 'カテゴリの削除に失敗しました（参照中のレコードが存在する可能性があります）';
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['error' => $msg], 500);
            }
            return redirect()->route('tasks.categories.index')->with('error', $msg);
        } catch (\Exception $e) {
            $msg = 'カテゴリの削除中にエラーが発生しました';
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['error' => $msg], 500);
            }
            return redirect()->route('tasks.categories.index')->with('error', $msg);
        }
    }

    // reorder via POST { order: [id,...] }
    public function reorder(Request $request)
    {
        $data = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer|distinct|exists:task_categories,id',
        ]);
        $order = $data['order'];
        try {
            foreach ($order as $index => $id) {
                TaskCategory::where('id', $id)->update(['order_column' => $index]);
            }
            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'error' => 'reorder_failed'], 500);
        }
    }
}
