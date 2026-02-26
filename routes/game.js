const express = require("express");
const router = express.Router();

module.exports = (db, cacheUtils) => {
    const { getFromCache, setToCache, updateSaveData } = cacheUtils;
    const admin = require("firebase-admin"); // Firestore FieldValue用

    // 4. セーブ
    router.post("/save_game.php", async (req, res) => {
        try {
            const userEmail = req.cookies.__session;
            if (!userEmail)
                return res.status(401).json({ status: "error", message: "Not logged in" });

            const { save_data } = req.body;
            const newSaveData = JSON.parse(save_data);
            
            // 現在のデータを取得して検証
            const userRef = db.collection("users").doc(userEmail);
            const doc = await userRef.get();
            
            if (doc.exists) {
                const currentData = doc.data();
                if (currentData.save_data) {
                    const currentSaveData = JSON.parse(currentData.save_data);
                    // 既存レベルが70以上で、新しいレベルが10未満の場合は異常とみなして上書き拒否
                    if (currentSaveData.lv >= 70 && newSaveData.lv < 10) {
                        console.error(`[CRITICAL] Prevented suspicious overwrite for ${userEmail}: Lv ${currentSaveData.lv} -> Lv ${newSaveData.lv}`);
                        return res.status(400).json({ status: "error", message: "Suspicious data detected" });
                    }
                }
            }

            const startTime = Date.now();
            await userRef.update({
                save_data: save_data,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[Timer] save_game for ${userEmail} took ${Date.now() - startTime}ms. Data: Lv ${newSaveData.lv}`);

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
            const userEmail = req.cookies.__session;
            if (!userEmail)
                return res.status(401).json({ status: "error", message: "Not logged in" });

            // キャッシュチェック
            const cached = getFromCache(userEmail);
            if (cached) {
                console.log(`[Cache Hit] load_game for ${userEmail}`);
                return res.json({ status: "success", save_data: cached.save_data });
            }

            const startTime = Date.now();
            const doc = await db.collection("users").doc(userEmail).get();
            console.log(
                `[Timer] load_game DB Fetch for ${userEmail} took ${Date.now() - startTime}ms`
            );

            if (!doc.exists)
                return res.status(404).json({ status: "error", message: "User not found" });

            const userData = doc.data();
            const loadedSD = JSON.parse(userData.save_data || "{}");
            console.log(`[DEBUG] load_game for ${userEmail} returning Lv ${loadedSD.lv}`);
            setToCache(userEmail, userData);

            res.json({ status: "success", save_data: userData.save_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ status: "error", message: "Server error" });
        }
    });

    return router;
};
