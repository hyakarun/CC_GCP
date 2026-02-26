const admin = require("firebase-admin");

async function stripJobData() {
    if (admin.apps.length === 0) {
        admin.initializeApp({ projectId: 'cheychip' });
    }
    const db = admin.firestore();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    console.log(`Checking ${snapshot.size} users for job data stripping...`);

    let count = 0;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.save_data) {
            try {
                const saveData = JSON.parse(data.save_data);
                let changed = false;

                if (saveData.currentJob) {
                    delete saveData.currentJob;
                    changed = true;
                }
                if (saveData.jobData) {
                    delete saveData.jobData;
                    changed = true;
                }

                if (changed) {
                    await doc.ref.update({
                        save_data: JSON.stringify(saveData),
                        updated_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                    count++;
                }
            } catch (e) {
                console.error(`Error parsing save_data for ${doc.id}`);
            }
        }
    }

    console.log(`Stripped job data from ${count} users.`);
}

stripJobData().catch(console.error);
