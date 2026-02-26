const admin = require("firebase-admin");

async function checkUserGCP() {
    process.env.FIRESTORE_EMULATOR_HOST = ""; // Ensure connecting to real Firestore
    if (admin.apps.length === 0) {
        admin.initializeApp({ projectId: 'cheychip' });
    }
    const db = admin.firestore();
    const email = 'hikahikarun@gmail.com';
    const doc = await db.collection('users').doc(email).get();
    
    if (!doc.exists) {
        console.log("User not found in Firestore.");
        return;
    }

    const data = doc.data();
    console.log("--- Firestore Document ---");
    console.log("Name:", data.name);
    console.log("Email:", email);
    console.log("Migrated From:", data.migrated_from);
    
    if (data.save_data) {
        try {
            const sd = JSON.parse(data.save_data);
            console.log("\n--- Save Data Content ---");
            console.log("Level:", sd.lv);
            console.log("Money:", sd.money);
            console.log("Stats:", JSON.stringify(sd.stats));
            console.log("Dungeon Progress (Stages):", Object.keys(sd.dungeonProgress).length);
            console.log("Job:", sd.currentJob);
        } catch (e) {
            console.log("Save data is not valid JSON:", data.save_data);
        }
    } else {
        console.log("save_data field is missing.");
    }
}

checkUserGCP().catch(console.error);
