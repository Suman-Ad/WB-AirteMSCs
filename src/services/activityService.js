import { db } from "../firebase.js";
import {
    collection,
    addDoc,
    serverTimestamp,
} from "firebase/firestore";

export async function writeActivityLog({
    siteKey,
    rackKey,
    action,
    user,
    changes,
}) {

    if (!changes?.length) return;

    await addDoc(
        collection(
            db,
            "acDcRackDetails",
            siteKey,
            "racks",
            rackKey,
            "activityLogs"
        ),
        {
            action,
            user,
            changes,
            createdAt: serverTimestamp(),
        }
    );
}