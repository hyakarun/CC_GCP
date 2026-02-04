<?php
require 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'ログインが必要です']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$saveData = $data['save_data'] ?? '';

if (!$saveData) {
    echo json_encode(['status' => 'error', 'message' => 'データがありません']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE {$table_users} SET save_data = :save_data WHERE id = :id");
    $stmt->execute([
        ':save_data' => $saveData,
        ':id' => $_SESSION['user_id']
    ]);
    echo json_encode(['status' => 'success', 'message' => 'セーブ完了']);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'サーバーエラー: ' . $e->getMessage()]);
}
?>
