export const TAB_FIELDS = {
  General: [
    "equipmentLocation",
    "equipmentRackNo",
    "rackName",
    "rfaiNo",
    "rackPowerOnDate",
    "rackType",
    "powerType",
    "rackSize",
    "totalRackUSpace",
  ],

  Equipment: [
    "rackEquipments",
  ],

  Temperature: [
    "frontTopTemp",
    "frontMiddleTemp",
    "frontBottomTemp",
    "backTopTemp",
    "backMiddleTemp",
    "backBottomTemp",
  ],

  "Source A": [
    "smpsRatingA",
    "smpsNameA",
    "dbNumberA",
    "runningLoadA",
    "dbVoltageA",
    "dbMcbRatingA",
  ],

  "Source B": [
    "smpsRatingB",
    "smpsNameB",
    "dbNumberB",
    "runningLoadB",
    "dbVoltageB",
    "dbMcbRatingB",
  ],

  Capacity: [
    "totalLoadBoth",
    "bothCableCapacity",
  ],

  "Domain & DR": [
    "rackDomainType",
    "rackOwnerName",
    "drTestStatus",
  ],
};

export function getTabCompletion(tab, formData, rackEquipments = []) {
  const fields = TAB_FIELDS[tab];

  if (!fields) return 0;

  if (tab === "Equipment") {
    if (!rackEquipments.length) return 0;

    const valid = rackEquipments.filter(
      e => e.name && e.startU && e.endU
    ).length;

    return Math.round((valid / rackEquipments.length) * 100);
  }

  let completed = 0;

  fields.forEach(field => {
    const value = formData[field];

    if (
      value !== "" &&
      value !== null &&
      value !== undefined
    ) {
      completed++;
    }
  });

  return Math.round((completed / fields.length) * 100);
}