<?php
require 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'ログインが必要です']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT save_data FROM {$table_users} WHERE id = :id");
    $stmt->execute([':id' => $_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'save_data' => $user['save_data'] ?? null
    ]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'サーバーエラー: ' . $e->getMessage()]);
}
?>
