<?php
// quick script to dump shift_details for two dates for diagnosis
$path = __DIR__ . '/database/database.sqlite';
if (!file_exists($path)) {
    echo json_encode(['error' => "database file not found: $path"]);
    exit(1);
}
$pdo = new PDO('sqlite:' . $path);
$dates = ['2025-08-08', '2025-08-09'];
$out = [];
foreach ($dates as $d) {
    $startOfDay = $d . ' 00:00:00';
    $endOfDay = $d . ' 23:59:59';
    $stmt = $pdo->prepare("SELECT id, user_id, date, start_time, end_time, type, status FROM shift_details WHERE date = :d OR (start_time <= :end AND end_time >= :start)");
    $stmt->execute([':d' => $d, ':end' => $endOfDay, ':start' => $startOfDay]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $out[$d] = $rows;
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
