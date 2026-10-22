import { runTransaction } from "firebase/firestore";

export function startAutomaticDG(db, powerRef, updateData, selectedDG) {
  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(powerRef);
    const source = current.exists() ? current.data().powerSource : "EB";
    if (source !== "EB") return false;
    transaction.set(powerRef, { ...updateData, selectedDG }, { merge: true });
    return true;
  });
}
