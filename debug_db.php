<?php
require 'config.php';
header('Content-Type: application/json');

try {
    $status = [];

    // Check Columns
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM users");
        $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $status['columns'] = $cols;
    } catch (Exception $e) {
        $status['columns_error'] = $e->getMessage();
    }

    // Check Row Count
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM users");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $status['user_count'] = $row['count'];
    } catch (Exception $e) {
        $status['count_error'] = $e->getMessage();
    }

    echo json_encode($status, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>