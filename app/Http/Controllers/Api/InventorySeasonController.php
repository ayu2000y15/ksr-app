<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Season;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventorySeasonController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', \App\Models\InventoryItem::class);

        $seasons = Season::orderBy('name', 'desc')->get();
        return response()->json($seasons);
    }

    public function store(Request $request)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $validated = $request->validate([
            'name'      => ['required', 'string', 'max:20', 'unique:seasons,name', 'regex:/^\d{4}-\d{2}$/'],
            'is_active' => ['boolean'],
            'note'      => ['nullable', 'string', 'max:255'],
        ], [
            'name.required' => '�V�[�Y�����͕K�{�ł�',
            'name.unique'   => '���̃V�[�Y�����͊��ɓo�^����Ă��܂�',
            'name.regex'    => '�V�[�Y������ YYYY-YY �`���œ��͂��Ă��������i��: 2025-26�j',
        ]);

        DB::beginTransaction();
        try {
            if (!empty($validated['is_active'])) {
                Season::where('is_active', true)->update(['is_active' => false]);
            }

            $season = Season::create($validated);
            DB::commit();
            return response()->json($season, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => '�쐬�Ɏ��s���܂���', 'error' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, Season $season)
    {
        $this->authorize('update', \App\Models\InventoryItem::class);

        $validated = $request->validate([
            'name'      => ['sometimes', 'string', 'max:20', 'unique:seasons,name,' . $season->id, 'regex:/^\d{4}-\d{2}$/'],
            'is_active' => ['boolean'],
            'note'      => ['nullable', 'string', 'max:255'],
        ], [
            'name.unique' => '���̃V�[�Y�����͊��ɓo�^����Ă��܂�',
            'name.regex'  => '�V�[�Y������ YYYY-YY �`���œ��͂��Ă��������i��: 2025-26�j',
        ]);

        DB::beginTransaction();
        try {
            if (isset($validated['is_active']) && $validated['is_active']) {
                Season::where('id', '!=', $season->id)
                    ->where('is_active', true)
                    ->update(['is_active' => false]);
            }

            $season->update($validated);
            DB::commit();
            return response()->json($season->fresh());
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => '�X�V�Ɏ��s���܂���', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy(Season $season)
    {
        $this->authorize('delete', \App\Models\InventoryItem::class);

        $stockCount = $season->inventoryStocks()->count();
        if ($stockCount > 0) {
            return response()->json([
                'message' => "���̃V�[�Y���ɂ͍݌Ƀf�[�^�i{$stockCount}���j���o�^����Ă��܂��B�폜�ł��܂���B",
            ], 422);
        }

        $season->delete();
        return response()->json(['message' => 'deleted']);
    }

    public function setActive(int $id)
    {
        $this->authorize('update', \App\Models\InventoryItem::class);

        $season = Season::findOrFail($id);

        DB::transaction(function () use ($season) {
            Season::where('is_active', true)->update(['is_active' => false]);
            $season->update(['is_active' => true]);
        });

        return response()->json($season->fresh());
    }
}
