const express = require("express");
const router = express.Router();

module.exports = (db, cacheUtils) => {
    const { getFromCache, setToCache, updateSaveData } = cacheUtils;
    const admin = require("firebase-admin"); // Firestore FieldValue用

    // 4. セーブ
    router.post("/save_game.php", async (req, res) => {
        try {
            const userEmail = req.cookies.user_email;
            if (!userEmail) return res.status(401).json({ status: "error", message: "Not logged in" });

            const { save_data } = req.body;
            await db.collection("users").doc(userEmail).update({
                save_data: save_data,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // キャッシュを更新
            if (updateSaveData) {
                updateSaveData(userEmail, save_data);
            }

            res.json({ status: "success" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ status: "error", message: "Server error" });
        }
    });

    // 5. ロード
    router.get("/load_game.php", async (req, res) => {
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

    return router;
};
