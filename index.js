const express = require("express");
const path = require("path");
const admin = require("firebase-admin");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const bcrypt = require("bcryptjs");

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

// --- 簡易 In-Memory Cache ---
const userCache = new Map();
const CACHE_TTL = 60 * 1000; // 60秒

function getFromCache(email) {
    const cached = userCache.get(email);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setToCache(email, data) {
    userCache.set(email, {
        data: data,
        timestamp: Date.now()
    });
}

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

// 1. セッションチェック
app.get("/api/check_session.php", async (req, res) => {
    try {
        const userEmail = req.cookies.user_email;
        if (userEmail) {
            // キャッシュチェック
            const cached = getFromCache(userEmail);
            if (cached) {
                console.log(`[Cache Hit] check_session for ${userEmail}`);
                return res.json({
                    status: "logged_in",
                    email: userEmail,
                    name: cached.name || "Hero",
                    save_data: cached.save_data || "{}"
                });
            }

            const doc = await db.collection("users").doc(userEmail).get();
            if (doc.exists) {
                const userData = doc.data();
                // キャッシュに保存
                setToCache(userEmail, userData);

                res.json({
                    status: "logged_in",
                    email: userEmail,
                    name: userData.name || "Hero",
                    save_data: userData.save_data || "{}" // Include save_data to save one Read operation on load
                });
            } else {
                // クッキーはあるがユーザーがデータベースにいない場合
                console.log(
                    `Cookie exists for ${userEmail} but user not found in Firestore. Clearing cookie.`
                );
                res.clearCookie("user_email", { path: "/" });
                res.json({ status: "not_logged_in" });
            }
        } else {
            res.json({ status: "not_logged_in" });
        }
    } catch (error) {
        console.error("Session check error:", error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
});

// 2. ログイン
app.post("/api/login.php", async (req, res) => {
    try {
        let { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ status: "error", message: "Missing fields" });

        email = email.trim();

        const userRef = db.collection("users").doc(email);
        const doc = await userRef.get();

        if (!doc.exists || !bcrypt.compareSync(password, doc.data().password)) {
            return res.status(401).json({ status: "error", message: "Invalid email or password" });
        }

        // Cookieにメールアドレスを保存（簡易セッション）
        res.cookie("user_email", email, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: "Lax",
            path: "/"
        });

        const userData = doc.data();
        // キャッシュに保存
        setToCache(email, userData);

        res.json({ status: "success", email, name: userData.name });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error: " + error.message });
    }
});

// 3. 新規登録
app.post("/api/register.php", async (req, res) => {
    try {
        let { email, password, name } = req.body;
        if (!email || !password)
            return res.status(400).json({ status: "error", message: "Missing fields" });

        email = email.trim();
        name = name ? name.trim() : "Hero";

        const userRef = db.collection("users").doc(email);
        const doc = await userRef.get();

        if (doc.exists) {
            return res.status(400).json({ status: "error", message: "Email already exists" });
        }

        await userRef.set({
            name: name,
            password: bcrypt.hashSync(password, 10),
            save_data: "{}",
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ status: "success" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error: " + error.message });
    }
});

// 4. セーブ
app.post("/api/save_game.php", async (req, res) => {
    try {
        const userEmail = req.cookies.user_email;
        if (!userEmail) return res.status(401).json({ status: "error", message: "Not logged in" });

        const { save_data } = req.body;
        await db.collection("users").doc(userEmail).update({
            save_data: save_data,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // キャッシュを更新（または無効化して次回の読込を強制する）
        const cached = userCache.get(userEmail);
        if (cached) {
            cached.data.save_data = save_data;
            cached.timestamp = Date.now();
        }

        res.json({ status: "success" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
});

// 5. ロード
app.get("/api/load_game.php", async (req, res) => {
    try {
        const userEmail = req.cookies.user_email;
        if (!userEmail) return res.status(401).json({ status: "error", message: "Not logged in" });

        // キャッシュチェック
        const cached = getFromCache(userEmail);
        if (cached) {
            console.log(`[Cache Hit] load_game for ${userEmail}`);
            return res.json({ status: "success", save_data: cached.save_data });
        }

        const doc = await db.collection("users").doc(userEmail).get();
        if (!doc.exists)
            return res.status(404).json({ status: "error", message: "User not found" });

        const userData = doc.data();
        setToCache(userEmail, userData);

        res.json({ status: "success", save_data: userData.save_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
});

// 画面配信 (SPA対応: 見つからないパスは index.html を返す)
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
