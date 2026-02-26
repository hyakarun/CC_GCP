const admin = require("firebase-admin");
const fs = require("fs");

async function aggressiveMigrate() {
    if (admin.apps.length === 0) {
        admin.initializeApp({ projectId: 'cheychip' });
    }
    const db = admin.firestore();
    const tsvData = fs.readFileSync('lolipop_dump.tsv', 'utf-8');
    const lines = tsvData.split('\n');

    console.log(`Starting Aggressive Migration for ${lines.length - 1} users...`);

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [name, email, password, saveData] = line.split('\t');
        if (!email) continue;

        const finalSaveData = (saveData === 'NULL' || !saveData) ? "{}" : saveData;

        // ドキュメントを完全に削除してから再作成
        const userRef = db.collection('users').doc(email);
        await userRef.delete();
        
        await userRef.set({
            name: name || 'Hero',
            password: password,
            save_data: finalSaveData,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            migrated_from: 'lolipop_mysql_aggressive'
        });

        if (i % 5 === 0) console.log(`Migrated ${i} users...`);
    }

    console.log("Aggressive migration finished.");
}

aggressiveMigrate().catch(console.error);
