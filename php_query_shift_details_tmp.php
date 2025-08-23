<?php
$pdo = new PDO('sqlite:' . __DIR__ . '/database/database.sqlite');
$q = "SELECT id, date, start_time, end_time, user_id, notes FROM shift_details WHERE start_time LIKE '2025-08-08%' OR date = '2025-08-08' ORDER BY id";
$stmt = $pdo->query($q);
$rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
