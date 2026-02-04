/**
 * CheychipR クライアント設定
 * 接続先のバックエンドURLをここで管理します。
 */
const CONFIG = {
    // APIのベースURL（末尾にスラッシュは不要）
    // Lolipop版（PHP）を使用する場合: "api"
    // 同一サーバー内で配信する場合（一体化構成）: ""
    API_BASE_URL: "",

    // 開発モード判定
    IS_DEV: window.location.href.includes('/dev/') || window.location.hostname === 'localhost'
};
