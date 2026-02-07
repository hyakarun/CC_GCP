const express = require("express");
require("dotenv").config();
const path = require("path");
const admin = require("firebase-admin");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");

// Route handlers
const authRoutes = require("./routes/auth");
const gameRoutes = require("./routes/game");
// Cache Utils
const cacheUtils = require("./utils/cache");

// Firebase Admin SDK 初期化
// 省略... (既存の初期化コード)
try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
} catch (e) {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
}
const db = admin.firestore();

const app = express();

// --- ミドルウェア設定 ---
app.use(compression()); // レスポンスを圧縮して転送量を削減
app.use(express.static(path.join(__dirname, "public")));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// 簡単なログ出力
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// --- API エンドポイント ---
// 依存関係を注入してルーターを取得
app.use("/api", authRoutes(db, cacheUtils));
app.use("/api", gameRoutes(db, cacheUtils));

// 画面配信 (SPA対応: 見つからないパスは index.html を返す)
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
