const admin = require("firebase-admin");
const fs = require("fs");

async function importToEmulator() {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8081";

    if (admin.apps.length === 0) {
        admin.initializeApp({
            projectId: "cheychip"
        });
    }

    const db = admin.firestore();
    const backupFile = "backup_prod_data_before_migration.json";

    if (!fs.existsSync(backupFile)) {
        console.error(`Backup file ${backupFile} not found.`);
        return;
    }

    const rawData = fs.readFileSync(backupFile, "utf8");
    const users = JSON.parse(rawData);

    console.log("--- Importing Data to Firestore Emulator (Serial Mode) ---");
    
    let count = 0;
    for (const email in users) {
        try {
            await db.collection("users").doc(email).set(users[email]);
            console.log(`Imported: ${email}`);
            count++;
        } catch (e) {
            console.error(`Failed to import ${email}:`, e);
        }
    }

    console.log(`Successfully finished importing ${count} users.`);
}

importToEmulator().catch(console.error);
