const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

module.exports = (db, cacheUtils) => {
    const { getFromCache, setToCache } = cacheUtils;

    // 1. セッションチェック
    router.get("/check_session.php", async (req, res) => {
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
    router.post("/login.php", async (req, res) => {
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
            // remember_me が true なら30日、false ならブラウザセッション（maxAge指定なし）
            const rememberMe = req.body.remember_me === true;
            const cookieOptions = {
                httpOnly: true,
                sameSite: "Lax",
                path: "/"
            };

            if (rememberMe) {
                cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
            }

            res.cookie("user_email", email, cookieOptions);

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
    router.post("/register.php", async (req, res) => {
        try { // Using global admin if needed, but here we likely need to pass admin or use db directly logic.
              // Wait, previous code used `admin.firestore.FieldValue.serverTimestamp()`.
              // We need admin instance passed or imported. 
              // Since db is passed, we might not have admin.
              // Let's assume we can get FieldValue from db or pass admin.
              // Actually, best to pass `admin` object too or use `require('firebase-admin')` here if initialized globally?
              // `firebase-admin` initialization is singleton so require('firebase-admin') should work if initialized in index.js.
            const admin = require("firebase-admin");
            
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

    // 6. ログアウト
    router.get("/logout.php", (req, res) => {
        res.clearCookie("user_email", { path: "/" });
        res.json({ status: "success" });
    });

    return router;
};
