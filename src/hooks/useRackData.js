import { useEffect, useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  isPrivilegedUser,
} from "./useRackPermissions";

export default function useRackData(userData) {
  const [rackData, setRackData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRackData = useCallback(async () => {
    if (!userData) return;

    setLoading(true);

    try {
      const isPrivileged = isPrivilegedUser(userData);
      let allRacks = [];

      if (isPrivileged) {
        const sitesSnapshot = await getDocs(collection(db, "acDcRackDetails"));

        const promises = sitesSnapshot.docs.map(async (siteDoc) => {
          const siteKey = siteDoc.id;

          const racksSnapshot = await getDocs(
            collection(db, "acDcRackDetails", siteKey, "racks")
          );

          return racksSnapshot.docs.map((rackDoc) => ({
            id: rackDoc.id,
            siteKey,
            ...rackDoc.data(),
            siteName: rackDoc.data().siteName || siteKey,
          }));
        });

        const result = await Promise.all(promises);

        setRackData(result.flat());
      } else if (userData?.site) {
        const siteKey = userData.site
          .trim()
          .toUpperCase()
          .replace(/[\/\s]+/g, "_");

        const racksSnapshot = await getDocs(
          collection(
            db,
            "acDcRackDetails",
            siteKey,
            "racks"
          )
        );

        racksSnapshot.forEach((rackDoc) => {
          allRacks.push({
            id: rackDoc.id,
            siteKey,
            ...rackDoc.data(),
            siteName:
              rackDoc.data().siteName || siteKey,
          });
        });
        
        setRackData(allRacks);

      }

    } catch (err) {
      console.error("Fetch Rack Data Error:", err);
    } finally {
      setLoading(false);
    }
  }, [userData]);

  useEffect(() => {
    fetchRackData();
  }, [fetchRackData]);

  return {
    rackData,
    setRackData,
    loading,
    refreshRackData: fetchRackData,
  };
}