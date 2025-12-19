const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.deleteUserCompletely = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Not logged in");
    }

    const callerUid = context.auth.uid;
    const targetUid = data?.uid;

    if (!targetUid) {
      throw new functions.https.HttpsError(
          "invalid-argument",
          "Target UID missing",
      );
    }

    const callerSnap = await admin.firestore()
        .collection("users")
        .doc(callerUid)
        .get();

    if (!callerSnap.exists) {
      throw new functions.https.HttpsError(
          "permission-denied",
          "Caller not found",
      );
    }

    if (callerSnap.data().role !== "Super Admin") {
      throw new functions.https.HttpsError(
          "permission-denied",
          "Only Super Admin allowed",
      );
    }

    // 🔥 Delete Auth user
    await admin.auth().deleteUser(targetUid);

    // 🔥 Delete Firestore user
    await admin.firestore().collection("users").doc(targetUid).delete();

    return {success: true};
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

