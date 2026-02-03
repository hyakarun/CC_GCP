<?php
// === DB接続設定 ===
// 環境判定ロジック
$server_name = $_SERVER['SERVER_NAME'];
$request_uri = $_SERVER['REQUEST_URI'];

$is_local = (strpos($server_name, 'localhost') !== false || $server_name === '127.0.0.1');
$is_staging = (strpos($request_uri, '/dev/') !== false);
$is_production = !$is_local && !$is_staging && (strpos($server_name, 'spin.moo.jp') !== false);

// 使用するテーブル名の定義
$table_users = ($is_staging) ? 'dev_users' : 'users';

// === 環境に応じた詳細設定 ===
if ($is_production) {
    // 本番: エラー詳細を隠す
    ini_set('display_errors', 0);
    error_reporting(0);
} else {
    // 開発/ローカル: エラー詳細を表示
    ini_set('display_errors', 1);
    error_reporting(E_ALL);
}

// セッションの分離 (Cookieのパスを制限)
$session_path = ($is_staging) ? '/dev/' : '/';
session_set_cookie_params([
    'path' => $session_path,
    'httponly' => true,
    'samesite' => 'Lax'
]);

try {
    $pdo = null;
    
    // セッション開始
    if (session_status() == PHP_SESSION_NONE) {
        session_start();
    }

    if ($is_production || $is_staging) {
        // --- 本番環境: MySQL (Lolipop) ---
        // secrets.php から読み込み (Git除外ファイル)
        $secrets_path = __DIR__ . '/secrets.php';
        if (!file_exists($secrets_path)) {
            // 開発環境(/dev/api/)の場合、一つ上の階層のapiフォルダを探す
            $alt_path = dirname(__DIR__, 2) . '/api/secrets.php';
            if (file_exists($alt_path)) {
                $secrets_path = $alt_path;
            }
        }

        if (file_exists($secrets_path)) {
            require $secrets_path;
            $host = $secret_db_host;
            $dbname = $secret_db_name;
            $user = $secret_db_user;
            $pass = $secret_db_pass;
        } else {
            // 万が一ファイルがない場合のエラーハンドリング
            throw new Exception("Secrets file not found. Checked: " . __DIR__ . "/secrets.php and nearby.");
        }

        $dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass);

        // MySQL作成用SQL (存在しない場合のみ作成)
        $sql = "CREATE TABLE IF NOT EXISTS {$table_users} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            save_data LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )";
        $pdo->exec($sql);

        // すでにテーブルがある場合のためにカラム追加（MySQL）
        try {
            $pdo->exec("ALTER TABLE {$table_users} ADD COLUMN save_data LONGTEXT NULL");
        } catch (Exception $e) {
            // すでに存在する場合は無視
        }
        // カラム型変更（TEXT -> LONGTEXT）も念のためトライ
        try {
            $pdo->exec("ALTER TABLE {$table_users} MODIFY COLUMN save_data LONGTEXT NULL");
        } catch (Exception $e) {
            // 無視
        }

    } else {
        // --- ローカル環境: SQLite ---
        $db_path = __DIR__ . '/../../data/cc_local.db';
        $pdo = new PDO("sqlite:$db_path");
        $pdo->exec("PRAGMA foreign_keys = ON;");
        // SQLite用スキーマ確認（カラム追加）
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN save_data TEXT NULL");
        } catch (Exception $e) {
            // すでに存在する場合は無視
        }
    }

    // エラー時例外スロー
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

} catch (Exception $e) {
    header('Content-Type: application/json');
    // セキュリティのため詳細エラーは伏せるのが定石だが、デバッグ中は出す
    echo json_encode([
        'status' => 'error', 
        'message' => 'System Error: ' . $e->getMessage(),
        'debug_env' => ($is_staging ? 'staging' : ($is_local ? 'local' : 'prod'))
    ]);
    exit;
}
?>