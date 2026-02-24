const admin = require("firebase-admin");

async function restoreLv99() {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8081";

    if (admin.apps.length === 0) {
        admin.initializeApp({
            projectId: "cheychip"
        });
    }

    const db = admin.firestore();
    const email = "hikahikarun6206@gmail.com";
    const userRef = db.collection("users").doc(email);

    console.log(`--- Restoring Lv 99 Save Data for ${email} on Emulator ---`);

    // Lv 99 の状態を再現した save_data オブジェクト
    // 前回のログから推測される値をベースに構築
    const restoredSaveData = {
        "x": 25,
        "lane": 1,
        "lv": 99,
        "hp": 5000,
        "maxHp": 5000,
        "exp": 0,
        "nextExp": 1000000,
        "sp": 500,
        "skill_sp": 100,
        "money": 5400504,
        "stats": { "str": 100, "vit": 100, "agi": 100, "int": 100, "dex": 100, "luk": 100 },
        "skills": {},
        "skill_cooldowns": {},
        "battleStats": { "atk": 500, "matk": 500, "def_div": 50, "def_sub": 500, "mdef_div": 50, "mdef_sub": 500, "hit": 200, "eva": 200, "cri": 100, "res": 100 },
        "attackTimer": 0,
        "baseAttackInterval": 60,
        "range": 75,
        "width": 30,
        "height": 30,
        "lastLogin": Date.now(),
        "currentDungeonId": 1,
        "currentWave": 1,
        "killsInWave": 0,
        "dungeonProgress": { "1": { "clearCount": 100, "killCount": 0, "cleared": true } },
        "image": "player/player1.png",
        "equipment": { "head_top": null, "head_mid": null, "head_low": null, "neck": null, "ear": null, "body": null, "arm": null, "waist": null, "leg": null, "foot": null, "hand_r": null, "hand_l": null, "sub1": null, "sub2": null },
        "inventory": [],
        "currentJob": "adventurer",
        "jobData": { "adventurer": { "lv": 99, "exp": 0, "nextExp": 1000000 } },
        "equippedSkills": [null, null, null]
    };

    try {
        await userRef.update({
            save_data: JSON.stringify(restoredSaveData),
            Lv: 99,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            restore_note: "Manually restored to Lv 99 after test overwrite"
        });
        console.log("Successfully restored Lv 99 data to emulator!");
    } catch (e) {
        console.error("Failed to restore data:", e);
    }
}

restoreLv99().catch(console.error);
