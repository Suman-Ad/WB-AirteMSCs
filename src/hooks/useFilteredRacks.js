import { useMemo } from "react";

export const useFilteredRacks = (
    rackData,
    filters,
    universalFilter,
    userData,
    isPrivileged
) => {
    return useMemo(() => {
        return rackData.filter((d) => {

            const siteMatch = filters.site
                ? d.siteName?.toLowerCase().includes(filters.site.toLowerCase())
                : true;

            const locationMatch = filters.location
                ? d.equipmentLocation?.toLowerCase().includes(filters.location.toLowerCase())
                : true;

            const equipMatch = filters.equipNo
                ? d.equipmentRackNo?.toLowerCase().includes(filters.equipNo.toLowerCase())
                : true;

            const rackMatch = filters.rackName
                ? d.rackName?.toLowerCase().includes(filters.rackName.toLowerCase())
                : true;

            const powerMatch = filters.powerType
                ? d.powerType?.toLowerCase() === filters.powerType.toLowerCase()
                : true;

            const sourceMatch = filters.sourceType
                ? d.sourceType?.toLowerCase() === filters.sourceType.toLowerCase()
                : true;

            const typeMatch = filters.rackType
                ? d.rackType?.toLowerCase() === filters.rackType.toLowerCase()
                : true;

            const domainMatch = filters.rackDomainType
                ? d.rackDomainType?.toLowerCase() === filters.rackDomainType.toLowerCase()
                : true;

            const search = universalFilter.trim().toLowerCase();

            const equipmentMatch =
                d.rackEquipments?.some((eq) =>
                    [
                        eq.name,
                        eq.remarks,
                        eq.startU,
                        eq.endU,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase()
                        .includes(search)
                );

            const universalMatch =
                !search ||
                equipmentMatch ||
                [
                    d.siteName,
                    d.circle,
                    d.region,
                    d.equipmentLocation,
                    d.equipmentRackNo,
                    d.rackName,
                    d.rfaiNo,
                    d.powerType,
                    d.sourceType,
                    d.rackType,
                    d.rackDomainType,
                    d.rackOwnerName,
                    d.smpsNameA,
                    d.smpsNameB,
                    d.dbNumberA,
                    d.dbNumberB,
                    d.remarksA,
                    d.remarksB,
                ]
                    .filter(Boolean)
                    .some((value) =>
                        String(value)
                            .toLowerCase()
                            .includes(search)
                    );

            const matchesAll =
                universalMatch &&
                siteMatch &&
                locationMatch &&
                equipMatch &&
                rackMatch &&
                powerMatch &&
                sourceMatch &&
                typeMatch &&
                domainMatch;

            if (isPrivileged) return matchesAll;

            return (
                d.siteName?.toLowerCase() === userData?.site?.toLowerCase() &&
                matchesAll
            );
        });
    }, [
        rackData,
        filters,
        universalFilter,
        userData,
        isPrivileged
    ]);
};