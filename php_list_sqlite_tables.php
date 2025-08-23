<?php
$pdo = new PDO('sqlite:' . __DIR__ . '/database/database.sqlite');
$stmt = $pdo->query("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name");
$rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
