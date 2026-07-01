export const getMissingFields = (rack) => {
    const missing = [];

    if (!rack.rfaiNo) missing.push("RFAI No");
    if (!rack.rackPowerOnDate) missing.push("Rack Power On Date");

    if (!rack.drTestStatus) missing.push("DR Test Status");
    if (!rack.drTestDate) missing.push("DR Test Date");

    if (!rack.rackOwnerName) missing.push("Rack Owner");

    if (!rack.frontTopTemp) missing.push("Front Top Temp");
    if (!rack.frontMiddleTemp) missing.push("Front Mid Temp");
    if (!rack.frontBottomTemp) missing.push("Front Bottom Temp");

    if (!rack.backTopTemp) missing.push("Back Top Temp");
    if (!rack.backMiddleTemp) missing.push("Back Mid Temp");
    if (!rack.backBottomTemp) missing.push("Back Bottom Temp");

    if (!rack.rackDimensions?.height) missing.push("Rack Height");
    if (!rack.rackDimensions?.width) missing.push("Rack Width");
    if (!rack.rackDimensions?.depth) missing.push("Rack Depth");

    if (!rack.smpsRatingA) missing.push("A Source SMPS Rating");
    if (!rack.smpsNameA) missing.push("A Source SMPS Name");
    if (!rack.dbNumberA) missing.push("A Source DB Number");
    if (!rack.incomerRatingA) missing.push("A Source Incomer Rating");
    if (!rack.cableSizeA) missing.push("A Source Cable Size");
    if (!rack.cableLengthA) missing.push("A Source Cable Length");
    if (!rack.cableRunA) missing.push("A Source Cable Run");
    if (!rack.rackIncomingCableSizeA) missing.push("A Source Incoming Cable Size");
    if (!rack.rackCableLengthA) missing.push("A Source Cable Length");
    if (!rack.rackCableRunA) missing.push("A Source Cable Run");
    if (!rack.rackCableTaggingA) missing.push("A Source Cable Tagging");
    if (!rack.dbMcbNumberA) missing.push("A Source DB MCB Number");
    if (!rack.dbVoltageA) missing.push("A Source DB Voltage");
    if (!rack.dbMcbRatingA) missing.push("A Source DB MCB Rating");
    if (!rack.tempOnMcbA) missing.push("A Source Temp on MCB");
    if (!rack.dbMcbLabelA) missing.push("A Source DB MCB Label");
    if (!rack.runningLoadA) missing.push("A Source Running Load");
    if (!rack.rackEndNoDbA) missing.push("A Source Rack End No DB");
    if (!rack.rackEndDcdbNameA) missing.push("A Source Rack End DCDB Name");
    if (!rack.rackEndVoltageA) missing.push("A Source Rack End Voltage");
    if (!rack.rackEndMcbRatingA) missing.push("A Source Rack End MCB Rating");

    if (!rack.smpsRatingB) missing.push("B Source SMPS Rating");
    if (!rack.smpsNameB) missing.push("B Source SMPS Name");
    if (!rack.dbNumberB) missing.push("B Source DB Number");
    if (!rack.incomerRatingB) missing.push("B Source Incomer Rating");
    if (!rack.cableSizeB) missing.push("B Source Cable Size");
    if (!rack.cableLengthB) missing.push("B Source Cable Length");
    if (!rack.cableRunB) missing.push("B Source Cable Run");
    if (!rack.rackIncomingCableSizeB) missing.push("B Source Incoming Cable Size");
    if (!rack.rackCableLengthB) missing.push("B Source Cable Length");
    if (!rack.rackCableRunB) missing.push("B Source Cable Run");
    if (!rack.rackCableTaggingB) missing.push("B Source Cable Tagging");
    if (!rack.dbMcbNumberB) missing.push("B Source DB MCB Number");
    if (!rack.dbVoltageB) missing.push("B Source DB Voltage");
    if (!rack.dbMcbRatingB) missing.push("B Source DB MCB Rating");
    if (!rack.tempOnMcbB) missing.push("B Source Temp on MCB");
    if (!rack.dbMcbLabelB) missing.push("B Source DB MCB Label");
    if (!rack.runningLoadB) missing.push("B Source Running Load");
    if (!rack.rackEndNoDbB) missing.push("B Source Rack End No DB");
    if (!rack.rackEndDcdbNameB) missing.push("B Source Rack End DCDB Name");
    if (!rack.rackEndVoltageB) missing.push("B Source Rack End Voltage");
    if (!rack.rackEndMcbRatingB) missing.push("B Source Rack End MCB Rating");


    if (!rack.rackEquipments?.length)
        missing.push("Rack Equipments");

    if (
        rack.sourceType === "Dual Source" &&
        (!rack.smpsNameB || !rack.dbNumberB)
    ) {
        missing.push("Source B");
    }

    return missing;
};

export const buildRackAudit = (rackData) => {
    const auditData = rackData.map((rack) => ({
        ...rack,
        missingFields: getMissingFields(rack),
    }));

    return {
        auditData,
        completeRacks: auditData.filter(
            (r) => r.missingFields.length === 0
        ),
        incompleteRacks: auditData.filter(
            (r) => r.missingFields.length > 0
        ),
    };
};