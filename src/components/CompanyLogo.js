import React from "react";

// CSS follows the app theme immediately, including changes made in settings.
export default function CompanyLogo({ className = "", alt = "NOLINI TechEngineering Pvt Ltd", ...props }) {
  return (
    <>
      <img {...props} src={`${process.env.PUBLIC_URL}/nolini-logo-transparent.png`} alt={alt} className={`${className} company-logo-light`} />
      <img {...props} src={`${process.env.PUBLIC_URL}/nolini-logo-transparent.png`} alt={alt} className={`${className} company-logo-dark`} />
            {/* <img {...props} src={`${process.env.PUBLIC_URL}/nolini-logo.png`} alt={alt} className={`${className} company-logo-light`} />
      <img {...props} src={`${process.env.PUBLIC_URL}/nolini-logo-dark.png`} alt={alt} className={`${className} company-logo-dark`} /> */}
    </>
  );
}
