const admin = require("firebase-admin");

async function checkUsers() {
    // 既存の接続がある場合は再利用
    if (admin.apps.length === 0) {
        // GOOGLE_APPLICATION_CREDENTIALS が設定されていない場合、gcloud auth application-default login が必要
        admin.initializeApp({
            projectId: "cheychip"
        });
    }

    const db = admin.firestore();
    const emails = ["hikahikarun@gmail.com", "hikahikarun6206@gmail.com"];

    console.log("--- Checking Firestore Project: cheychip ---");
    for (const email of emails) {
        const doc = await db.collection("users").doc(email).get();
        if (doc.exists) {
            const data = doc.data();
            console.log(`[EXIST] ${email}: Name=${data.name || data.Name}, Lv=${data.Lv || "?"}`);
        } else {
            console.log(`[NOT FOUND] ${email}`);
        }
    }
}

checkUsers().catch(console.error);
