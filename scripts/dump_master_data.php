<?php
require 'secrets.php';
$dsn = "mysql:host=$secret_db_host;dbname=$secret_db_name;charset=utf8mb4";
$pdo = new PDO($dsn, $secret_db_user, $secret_db_pass);

$tables = ['exp_table', 'dungeons', 'enemies', 'items', 'skills', 'options', 'config', 'stories'];
$data = [];

foreach ($tables as $table) {
    try {
        $stmt = $pdo->query("SELECT * FROM $table");
        if ($stmt) {
            $data[$table] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $data[$table] = [];
        }
    } catch (Exception $e) {
        $data[$table] = [];
    }
}

echo json_encode($data, JSON_UNESCAPED_UNICODE);
?>
