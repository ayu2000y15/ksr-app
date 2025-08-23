<?php
// Boot Laravel and query ShiftDetail model for diagnostics
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ShiftDetail;
use Carbon\Carbon;

$dates = ['2025-08-08', '2025-08-09'];
$out = [];
foreach ($dates as $d) {
    $startOfDay = Carbon::parse($d)->startOfDay();
    $endOfDay = Carbon::parse($d)->endOfDay();

    $rows = ShiftDetail::with('user')
        ->where(function ($q) use ($d, $startOfDay, $endOfDay) {
            $q->whereDate('date', $d)
                ->orWhere(function ($qq) use ($startOfDay, $endOfDay) {
                    $qq->where('start_time', '<=', $endOfDay->toDateTimeString())
                        ->where('end_time', '>=', $startOfDay->toDateTimeString());
                });
        })->get();

    $out[$d] = $rows->map(function ($r) {
        return [
            'id' => $r->id,
            'user_id' => $r->user_id,
            'user_name' => $r->user->name ?? null,
            'date' => $r->date,
            'start_time' => $r->start_time,
            'end_time' => $r->end_time,
            'type' => $r->type,
            'status' => $r->status,
        ];
    })->toArray();
}

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
