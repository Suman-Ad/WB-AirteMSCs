// Add at top of file:
import { getApp } from "firebase/app";
import { collection, getDocs } from "firebase/firestore";

// Insert this useEffect (temporary for debugging)
useEffect(() => {
  (async () => {
    try {
      console.log("Firebase app config:", getApp().options); // confirm project/app config
    } catch (e) {
      console.warn("getApp() failed or app not available:", e);
    }

    const candidateRoots = [
      "assets_register",
      "assets_registers",
      "assetsregister",
      "assets",
      "AssetsRegister",
    ];

    for (const root of candidateRoots) {
      try {
        const snap = await getDocs(collection(db, root));
        console.log(`>>> root '${root}' snapshot size:`, snap.size);
        snap.forEach(d => console.log(`${root} doc id:`, d.id, "data:", d.data()));
      } catch (err) {
        console.error(`Error reading collection '${root}':`, err);
      }
    }

    // Also test the exact line you pointed at:
    try {
      const circlesSnap = await getDocs(collection(db, "assets_register"));
      console.log("circlesSnap.docs.length (assets_register):", circlesSnap.docs.length);
      circlesSnap.docs.forEach(d => console.log("circle doc:", d.id, d.data()));
    } catch (e) {
      console.error("getDocs(assets_register) threw error:", e);
    }
  })();
}, []);
