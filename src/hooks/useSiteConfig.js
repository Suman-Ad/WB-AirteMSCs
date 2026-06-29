import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export const useSiteConfig = (siteKey) => {
    const [siteConfig, setSiteConfig] = useState(null);

    // Fetch Site Configs from Firestore
    const fetchConfig = async () => {
        if (!siteKey) return;
        const snap = await getDoc(doc(db, "siteConfigs", siteKey));
        if (snap.exists()) {
            setSiteConfig(snap.data());
        }
    };

    useEffect(() => {
        fetchConfig();
    }, [siteKey]);

    return siteConfig;
};
