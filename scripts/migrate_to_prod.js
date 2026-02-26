const admin = require("firebase-admin");
const fs = require("fs");

async function migrateData() {
    // 既に初期化されている場合は再利用しない (本番プロジェクト cheychip に接続を確認)
    if (admin.apps.length === 0) {
        admin.initializeApp({
            projectId: 'cheychip'
        });
    }

    const db = admin.firestore();
    const tsvData = fs.readFileSync('lolipop_dump.tsv', 'utf-8');
    const lines = tsvData.split('\n');

    console.log(`Starting migration for ${lines.length - 1} users...`);

    let count = 0;
    // 最初の行はヘッダー（name, email, password, save_data）
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [name, email, password, saveData] = line.split('\t');
        if (!email) continue;

        // save_data が "NULL" 文字列の場合は空にする
        const finalSaveData = (saveData === 'NULL' || !saveData) ? "{}" : saveData;

        // Firestoreに保存
        await db.collection('users').doc(email).set({
            name: name || 'Hero',
            password: password,
            save_data: finalSaveData,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            migrated_from: 'lolipop_mysql'
        }, { merge: true });

        count++;
        if (count % 10 === 0) {
            console.log(`Migrated ${count} users...`);
        }
    }

    console.log(`Successfully migrated ${count} users to Firestore production!`);
}

migrateData().catch(console.error);
