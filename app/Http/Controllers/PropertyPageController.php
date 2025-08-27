<?php

namespace App\Http\Controllers;

use App\Models\Property;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PropertyPageController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Property::class);

        // load properties with their room occupancies and optionally related users
        $properties = Property::with(['roomOccupancies' => function ($q) {
            $q->with('user')->orderBy('move_in_date');
        }])->orderBy('order_column')->orderBy('name')->get();

        return Inertia::render('properties/index', [
            'properties' => $properties,
        ]);
    }
}
