const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkUser(email) {
  console.log(`Checking user: ${email}`);
  const doc = await db.collection("users").doc(email).get();
  if (!doc.exists) {
    console.log("User not found in Firestore.");
    return;
  }
  const data = doc.data();
  console.log("Firestore Document All Fields:", JSON.stringify(data, null, 2));
  
  if (data.save_data) {
    try {
      const saveData = JSON.parse(data.save_data);
      console.log("Save Data Contents:");
      console.log(`- Player Name: ${saveData.name}`);
      console.log(`- Player Level: ${saveData.lv}`);
    } catch (e) {
      console.log("Error parsing save_data JSON.");
    }
  } else {
    console.log("No save_data found in document.");
  }
}

const email = "hikahikarun6206@gmail.com";
checkUser(email).catch(console.error);
