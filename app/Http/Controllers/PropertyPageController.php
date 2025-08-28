<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\Holiday;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PropertyPageController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Property::class);

        // load properties with their room occupancies and optionally related users
        $properties = Property::with(['roomOccupancies' => function ($q) {
            // eager-load only relevant related users (checkout/final move-out); single-user relation removed
            $q->with(['checkoutUser', 'finalMoveOutUser'])->orderBy('move_in_date');
        }])->orderBy('order_column')->orderBy('name')->get();

        // map properties to arrays and add server-controlled display_label used by the frontend
        // Pre-collect all user_ids referenced by occupancies so we can resolve names in one query
        $allUserIds = [];
        foreach ($properties as $p) {
            foreach ($p->roomOccupancies as $occ) {
                if (!empty($occ->user_ids) && is_array($occ->user_ids)) {
                    foreach ($occ->user_ids as $uid) {
                        $allUserIds[] = $uid;
                    }
                }
            }
        }
        $allUserIds = array_values(array_unique($allUserIds));
        $userNamesById = [];
        if (count($allUserIds) > 0) {
            // pluck name by id: [id => name]
            $userNamesById = \App\Models\User::whereIn('id', $allUserIds)->pluck('id', 'name')->toArray();
        }

        $items = $properties->map(function ($it) use ($userNamesById) {
            $arr = $it->toArray();
            $arr['postcode'] = $it->postal_code ?? null;
            $arr['termination_date'] = $it->cancellation_date ?? null;

            // build display label as: 物件名(部屋番号) [間取り]
            $label = $it->name ?? '';
            $room = trim((string)($it->room_details ?? ''));
            $layout = trim((string)($it->layout ?? ''));
            if ($room !== '') {
                $label .= "({$room})";
            }
            if ($layout !== '') {
                $label .= " [{$layout}]";
            }
            $arr['display_label'] = $label;

            // ensure each room occupancy includes move_out_confirm fields expected by the frontend
            if (isset($arr['room_occupancies']) && is_array($arr['room_occupancies'])) {
                $arr['room_occupancies'] = array_map(function ($occ) use ($userNamesById) {
                    // prefer an already-present move_out_confirm_* value if any; otherwise derive from checkout_*
                    if (empty($occ['move_out_confirm_user_name'])) {
                        $confirmer = null;
                        if (!empty($occ['checkout_user_id']) && !empty($occ['checkout_user'])) {
                            $confirmer = $occ['checkout_user']['name'] ?? null;
                        }
                        $occ['move_out_confirm_user_name'] = $confirmer;
                    }
                    if (empty($occ['move_out_confirm_user_id'])) {
                        $occ['move_out_confirm_user_id'] = $occ['checkout_user_id'] ?? null;
                    }
                    if (empty($occ['move_out_confirm_date'])) {
                        $occ['move_out_confirm_date'] = $occ['checkout_date'] ?? null;
                    }

                    // if user_ids JSON column exists, attach user names array for frontend convenience
                    if (!empty($occ['user_ids']) && is_array($occ['user_ids'])) {
                        $occ['user_names'] = array_values(array_filter(array_map(function ($uid) use ($userNamesById) {
                            if (isset($userNamesById[$uid])) {
                                return $userNamesById[$uid];
                            }
                            return "user:{$uid}";
                        }, $occ['user_ids'])));
                    }

                    return $occ;
                }, $arr['room_occupancies']);
            }

            return $arr;
        });

        // send holidays (dates) as Y-m-d strings so frontend can mark them reliably
        $holidays = Holiday::pluck('date')
            ->map(function ($d) {
                return \Carbon\Carbon::parse($d)->toDateString();
            })
            ->toArray();

        // send minimal users list (id, name, gender, has_car) so frontend can render icons on initial SSR
        $users = \App\Models\User::where('status', 'active')->orderBy('id')->get(['id', 'name', 'gender', 'has_car']);
        if ($users->count() === 0) {
            $users = \App\Models\User::orderBy('id')->get(['id', 'name', 'gender', 'has_car']);
        }

        return Inertia::render('properties/index', [
            'properties' => $items,
            'holidays' => $holidays,
            'users' => $users,
        ]);
    }
}
