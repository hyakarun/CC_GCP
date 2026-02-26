const admin = require("firebase-admin");
const fs = require("fs");

async function migrateToEmulator() {
    // エミュレーターに接続を強制
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8081";

    if (admin.apps.length === 0) {
        admin.initializeApp({
            projectId: 'cheychip'
        });
    }

    const db = admin.firestore();
    const tsvData = fs.readFileSync('lolipop_dump.tsv', 'utf-8');
    const lines = tsvData.split('\n');

    console.log(`--- Syncing Lolipop Data to LOCAL EMULATOR ---`);

    let count = 0;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [name, email, password, saveData] = line.split('\t');
        if (!email) continue;

        const finalSaveData = (saveData === 'NULL' || !saveData) ? "{}" : saveData;

        await db.collection('users').doc(email).set({
            name: name || 'Hero',
            password: password,
            save_data: finalSaveData,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            migrated_from: 'lolipop_mysql_sync'
        }, { merge: true });

        count++;
    }

    console.log(`Successfully synced ${count} users to EMULATOR.`);
    
    // 検証：主要ユーザーのレベルを出力
    console.log("\n--- Verification List (Emulator) ---");
    const testEmails = ['hikahikarun@gmail.com', 'hikahikarun6206@gmail.com', 'hashimototakuma202@gmail.com', 'shirocafe@yahoo.co.jp'];
    for (const email of testEmails) {
        const doc = await db.collection('users').doc(email).get();
        if (doc.exists) {
            const sd = JSON.parse(doc.data().save_data || "{}");
            console.log(`${email.padEnd(35)} | Level: ${sd.lv || '?'}`);
        } else {
            console.log(`${email.padEnd(35)} | NOT FOUND`);
        }
    }
}

migrateToEmulator().catch(console.error);
