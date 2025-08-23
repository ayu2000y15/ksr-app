<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ShiftDetail;

$rows = ShiftDetail::where('start_time', 'like', '2025-08-08%')
    ->orWhere('date', '2025-08-08')
    ->orderBy('id')
    ->get()
    ->toArray();

echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
