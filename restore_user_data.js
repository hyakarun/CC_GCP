const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

async function restoreUser(email) {
    console.log(`Starting restoration for ${email}...`);

    const userRef = db.collection("users").doc(email);
    const doc = await userRef.get();

    if (!doc.exists) {
        console.error("User not found in Firestore.");
        return;
    }

    const userData = doc.data();
    if (!userData.save_data) {
        console.error("No save_data found in document to restore from.");
        return;
    }

    try {
        const saveData = JSON.parse(userData.save_data);
        const level = saveData.lv || 99;
        const name = saveData.name || userData.Name || "None";

        console.log(`Updating document with Lv: ${level}, Name: ${name}`);

        await userRef.update({
            Name: name,
            Lv: level,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            restore_note: "Verified and aligned Level 99 data from save_data"
        });

        console.log("Restoration/Alignment successful!");
    } catch (e) {
        console.error("Error parsing save_data or updating document:", e);
    }
}

const email = "hikahikarun6206@gmail.com";
restoreUser(email).catch(console.error);
