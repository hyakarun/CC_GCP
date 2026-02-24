const admin = require("firebase-admin");

async function checkDetails() {
    if (admin.apps.length === 0) {
        admin.initializeApp({ projectId: "cheychip" });
    }
    const db = admin.firestore();
    const email = "hikahikarun6206@gmail.com";
    const doc = await db.collection("users").doc(email).get();
    if (doc.exists) {
        const data = doc.data();
        console.log("Full Document Data:");
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log("User not found.");
    }
}

checkDetails().catch(console.error);
