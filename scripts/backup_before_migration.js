const admin = require("firebase-admin");
const fs = require("fs");

async function backupAllUsers() {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            projectId: "cheychip"
        });
    }

    const db = admin.firestore();
    const backupFile = "backup_prod_data_before_migration.json";

    console.log("--- Starting Full Backup from Project: cheychip ---");

    try {
        const snapshot = await db.collection("users").get();
        const users = {};

        snapshot.forEach((doc) => {
            users[doc.id] = doc.data();
        });

        fs.writeFileSync(backupFile, JSON.stringify(users, null, 2));
        console.log(`Successfully backed up ${Object.keys(users).length} users to ${backupFile}`);
    } catch (e) {
        console.error("Backup failed:", e);
    }
}

backupAllUsers().catch(console.error);
