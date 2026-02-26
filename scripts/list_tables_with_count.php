<?php
require 'secrets.php';
$dsn = "mysql:host=$secret_db_host;dbname=$secret_db_name;charset=utf8mb4";
$pdo = new PDO($dsn, $secret_db_user, $secret_db_pass);
$stmt = $pdo->query("SHOW TABLES");
$tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
foreach ($tables as $table) {
    $c = $pdo->query("SELECT COUNT(*) FROM $table")->fetchColumn();
    echo "$table: $c\n";
}
?>
