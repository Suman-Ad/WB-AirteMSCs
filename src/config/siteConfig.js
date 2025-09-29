// src/config/siteConfig.js

import ashisSign from "../assets/signatures/ashis.png";
// import kunalSign from "../assets/signatures/kunal.png";

export const asansolSiteConfig = {
    circleName: "Nxtra-GB - West Bengal",   // fixed formatting
    siteName: "ASANSOL",
    location: "West Bengal",
    supplierCode: "382715",
    supplierName: "INDIAN OIL CORPORATION LIMITED",
    supplierSiteName: "WEST BENGAL",        // ✅ corrected
    siteId: "61119-ASAN-1815677",


    preparedBy: "Mr. Ashis Paul.",          // ✅ confirm from CCMS sample
    preparedByRole: "Infra – ROB.",         // ✅ confirm spacing
    preparedBySign: ashisSign,



    authorizedBy: "Mr. Kunal Roy.",         // ✅ confirm from CCMS sample
    authorizedByRole: "Circle Infra Head",  // ✅ confirm wording
    //   authorizedBySign: "./assets/signatures/kunal.png",

    department: "MSC",
    vendorShortName: "IOCL",

    // ✅ NEW
    budgetCode: "",   // "BT-12345", //replace with real Budget Tracking Code
    gpn: "",                  //"GPN-4567", //replace with actual GPN
    gprSharing: "",
};
