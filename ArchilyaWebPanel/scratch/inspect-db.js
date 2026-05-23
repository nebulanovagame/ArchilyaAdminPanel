const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Force Firestore Admin SDK to connect to the emulator
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

try {
  initializeApp({
    projectId: "nng-toma"
  });

  const db = getFirestore();
  console.log("Connected to Firestore emulator. Fetching users...");

  db.collection("users").get().then((snapshot) => {
    console.log(`Found ${snapshot.size} users:`);
    snapshot.forEach((doc) => {
      console.log(`User ID: ${doc.id}, Data:`, doc.data());
    });
    process.exit(0);
  }).catch((err) => {
    console.error("Error fetching users:", err);
    process.exit(1);
  });
} catch (e) {
  console.error("Initialization error:", e);
  process.exit(1);
}
