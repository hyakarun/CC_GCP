/**
 * CheychipR クライアント設定
 * 接続先のバックエンドURLをここで管理します。
 */
const CONFIG = {
    // APIのベースURL（末尾にスラッシュは不要）
    // Lolipop版（PHP）を使用する場合: "api"
    // GCP版（Node.js/Cloud Run）を使用する場合: "api" or "https://..."
    API_BASE_URL: "/api",

    // 開発モード判定
    IS_DEV: window.location.href.includes("/dev/") || window.location.hostname === "localhost"
};
