<?php
require 'config.php';
header('Content-Type: application/json');

if (isset($_SESSION['user_id'])) {
    echo json_encode([
        'status' => 'logged_in', 
        'email' => $_SESSION['email'],
        'name' => $_SESSION['name'] ?? 'Guest'
    ]);
} else {
    echo json_encode(['status' => 'not_logged_in']);
}
?>
