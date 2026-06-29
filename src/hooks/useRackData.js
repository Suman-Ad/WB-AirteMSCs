export const fetchData = async () => {
    setLoading(true); // 🔄 START loading
    try {
        let allRacks = [];

        if (isPrivileged) {
            const sitesSnapshot = await getDocs(collection(db, "acDcRackDetails"));

            for (const siteDoc of sitesSnapshot.docs) {
                const siteKey = siteDoc.id;
                const racksRef = collection(db, "acDcRackDetails", siteKey, "racks");
                const racksSnapshot = await getDocs(racksRef);

                racksSnapshot.forEach((rackDoc) => {
                    allRacks.push({
                        id: rackDoc.id,
                        siteKey,
                        ...rackDoc.data(),
                        siteName: rackDoc.data().siteName || siteKey, // ✅ fallback
                    });
                });
            }
        } else if (userData?.site) {
            const siteKey = userData.site.trim().toUpperCase().replace(/[\/\s]+/g, "_");
            const racksRef = collection(db, "acDcRackDetails", siteKey, "racks");
            const racksSnapshot = await getDocs(racksRef);

            racksSnapshot.forEach((rackDoc) => {
                allRacks.push({
                    id: rackDoc.id,
                    siteKey,
                    ...rackDoc.data(),
                    siteName: rackDoc.data().siteName || siteKey,
                });
            });
        }

        setRackData(allRacks);
        // localStorage.setItem("acdcRackFilters", JSON.stringify(allRacks));
        // console.log("✅ Total racks fetched:", allRacks.length);
    } catch (err) {
        console.error("❌ Fetch error:", err);
    } finally {
        setLoading(false); // ✅ STOP loading (important)
    }
};