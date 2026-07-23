import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase";
import {
    generateMopExcel,
    generateMopPDF,
} from "../utils/mopGenerator";
import { calculateDuration } from "../config/mopMaster";
import "../assets/mop-preview.css";

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const createEmptyRow = (columnCount) =>
    Array.from({ length: columnCount }, () => "");

const encodeTableRowsForFirestore = rows =>
    ensureArray(rows).map(row => ({
        cells: deepClone(
            Array.isArray(row) ? row : []
        ),
    }));

const decodeTableRowsFromFirestore = rows =>
    ensureArray(rows).map(row => {
        // Backward compatibility for any previously stored data.
        if (Array.isArray(row)) {
            return deepClone(row);
        }

        return Array.isArray(row?.cells)
            ? deepClone(row.cells)
            : [];
    });

const FIRESTORE_TABLE_SECTIONS = [
    "preChecks",
    "loadDetails",
    "infra",
    "network",
    "spares",
];

const encodeMopForFirestore = value => {
    const encoded = deepClone(value || {});

    FIRESTORE_TABLE_SECTIONS.forEach(section => {
        encoded[section] =
            encodeTableRowsForFirestore(
                encoded[section]
            );
    });

    return encoded;
};

const decodeMopFromFirestore = value => {
    const decoded = deepClone(value || {});

    FIRESTORE_TABLE_SECTIONS.forEach(section => {
        decoded[section] =
            decodeTableRowsFromFirestore(
                decoded[section]
            );
    });

    return decoded;
};

const normalizeSchemePart = value =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

const createMopSchemeId = row => {
    const nodeName = normalizeSchemePart(
        row?.nodeName
    );

    const activityDetails = normalizeSchemePart(
        row?.activityDetails
    );

    if (!nodeName || !activityDetails) {
        return "";
    }

    return `${nodeName}__${activityDetails}`;
};

const mergeMopSchemeWithMaster = (
    masterMop,
    schemeData
) => {
    const master = deepClone(masterMop || {});
    const scheme = deepClone(schemeData || {});

    return {
        ...master,

        header: {
            ...(master.header || {}),
            ...(scheme.header || {}),

            // Keep current activity-specific master values.
            docNo: master.header?.docNo || "",
            releaseDate:
                master.header?.releaseDate || "",
        },

        siteInfo: {
            ...(master.siteInfo || {}),
        },

        activityInfo: {
            ...(master.activityInfo || {}),
            ...(scheme.activityInfo || {}),

            // Preserve current activity-specific information.
            node:
                master.activityInfo?.node || "",

            startDate:
                master.activityInfo?.startDate || "",

            endDate:
                master.activityInfo?.endDate || "",

            startTime:
                master.activityInfo?.startTime || "",

            endTime:
                master.activityInfo?.endTime || "",

            duration:
                master.activityInfo?.duration || "",

            owner:
                master.activityInfo?.owner || "",

            oem:
                master.activityInfo?.oem || "",

            stakeholders:
                master.activityInfo?.stakeholders || "",
        },

        preChecks:
            Array.isArray(scheme.preChecks)
                ? decodeTableRowsFromFirestore(
                    scheme.preChecks
                )
                : ensureArray(master.preChecks),

        loadDetails:
            Array.isArray(scheme.loadDetails)
                ? decodeTableRowsFromFirestore(
                    scheme.loadDetails
                )
                : ensureArray(master.loadDetails),

        risk:
            Array.isArray(scheme.risk)
                ? scheme.risk
                : ensureArray(master.risk),

        mitigation:
            Array.isArray(scheme.mitigation)
                ? scheme.mitigation
                : ensureArray(master.mitigation),

        customerNotificationRequired:
            scheme.customerNotificationRequired ??
            master.customerNotificationRequired ??
            "Yes",

        activitySteps:
            Array.isArray(scheme.activitySteps)
                ? scheme.activitySteps
                : ensureArray(master.activitySteps),

        rollback:
            Array.isArray(scheme.rollback)
                ? scheme.rollback
                : ensureArray(master.rollback),

        infra:
            Array.isArray(scheme.infra)
                ? decodeTableRowsFromFirestore(
                    scheme.infra
                )
                : ensureArray(master.infra),

        network:
            Array.isArray(scheme.network)
                ? decodeTableRowsFromFirestore(
                    scheme.network
                )
                : ensureArray(master.network),

        spares:
            Array.isArray(scheme.spares)
                ? decodeTableRowsFromFirestore(
                    scheme.spares
                )
                : ensureArray(master.spares),

        approval: {
            ...(master.approval || {}),
        },
    };
};

export default function MOPPreview({ userData }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [savingMop, setSavingMop] = useState(false);
    const sourceRow = location.state?.sourceRow;
    const sheetId = location.state?.sheetId;
    const sourceRowId = location.state?.rowId;
    const createdFromPmId =
        location.state?.createdFromPmId;
    const mode = location.state?.mode || "edit";

    const isReadOnly = mode === "view";

    const receivedMop = location.state?.mop;
    const receivedHardCodedMop =
        location.state?.hardCodedMop;

    const hardCodedMop = useMemo(
        () =>
            receivedHardCodedMop
                ? deepClone(receivedHardCodedMop)
                : receivedMop
                    ? deepClone(receivedMop)
                    : null,
        [receivedHardCodedMop, receivedMop]
    );

    const schemeId = useMemo(
        () => createMopSchemeId(sourceRow),
        [sourceRow]
    );

    const receivedSavedActivityMop =
        sourceRow?.mopDocument?.data
            ? decodeMopFromFirestore(
                sourceRow.mopDocument.data
            )
            : null;

    // const [mop, setMop] = useState(() =>
    //     receivedMop ? deepClone(receivedMop) : null
    // );

    const [mop, setMop] = useState(() => {
        if (receivedSavedActivityMop) {
            return deepClone(receivedSavedActivityMop);
        }

        if (receivedMop) {
            return decodeMopFromFirestore(
                receivedMop
            );
        }

        return null;
    });

    const [hasSavedMop, setHasSavedMop] = useState(
        Boolean(sourceRow?.mopDocument?.data)
    );

    const extractReusableMopData = currentMop => ({
        header: {
            title: currentMop?.header?.title || "",
        },

        activityInfo: {
            nature:
                currentMop?.activityInfo?.nature || "",

            serviceImpact:
                currentMop?.activityInfo?.serviceImpact || "",
        },

        preChecks: encodeTableRowsForFirestore(
            currentMop?.preChecks
        ),

        loadDetails: encodeTableRowsForFirestore(
            currentMop?.loadDetails
        ),

        risk: deepClone(
            ensureArray(currentMop?.risk)
        ),

        mitigation: deepClone(
            ensureArray(currentMop?.mitigation)
        ),

        customerNotificationRequired:
            currentMop?.customerNotificationRequired ||
            "Yes",

        activitySteps: deepClone(
            ensureArray(currentMop?.activitySteps)
        ),

        rollback: deepClone(
            ensureArray(currentMop?.rollback)
        ),

        infra: encodeTableRowsForFirestore(
            currentMop?.infra
        ),

        network: encodeTableRowsForFirestore(
            currentMop?.network
        ),

        spares: encodeTableRowsForFirestore(
            currentMop?.spares
        ),
    });

    const [loadingScheme, setLoadingScheme] =
        useState(false);

    const [schemeExists, setSchemeExists] =
        useState(false);

    const [schemeVersion, setSchemeVersion] =
        useState(0);

    const hasReceivedSavedActivityMop =
        Boolean(sourceRow?.mopDocument?.data);

    useEffect(() => {
        async function loadReusableScheme() {
            if (
                !schemeId ||
                !hardCodedMop ||
                hasReceivedSavedActivityMop
            ) {
                return;
            }

            setLoadingScheme(true);

            try {
                const schemeRef = doc(
                    db,
                    "mop_schemes",
                    schemeId
                );

                const snapshot = await getDoc(schemeRef);

                if (!snapshot.exists()) {
                    setSchemeExists(false);
                    setSchemeVersion(0);
                    setMop(deepClone(hardCodedMop));
                    return;
                }

                const scheme = snapshot.data();

                if (scheme.isActive === false) {
                    setSchemeExists(false);
                    setSchemeVersion(0);
                    setMop(deepClone(hardCodedMop));
                    return;
                }

                setSchemeExists(true);
                setSchemeVersion(
                    Number(scheme.version || 1)
                );

                setMop(
                    mergeMopSchemeWithMaster(
                        hardCodedMop,
                        scheme.data || {}
                    )
                );
            } catch (error) {
                console.error(
                    "Failed to load reusable MOP scheme:",
                    error
                );

                setMop(deepClone(hardCodedMop));
            } finally {
                setLoadingScheme(false);
            }
        }

        loadReusableScheme();
    }, [
        schemeId,
        hardCodedMop,
        hasReceivedSavedActivityMop,
    ]);

    const saveReusableScheme = async () => {
        if (isReadOnly) return;

        if (
            !schemeId ||
            !hardCodedMop
        ) {
            return;
        }

        if (!schemeId) {
            alert(
                "Reusable scheme identity could not be created."
            );
            return;
        }

        if (!mop) {
            alert("No MOP data available.");
            return;
        }

        const confirmed = window.confirm(
            schemeExists
                ? "Update the reusable MOP scheme for this equipment and activity?"
                : "Save this as the reusable MOP scheme for this equipment and activity?"
        );

        if (!confirmed) return;

        setSavingMop(true);

        try {
            const schemeRef = doc(
                db,
                "mop_schemes",
                schemeId
            );

            const existingSnapshot =
                await getDoc(schemeRef);

            const existingScheme =
                existingSnapshot.exists()
                    ? existingSnapshot.data()
                    : null;

            const nextVersion =
                Number(existingScheme?.version || 0) + 1;

            await setDoc(
                schemeRef,
                {
                    schemeId,

                    mappingKey: {
                        nodeName:
                            sourceRow?.nodeName || "",

                        activityDetails:
                            sourceRow?.activityDetails || "",

                        activityCategory:
                            sourceRow?.activityCategory || "",

                        activityType:
                            sourceRow?.activityType || "",
                    },

                    masterSource: {
                        type: "HARD_CODED",

                        masterKey:
                            `${sourceRow?.nodeName || ""}__${sourceRow?.activityDetails || ""}`,
                    },

                    data: extractReusableMopData(mop),

                    version: nextVersion,
                    isActive: true,

                    createdBy:
                        existingScheme?.createdBy ||
                        userData?.uid ||
                        null,

                    createdByName:
                        existingScheme?.createdByName ||
                        userData?.name ||
                        userData?.displayName ||
                        "",

                    createdAt:
                        existingScheme?.createdAt ||
                        new Date().toISOString(),

                    updatedBy:
                        userData?.uid || null,

                    updatedByName:
                        userData?.name ||
                        userData?.displayName ||
                        "",

                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );

            setSchemeExists(true);
            setSchemeVersion(nextVersion);

            alert(
                `Reusable MOP scheme saved. Version ${nextVersion}`
            );
        } catch (error) {
            console.error(
                "Reusable MOP scheme save failed:",
                error
            );

            alert(
                error?.message ||
                "Failed to save reusable MOP scheme."
            );
        } finally {
            setSavingMop(false);
        }
    };

    useEffect(() => {
        if (!receivedMop) {
            alert("No MOP data found.");
            navigate(-1);
        }
    }, [receivedMop, navigate]);

    if (!mop) return null;

    const updateObjectField = (section, key, value) => {
        setMop((previous) => {
            const updated = {
                ...previous,
                [section]: {
                    ...(previous[section] || {}),
                    [key]: value,
                },
            };

            if (
                section === "activityInfo" &&
                (key === "startTime" || key === "endTime")
            ) {
                const startTime =
                    key === "startTime"
                        ? value
                        : updated.activityInfo?.startTime;

                const endTime =
                    key === "endTime"
                        ? value
                        : updated.activityInfo?.endTime;

                updated.activityInfo.duration =
                    startTime && endTime
                        ? calculateDuration(startTime, endTime)
                        : "";
            }

            return updated;
        });
    };

    const updateListItem = (section, index, value) => {
        setMop((previous) => ({
            ...previous,
            [section]: ensureArray(previous[section]).map(
                (item, itemIndex) =>
                    itemIndex === index ? value : item
            ),
        }));
    };

    const addListItem = (section) => {
        setMop((previous) => ({
            ...previous,
            [section]: [...ensureArray(previous[section]), ""],
        }));
    };

    const removeListItem = (section, index) => {
        setMop((previous) => ({
            ...previous,
            [section]: ensureArray(previous[section]).filter(
                (_, itemIndex) => itemIndex !== index
            ),
        }));
    };

    const moveListItem = (section, index, direction) => {
        setMop((previous) => {
            const items = [...ensureArray(previous[section])];
            const newIndex = index + direction;

            if (newIndex < 0 || newIndex >= items.length) {
                return previous;
            }

            [items[index], items[newIndex]] = [
                items[newIndex],
                items[index],
            ];

            return {
                ...previous,
                [section]: items,
            };
        });
    };

    const updateTableCell = (
        section,
        rowIndex,
        columnIndex,
        value
    ) => {
        setMop((previous) => {
            const rows = ensureArray(previous[section]).map((row) =>
                Array.isArray(row) ? [...row] : []
            );

            const selectedRow = rows[rowIndex] || [];
            selectedRow[columnIndex] = value;
            rows[rowIndex] = selectedRow;

            return {
                ...previous,
                [section]: rows,
            };
        });
    };

    const addTableRow = (section, columnCount) => {
        setMop((previous) => ({
            ...previous,
            [section]: [
                ...ensureArray(previous[section]),
                createEmptyRow(columnCount),
            ],
        }));
    };

    const removeTableRow = (section, rowIndex) => {
        setMop((previous) => ({
            ...previous,
            [section]: ensureArray(previous[section]).filter(
                (_, index) => index !== rowIndex
            ),
        }));
    };

    const moveTableRow = (section, rowIndex, direction) => {
        setMop((previous) => {
            const rows = [...ensureArray(previous[section])];
            const newIndex = rowIndex + direction;

            if (newIndex < 0 || newIndex >= rows.length) {
                return previous;
            }

            [rows[rowIndex], rows[newIndex]] = [
                rows[newIndex],
                rows[rowIndex],
            ];

            return {
                ...previous,
                [section]: rows,
            };
        });
    };

    const handleReset = () => {
        if (isReadOnly) return;

        const confirmed = window.confirm(
            "Reset this MOP to the original master template? All unsaved changes will be removed."
        );

        if (confirmed && hardCodedMop) {
            setMop(deepClone(hardCodedMop));
        }
    };

    const validateMop = () => {
        const missingFields = [];

        if (!mop.header?.title?.trim()) {
            missingFields.push("MOP title");
        }

        if (!mop.activityInfo?.nature?.trim()) {
            missingFields.push("Nature of activity");
        }

        if (!mop.activityInfo?.startDate) {
            missingFields.push("Activity start date");
        }

        if (!mop.activityInfo?.startTime) {
            missingFields.push("Activity start time");
        }

        if (!mop.activityInfo?.endTime) {
            missingFields.push("Activity end time");
        }

        if (missingFields.length) {
            alert(
                `Please complete the following fields:\n\n${missingFields.join(
                    "\n"
                )}`
            );

            return false;
        }

        return true;
    };

    const handleDownloadPDF = () => {
        if (!validateMop()) return;
        generateMopPDF(deepClone(mop));
    };

    const handleDownloadExcel = () => {
        if (!validateMop()) return;
        generateMopExcel(deepClone(mop));
    };

    const saveMopToActivity = async () => {
        if (isReadOnly) return;

        if (!sheetId) {
            alert("Daily activity sheet identity is missing.");
            return;
        }

        if (!mop) {
            alert("No MOP data available.");
            return;
        }

        setSavingMop(true);

        try {
            const sheetRef = doc(
                db,
                "daily_activity_sheets",
                sheetId
            );

            const sheetSnapshot = await getDoc(sheetRef);

            if (!sheetSnapshot.exists()) {
                throw new Error("Daily activity sheet not found.");
            }

            const sheetData = sheetSnapshot.data();
            const rows = Array.isArray(sheetData.rows)
                ? [...sheetData.rows]
                : [];

            /*
              Preferred lookup:
              1. rowId
              2. createdFromPmId
              3. activity details + node fallback for legacy data
            */
            const rowIndex = rows.findIndex((row) => {
                if (
                    sourceRowId &&
                    row.rowId &&
                    row.rowId === sourceRowId
                ) {
                    return true;
                }

                if (
                    createdFromPmId &&
                    row.createdFromPmId === createdFromPmId
                ) {
                    return true;
                }

                return (
                    row.nodeName === sourceRow?.nodeName &&
                    row.activityDetails ===
                    sourceRow?.activityDetails
                );
            });

            if (rowIndex === -1) {
                throw new Error(
                    "Corresponding daily activity row not found."
                );
            }

            const existingMop = rows[rowIndex].mopDocument;
            const nextVersion =
                Number(existingMop?.version || 0) + 1;

            /*
              Firestore Timestamp cannot safely be nested before
              JSON-style sanitization. Use serverTimestamp only
              at the document's top level and ISO text inside row.
            */
            rows[rowIndex] = {
                ...rows[rowIndex],

                rowId:
                    rows[rowIndex].rowId ||
                    sourceRowId ||
                    `${sheetId}_${rowIndex}`,

                mopDocument: {
                    data: encodeMopForFirestore(mop),
                    status: "Saved",
                    version: nextVersion,

                    createdBy:
                        existingMop?.createdBy ||
                        userData?.uid ||
                        null,

                    createdByName:
                        existingMop?.createdByName ||
                        userData?.name ||
                        userData?.displayName ||
                        "",

                    createdAt:
                        existingMop?.createdAt ||
                        new Date().toISOString(),

                    updatedBy: userData?.uid || null,

                    updatedByName:
                        userData?.name ||
                        userData?.displayName ||
                        "",

                    updatedAt: new Date().toISOString(),
                },
            };

            await updateDoc(sheetRef, {
                rows,
                lastUpdatedBy: userData?.uid || null,
                lastUpdatedAt: serverTimestamp(),
            });
            setHasSavedMop(true);

            alert(
                existingMop?.data
                    ? `MOP updated successfully. Version ${nextVersion}`
                    : "MOP saved successfully."
            );
        } catch (error) {
            console.error("MOP save failed:", error);

            alert(
                error?.message ||
                "Failed to save MOP. Check the console."
            );
        } finally {
            setSavingMop(false);
        }
    };

    return (
        <div className="mop-editor-page">
            <header className="mop-editor-toolbar">
                <div className="mop-toolbar-title">
                    <strong>Professional MOP Editor</strong>
                    <span>
                        Preview follows the Excel export layout
                    </span>
                </div>

                <div className="mop-toolbar-actions">
                    <button type="button" onClick={() => navigate(-1)}>
                        ← Back
                    </button>

                    <button type="button" onClick={handleReset}>
                        Reset
                    </button>

                    <button type="button" onClick={() => window.print()}>
                        Print
                    </button>

                    {!isReadOnly && (
                        <>
                            <button
                                type="button"
                                className="mop-save-button"
                                onClick={saveMopToActivity}
                                disabled={savingMop || loadingScheme}
                            >
                                {savingMop
                                    ? "Saving..."
                                    : hasSavedMop
                                        ? "Update Activity MOP"
                                        : "Save Activity MOP"}
                            </button>

                            <button
                                type="button"
                                onClick={saveReusableScheme}
                                disabled={
                                    savingMop ||
                                    loadingScheme ||
                                    !schemeId
                                }
                            >
                                {schemeExists
                                    ? `Update Scheme v${schemeVersion}`
                                    : "Save as Reusable Scheme"}
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        className="mop-pdf-button"
                        onClick={handleDownloadPDF}
                    >
                        PDF
                    </button>

                    <button
                        type="button"
                        className="mop-excel-button"
                        onClick={handleDownloadExcel}
                    >
                        Excel
                    </button>
                </div>
            </header>
            <div className="mop-screen-editor">
                <main className="mop-excel-sheet">
                    <MopTitleBlock
                        mop={mop}
                        updateObjectField={updateObjectField}
                    />

                    <SiteInformationBlock
                        mop={mop}
                        updateObjectField={updateObjectField}
                    />

                    <ActivityInformationBlock
                        mop={mop}
                        updateObjectField={updateObjectField}
                    />

                    <EditableTableBlock
                        title="Pre Activity Check Points :"
                        section="preChecks"
                        headers={[
                            "Checkpoints",
                            "Status",
                            "Parameters",
                        ]}
                        rows={ensureArray(mop.preChecks)}
                        columnCount={3}
                        className="mop-green-section"
                        updateTableCell={updateTableCell}
                        addTableRow={addTableRow}
                        removeTableRow={removeTableRow}
                        moveTableRow={moveTableRow}
                    />

                    <EditableTableBlock
                        title="Load / Floor Details :"
                        section="loadDetails"
                        headers={[
                            `${mop.activityInfo?.node || "Equipment"} No`,
                            "Rating",
                            "Serving Floor",
                            "Loading Percentage",
                        ]}
                        rows={ensureArray(mop.loadDetails)}
                        columnCount={4}
                        className="mop-blue-section"
                        updateTableCell={updateTableCell}
                        addTableRow={addTableRow}
                        removeTableRow={removeTableRow}
                        moveTableRow={moveTableRow}
                    />

                    <EditableListBlock
                        title="Risk Analysis :"
                        section="risk"
                        items={ensureArray(mop.risk)}
                        updateListItem={updateListItem}
                        addListItem={addListItem}
                        removeListItem={removeListItem}
                        moveListItem={moveListItem}
                    />

                    <EditableListBlock
                        title="Mitigation / Back up Plan :"
                        section="mitigation"
                        items={ensureArray(mop.mitigation)}
                        updateListItem={updateListItem}
                        addListItem={addListItem}
                        removeListItem={removeListItem}
                        moveListItem={moveListItem}
                    />

                    <div className="mop-five-column-row mop-grey-row">
                        <div className="mop-label-cell">
                            Customer Notification requires :
                        </div>

                        <div className="mop-merged-four">
                            <select
                                value={
                                    mop.customerNotificationRequired || "Yes"
                                }
                                onChange={(event) =>
                                    setMop((previous) => ({
                                        ...previous,
                                        customerNotificationRequired:
                                            event.target.value,
                                    }))
                                }
                            >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="NA">NA</option>
                            </select>
                        </div>
                    </div>

                    <ActivityStepsBlock
                        mop={mop}
                        updateListItem={updateListItem}
                        addListItem={addListItem}
                        removeListItem={removeListItem}
                        moveListItem={moveListItem}
                    />

                    <EditableListBlock
                        title="Fall back / Roll Back Plan :"
                        section="rollback"
                        items={ensureArray(mop.rollback)}
                        updateListItem={updateListItem}
                        addListItem={addListItem}
                        removeListItem={removeListItem}
                        moveListItem={moveListItem}
                    />

                    <ResourceBlock
                        title="Infra Resources :"
                        section="infra"
                        rows={ensureArray(mop.infra)}
                        updateTableCell={updateTableCell}
                        addTableRow={addTableRow}
                        removeTableRow={removeTableRow}
                        moveTableRow={moveTableRow}
                    />

                    <ResourceBlock
                        title="Network Resources :"
                        section="network"
                        rows={ensureArray(mop.network)}
                        updateTableCell={updateTableCell}
                        addTableRow={addTableRow}
                        removeTableRow={removeTableRow}
                        moveTableRow={moveTableRow}
                    />

                    <EditableTableBlock
                        title="Additional Spares required for the Activity :"
                        section="spares"
                        headers={[
                            "Spares Description",
                            "Specifications",
                            "Quantity",
                            "Availability Ensured at site (Yes/No)",
                        ]}
                        rows={ensureArray(mop.spares)}
                        columnCount={4}
                        className="mop-green-section"
                        updateTableCell={updateTableCell}
                        addTableRow={addTableRow}
                        removeTableRow={removeTableRow}
                        moveTableRow={moveTableRow}
                    />

                    <ApprovalBlock
                        mop={mop}
                        updateObjectField={updateObjectField}
                    />
                </main>
            </div>

            <PrintMopDocument mop={mop} />
        </div>
    );
}

function PrintMopDocument({ mop }) {
    if (!mop) return null;

    const header = mop.header || {};
    const siteInfo = mop.siteInfo || {};
    const activityInfo = mop.activityInfo || {};
    const approval = mop.approval || {};

    const preChecks = Array.isArray(mop.preChecks)
        ? mop.preChecks
        : [];

    const loadDetails = Array.isArray(mop.loadDetails)
        ? mop.loadDetails
        : [];

    const risks = Array.isArray(mop.risk) ? mop.risk : [];

    const mitigation = Array.isArray(mop.mitigation)
        ? mop.mitigation
        : [];

    const activitySteps = Array.isArray(mop.activitySteps)
        ? mop.activitySteps
        : [];

    const rollback = Array.isArray(mop.rollback)
        ? mop.rollback
        : [];

    const infra = Array.isArray(mop.infra) ? mop.infra : [];

    const network = Array.isArray(mop.network)
        ? mop.network
        : [];

    const spares = Array.isArray(mop.spares) ? mop.spares : [];

    const activitySummary = [
        `Activity - ${activityInfo.startDate || ""}`,
        `${activityInfo.startTime || ""} hrs to`,
        `${activityInfo.endDate || ""}`,
        `${activityInfo.endTime || ""} hrs`,
        `(Considered ${activityInfo.nature || ""} work activity case)`,
    ].join(" ");

    return (
        <div className="mop-print-document">
            <table className="mop-print-table">
                <colgroup>
                    <col className="mop-print-col-1" />
                    <col className="mop-print-col-2" />
                    <col className="mop-print-col-3" />
                    <col className="mop-print-col-4" />
                    <col className="mop-print-col-5" />
                </colgroup>

                <tbody>
                    <tr className="mop-print-title-row">
                        <td colSpan={5}>
                            {(header.title || "Method of Procedure").toUpperCase()}
                        </td>
                    </tr>

                    <tr>
                        <td colSpan={5} className="mop-print-document-info">
                            <strong>DOC NO - </strong>
                            {header.docNo || ""}
                            <span className="mop-print-document-separator" />
                            <strong>Release Date: </strong>
                            {header.releaseDate || ""}
                        </td>
                    </tr>

                    <tr>
                        <PrintLabelValue
                            label="City"
                            value={siteInfo.city}
                        />

                        <PrintLabelValue
                            label="Location"
                            value={siteInfo.location}
                        />

                        <PrintLabelValue
                            label="Floor"
                            value={siteInfo.floor}
                        />

                        <td>
                            <strong>Tier Category-Core/TX:</strong>
                        </td>

                        <td>{siteInfo.tier || ""}</td>
                    </tr>

                    <tr className="mop-print-yellow">
                        <td>
                            <strong>Nature of Activity / Work:</strong>
                        </td>
                        <td colSpan={4}>{activityInfo.nature || ""}</td>
                    </tr>

                    <tr className="mop-print-yellow">
                        <td rowSpan={2}>
                            <strong>Activity Start:</strong>
                        </td>

                        <td>
                            <strong>Activity Start Date:</strong>
                            <br />
                            {activityInfo.startDate || ""}
                        </td>

                        <td>
                            <strong>Activity End Date:</strong>
                            <br />
                            {activityInfo.endDate || ""}
                        </td>

                        <td rowSpan={2}>
                            <strong>Duration of Activity:</strong>
                        </td>

                        <td rowSpan={2}>
                            {activityInfo.duration || ""}
                        </td>
                    </tr>

                    <tr className="mop-print-yellow">
                        <td>
                            <strong>Activity Start Time:</strong>
                            <br />
                            {activityInfo.startTime || ""} Hrs
                        </td>

                        <td>
                            <strong>Activity End Time:</strong>
                            <br />
                            {activityInfo.endTime || ""} Hrs
                        </td>
                    </tr>

                    <tr className="mop-print-yellow">
                        <td>
                            <strong>Activity Owner:</strong>
                        </td>

                        <td>{activityInfo.owner || ""}</td>

                        <td>
                            <strong>
                                {activityInfo.node || "Equipment"} OEM:
                            </strong>
                            <br />
                            {activityInfo.oem || ""}
                        </td>

                        <td>
                            <strong>Other Stake Holders:</strong>
                        </td>

                        <td>{activityInfo.stakeholders || ""}</td>
                    </tr>

                    <tr className="mop-print-yellow">
                        <td>
                            <strong>Service Impact:</strong>
                        </td>

                        <td colSpan={4}>
                            {activityInfo.serviceImpact || ""}
                        </td>
                    </tr>

                    <PrintTableSection
                        title="Pre Activity Check Points:"
                        headers={["Checkpoints", "", "Status", "Parameters"]}
                        rows={preChecks.map((row) => [
                            row?.[0] || "",
                            "",
                            row?.[1] || "",
                            row?.[2] || "",
                        ])}
                        headerClass="mop-print-green"
                        mergeSecondAndThird
                    />

                    <PrintTableSection
                        title="Load / Floor Details:"
                        headers={[
                            `${activityInfo.node || "Equipment"} No`,
                            "Rating",
                            "Serving Floor",
                            "Loading Percentage",
                        ]}
                        rows={loadDetails}
                        headerClass="mop-print-blue"
                    />

                    <PrintListSection
                        title="Risk Analysis:"
                        items={risks}
                    />

                    <PrintListSection
                        title="Mitigation / Back up Plan:"
                        items={mitigation}
                    />

                    <tr className="mop-print-grey">
                        <td>
                            <strong>Customer Notification requires:</strong>
                        </td>

                        <td colSpan={4}>
                            {mop.customerNotificationRequired || "Yes"}
                        </td>
                    </tr>

                    <tr className="mop-print-grey">
                        <td rowSpan={Math.max(activitySteps.length + 1, 1)}>
                            <strong>Activity:</strong>
                        </td>

                        <td colSpan={4}>{activitySummary}</td>
                    </tr>

                    {activitySteps.map((step, index) => (
                        <tr key={`print-activity-${index}`}>
                            <td colSpan={4}>
                                <strong>{index + 1}. </strong>
                                {step || ""}
                            </td>
                        </tr>
                    ))}

                    <PrintListSection
                        title="Fall back / Roll Back Plan:"
                        items={rollback}
                    />

                    <PrintResourceSection
                        title="Infra Resources:"
                        rows={infra}
                    />

                    {network.length > 0 && (
                        <PrintResourceSection
                            title="Network Resources:"
                            rows={network}
                        />
                    )}

                    <PrintTableSection
                        title="Additional Spares required for the Activity:"
                        headers={[
                            "Spares Description",
                            "Specifications",
                            "Quantity",
                            "Availability Ensured at site (Yes/No)",
                        ]}
                        rows={spares}
                        headerClass="mop-print-green"
                    />

                    <tr>
                        <td>
                            <strong>Created By:</strong>
                            <br />
                            {approval.createdBy || ""}
                        </td>

                        <td>
                            <strong>Reviewer:</strong>
                            <br />
                            {approval.reviewer || ""}
                        </td>

                        <td>
                            <strong>Approver:</strong>
                            <br />
                            {approval.approver || ""}
                        </td>

                        <td colSpan={2}>
                            <strong>CR Number:</strong>
                            <br />
                            {approval.crNumber || ""}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function PrintLabelValue({ label, value }) {
    return (
        <td>
            <strong>{label}:</strong>
            <br />
            {value || ""}
        </td>
    );
}

function PrintListSection({ title, items }) {
    const safeItems = items.length ? items : [""];

    return (
        <>
            {safeItems.map((item, index) => (
                <tr key={`${title}-${index}`}>
                    {index === 0 && (
                        <td rowSpan={safeItems.length} className="mop-print-grey">
                            <strong>{title}</strong>
                        </td>
                    )}

                    <td colSpan={4}>
                        {item && (
                            <>
                                <strong>{index + 1}. </strong>
                                {item}
                            </>
                        )}
                    </td>
                </tr>
            ))}
        </>
    );
}

function PrintResourceSection({ title, rows }) {
    const safeRows = rows.length ? rows : [["", ""]];

    return (
        <>
            <tr className="mop-print-grey">
                <td rowSpan={safeRows.length + 1}>
                    <strong>{title}</strong>
                </td>

                <td colSpan={2}>
                    <strong>Role</strong>
                </td>

                <td colSpan={2}>
                    <strong>Name</strong>
                </td>
            </tr>

            {safeRows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                    <td colSpan={2}>{row?.[0] || ""}</td>
                    <td colSpan={2}>{row?.[1] || ""}</td>
                </tr>
            ))}
        </>
    );
}

function PrintTableSection({
    title,
    headers,
    rows,
    headerClass = "",
    mergeSecondAndThird = false,
}) {
    const safeRows = rows.length
        ? rows
        : [Array.from({ length: headers.length }, () => "")];

    return (
        <>
            <tr className={headerClass}>
                <td rowSpan={safeRows.length + 1}>
                    <strong>{title}</strong>
                </td>

                {mergeSecondAndThird ? (
                    <>
                        <td colSpan={2}>
                            <strong>{headers[0]}</strong>
                        </td>

                        <td>
                            <strong>{headers[2]}</strong>
                        </td>

                        <td>
                            <strong>{headers[3]}</strong>
                        </td>
                    </>
                ) : (
                    headers.map((header, index) => (
                        <td key={`${title}-header-${index}`}>
                            <strong>{header}</strong>
                        </td>
                    ))
                )}
            </tr>

            {safeRows.map((row, rowIndex) => (
                <tr key={`${title}-row-${rowIndex}`}>
                    {mergeSecondAndThird ? (
                        <>
                            <td colSpan={2}>{row?.[0] || ""}</td>
                            <td>{row?.[2] || ""}</td>
                            <td>{row?.[3] || ""}</td>
                        </>
                    ) : (
                        headers.map((_, columnIndex) => (
                            <td key={`${rowIndex}-${columnIndex}`}>
                                {row?.[columnIndex] || ""}
                            </td>
                        ))
                    )}
                </tr>
            ))}
        </>
    );
}

function MopTitleBlock({ mop, updateObjectField }) {
    return (
        <>
            <div className="mop-main-title">
                <input
                    value={mop.header?.title || ""}
                    onChange={(event) =>
                        updateObjectField(
                            "header",
                            "title",
                            event.target.value
                        )
                    }
                />
            </div>

            <div className="mop-document-row">
                <label>
                    DOC NO -
                    <input
                        value={mop.header?.docNo || ""}
                        onChange={(event) =>
                            updateObjectField(
                                "header",
                                "docNo",
                                event.target.value
                            )
                        }
                    />
                </label>

                <label>
                    Release Date :
                    <input
                        value={mop.header?.releaseDate || ""}
                        onChange={(event) =>
                            updateObjectField(
                                "header",
                                "releaseDate",
                                event.target.value
                            )
                        }
                    />
                </label>
            </div>
        </>
    );
}

function SiteInformationBlock({
    mop,
    updateObjectField,
}) {
    return (
        <div className="mop-five-column-row mop-site-row">
            <LabeledInput
                label="City"
                value={mop.siteInfo?.city}
                onChange={(value) =>
                    updateObjectField("siteInfo", "city", value)
                }
            />

            <LabeledInput
                label="Location"
                value={mop.siteInfo?.location}
                onChange={(value) =>
                    updateObjectField("siteInfo", "location", value)
                }
            />

            <LabeledInput
                label="Floor"
                value={mop.siteInfo?.floor}
                onChange={(value) =>
                    updateObjectField("siteInfo", "floor", value)
                }
            />

            <div className="mop-static-cell">
                Tier Category-Core/TX :
            </div>

            <input
                value={mop.siteInfo?.tier || ""}
                onChange={(event) =>
                    updateObjectField(
                        "siteInfo",
                        "tier",
                        event.target.value
                    )
                }
            />
        </div>
    );
}

function ActivityInformationBlock({
    mop,
    updateObjectField,
}) {
    const activity = mop.activityInfo || {};

    return (
        <section className="mop-yellow-block">
            <div className="mop-five-column-row">
                <div className="mop-label-cell">
                    Nature of Activity / Work :
                </div>

                <div className="mop-merged-four">
                    <textarea
                        value={activity.nature || ""}
                        onChange={(event) =>
                            updateObjectField(
                                "activityInfo",
                                "nature",
                                event.target.value
                            )
                        }
                    />
                </div>
            </div>

            <div className="mop-five-column-row">
                <div
                    className="mop-label-cell mop-vertical-label"
                    data-label="Activity Start :"
                >
                    Activity Start :
                </div>

                <LabeledInput
                    label="Activity Start Date"
                    type="date"
                    value={activity.startDate}
                    onChange={(value) =>
                        updateObjectField(
                            "activityInfo",
                            "startDate",
                            value
                        )
                    }
                />

                <LabeledInput
                    label="Activity End Date"
                    type="date"
                    value={activity.endDate}
                    onChange={(value) =>
                        updateObjectField(
                            "activityInfo",
                            "endDate",
                            value
                        )
                    }
                />

                <div className="mop-label-cell">
                    Duration of Activity :
                </div>

                <input value={activity.duration || ""} readOnly />
            </div>

            <div className="mop-five-column-row">
                <div className="mop-label-cell mop-empty-cell" />

                <LabeledInput
                    label="Activity Start Time"
                    type="time"
                    value={activity.startTime}
                    onChange={(value) =>
                        updateObjectField(
                            "activityInfo",
                            "startTime",
                            value
                        )
                    }
                />

                <LabeledInput
                    label="Activity End Time"
                    type="time"
                    value={activity.endTime}
                    onChange={(value) =>
                        updateObjectField(
                            "activityInfo",
                            "endTime",
                            value
                        )
                    }
                />

                <div className="mop-label-cell mop-empty-cell" />
                <input value={activity.duration || ""} readOnly />
            </div>

            <div className="mop-five-column-row">
                <div className="mop-label-cell">
                    Activity Owner :
                </div>

                <input
                    value={activity.owner || ""}
                    onChange={(event) =>
                        updateObjectField(
                            "activityInfo",
                            "owner",
                            event.target.value
                        )
                    }
                />

                <LabeledInput
                    label={`${activity.node || "Equipment"} OEM`}
                    value={activity.oem}
                    onChange={(value) =>
                        updateObjectField("activityInfo", "oem", value)
                    }
                />

                <div className="mop-label-cell">
                    Other Stake Holders :
                </div>

                <input
                    value={activity.stakeholders || ""}
                    onChange={(event) =>
                        updateObjectField(
                            "activityInfo",
                            "stakeholders",
                            event.target.value
                        )
                    }
                />
            </div>

            <div className="mop-five-column-row">
                <div className="mop-label-cell">
                    Service Impact :
                </div>

                <div className="mop-merged-four">
                    <input
                        value={activity.serviceImpact || ""}
                        onChange={(event) =>
                            updateObjectField(
                                "activityInfo",
                                "serviceImpact",
                                event.target.value
                            )
                        }
                    />
                </div>
            </div>
        </section>
    );
}

function EditableTableBlock({
    title,
    section,
    headers,
    rows,
    columnCount,
    className = "",
    updateTableCell,
    addTableRow,
    removeTableRow,
    moveTableRow,
}) {
    return (
        <section className={`mop-table-section ${className}`}>
            <div className="mop-table-section-header">
                <div>{title}</div>

                {headers.map((header) => (
                    <div key={header}>{header}</div>
                ))}
            </div>

            {rows.map((row, rowIndex) => (
                <div
                    className="mop-table-edit-row"
                    key={`${section}-${rowIndex}`}
                >
                    <div className="mop-row-section-label">
                        {rowIndex === 0 ? title : ""}
                    </div>

                    {Array.from({ length: columnCount }).map(
                        (_, columnIndex) => (
                            <textarea
                                key={`${rowIndex}-${columnIndex}`}
                                value={row?.[columnIndex] ?? ""}
                                onChange={(event) =>
                                    updateTableCell(
                                        section,
                                        rowIndex,
                                        columnIndex,
                                        event.target.value
                                    )
                                }
                            />
                        )
                    )}

                    <RowActions
                        index={rowIndex}
                        count={rows.length}
                        onMoveUp={() =>
                            moveTableRow(section, rowIndex, -1)
                        }
                        onMoveDown={() =>
                            moveTableRow(section, rowIndex, 1)
                        }
                        onRemove={() =>
                            removeTableRow(section, rowIndex)
                        }
                    />
                </div>
            ))}

            <SectionAddButton
                onClick={() => addTableRow(section, columnCount)}
                label="Add Row"
            />
        </section>
    );
}

function EditableListBlock({
    title,
    section,
    items,
    updateListItem,
    addListItem,
    removeListItem,
    moveListItem,
}) {
    return (
        <section className="mop-list-section">
            {items.map((item, index) => (
                <div
                    className="mop-list-edit-row"
                    key={`${section}-${index}`}
                >
                    <div className="mop-row-section-label">
                        {index === 0 ? title : ""}
                    </div>

                    <div className="mop-merged-four mop-list-content">
                        <span>{index + 1}.</span>

                        <textarea
                            value={item || ""}
                            onChange={(event) =>
                                updateListItem(
                                    section,
                                    index,
                                    event.target.value
                                )
                            }
                        />

                        <RowActions
                            index={index}
                            count={items.length}
                            onMoveUp={() =>
                                moveListItem(section, index, -1)
                            }
                            onMoveDown={() =>
                                moveListItem(section, index, 1)
                            }
                            onRemove={() =>
                                removeListItem(section, index)
                            }
                        />
                    </div>
                </div>
            ))}

            {items.length === 0 && (
                <div className="mop-five-column-row">
                    <div className="mop-row-section-label">
                        {title}
                    </div>
                    <div className="mop-merged-four mop-empty-message">
                        No entries
                    </div>
                </div>
            )}

            <SectionAddButton
                onClick={() => addListItem(section)}
                label="Add Item"
            />
        </section>
    );
}

function ActivityStepsBlock({
    mop,
    updateListItem,
    addListItem,
    removeListItem,
    moveListItem,
}) {
    const items = ensureArray(mop.activitySteps);
    const activity = mop.activityInfo || {};

    const summary =
        `Activity - ${activity.startDate || ""} ` +
        `${activity.startTime || ""} hrs to ` +
        `${activity.endDate || ""} ` +
        `${activity.endTime || ""} hrs ` +
        `(Considered ${activity.nature || ""} work activity case)`;

    return (
        <section className="mop-list-section">
            <div className="mop-five-column-row mop-grey-row">
                <div className="mop-row-section-label">
                    Activity :
                </div>

                <div className="mop-merged-four">
                    <textarea value={summary} readOnly />
                </div>
            </div>

            {items.map((item, index) => (
                <div
                    className="mop-list-edit-row"
                    key={`activitySteps-${index}`}
                >
                    <div className="mop-row-section-label" />

                    <div className="mop-merged-four mop-list-content">
                        <span>{index + 1}.</span>

                        <textarea
                            value={item || ""}
                            onChange={(event) =>
                                updateListItem(
                                    "activitySteps",
                                    index,
                                    event.target.value
                                )
                            }
                        />

                        <RowActions
                            index={index}
                            count={items.length}
                            onMoveUp={() =>
                                moveListItem("activitySteps", index, -1)
                            }
                            onMoveDown={() =>
                                moveListItem("activitySteps", index, 1)
                            }
                            onRemove={() =>
                                removeListItem("activitySteps", index)
                            }
                        />
                    </div>
                </div>
            ))}

            <SectionAddButton
                onClick={() => addListItem("activitySteps")}
                label="Add Activity Step"
            />
        </section>
    );
}

function ResourceBlock({
    title,
    section,
    rows,
    updateTableCell,
    addTableRow,
    removeTableRow,
    moveTableRow,
}) {
    return (
        <section className="mop-table-section">
            <div className="mop-table-section-header mop-grey-row">
                <div>{title}</div>
                <div className="mop-header-span-two">Role</div>
                <div className="mop-header-span-two">Name</div>
            </div>

            {rows.map((row, index) => (
                <div
                    className="mop-resource-row"
                    key={`${section}-${index}`}
                >
                    <div className="mop-row-section-label">
                        {index === 0 ? title : ""}
                    </div>

                    <textarea
                        className="mop-resource-role"
                        value={row?.[0] || ""}
                        onChange={(event) =>
                            updateTableCell(
                                section,
                                index,
                                0,
                                event.target.value
                            )
                        }
                    />

                    <textarea
                        className="mop-resource-name"
                        value={row?.[1] || ""}
                        onChange={(event) =>
                            updateTableCell(
                                section,
                                index,
                                1,
                                event.target.value
                            )
                        }
                    />

                    <RowActions
                        index={index}
                        count={rows.length}
                        onMoveUp={() =>
                            moveTableRow(section, index, -1)
                        }
                        onMoveDown={() =>
                            moveTableRow(section, index, 1)
                        }
                        onRemove={() =>
                            removeTableRow(section, index)
                        }
                    />
                </div>
            ))}

            <SectionAddButton
                onClick={() => addTableRow(section, 2)}
                label="Add Resource"
            />
        </section>
    );
}

function ApprovalBlock({ mop, updateObjectField }) {
    const approval = mop.approval || {};

    return (
        <div className="mop-five-column-row mop-approval-row">
            <LabeledInput
                label="Created By"
                value={approval.createdBy}
                onChange={(value) =>
                    updateObjectField(
                        "approval",
                        "createdBy",
                        value
                    )
                }
            />

            <LabeledInput
                label="Reviewer"
                value={approval.reviewer}
                onChange={(value) =>
                    updateObjectField(
                        "approval",
                        "reviewer",
                        value
                    )
                }
            />

            <LabeledInput
                label="Approver"
                value={approval.approver}
                onChange={(value) =>
                    updateObjectField(
                        "approval",
                        "approver",
                        value
                    )
                }
            />

            <LabeledInput
                label="CR Number"
                value={approval.crNumber}
                onChange={(value) =>
                    updateObjectField(
                        "approval",
                        "crNumber",
                        value
                    )
                }
            />
        </div>
    );
}

function LabeledInput({
    label,
    value = "",
    type = "text",
    onChange,
}) {
    return (
        <label className="mop-inline-field">
            <span>{label} :</span>

            <input
                type={type}
                value={value ?? ""}
                onChange={(event) => onChange(event.target.value)}
            />
        </label>
    );
}

function RowActions({
    index,
    count,
    onMoveUp,
    onMoveDown,
    onRemove,
}) {
    return (
        <div className="mop-row-actions">
            <button
                type="button"
                onClick={onMoveUp}
                disabled={index === 0}
                title="Move up"
            >
                ↑
            </button>

            <button
                type="button"
                onClick={onMoveDown}
                disabled={index === count - 1}
                title="Move down"
            >
                ↓
            </button>

            <button
                type="button"
                className="mop-remove-button"
                onClick={onRemove}
                title="Remove"
            >
                ×
            </button>
        </div>
    );
}

function SectionAddButton({ onClick, label }) {
    return (
        <div className="mop-section-add-row">
            <button type="button" onClick={onClick}>
                + {label}
            </button>
        </div>
    );
}
