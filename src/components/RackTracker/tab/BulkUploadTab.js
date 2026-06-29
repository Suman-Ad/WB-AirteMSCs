import React from "react";

const BulkUploadTab = ({ 
    formData, 
    handleChange, 
    isAdmin, 
    editData,
    handleBulkExcelUpload,
    handleDownloadExcelTemplate,
    uploadProgress,
    bulkControl,
    setBulkControl,
    handleBulkRollback,
    bulkCreatedRefs,
    bulkControlRef,

 }) => {
  return (
    <div>
        <div>
            {isAdmin && !editData && (
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.xlsb"
                  onChange={handleBulkExcelUpload}
                  style={{ color: "blueviolet" }}
                />
                <div>
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      cursor: "pointer",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "4px"
                    }}
                  >
                    ⬇ Download Excel Format
                  </button>
                  <p style={{ fontSize: "11px", color: "#aaa", marginTop: "4px" }}>
                    Please use the provided Excel format for bulk upload.
                  </p>
                </div>
              </div>
            )}


            {isAdmin && !editData && (
              <p style={{ fontSize: "12px", color: "#aaa" }}>
                {bulkCreatedRefs.length > 0 && !uploadProgress.active && (
                  <button
                    className="danger-btn"
                    onClick={handleBulkRollback}
                  >
                    Undo Bulk Upload
                  </button>
                )}
                {uploadProgress.active && (
                  <div className="upload-progress">
                    <progress
                      value={uploadProgress.current + uploadProgress.skipped}
                      max={uploadProgress.total}
                    />

                    <p>
                      Uploaded {uploadProgress.current} / {uploadProgress.total}
                      &nbsp;|&nbsp;
                      Skipped: {uploadProgress.skipped}
                    </p>
                  </div>
                )}

                {uploadProgress.active && (
                  <div className="bulk-controls">
                    <button
                      onClick={() => {
                        bulkControlRef.current.paused = !bulkControlRef.current.paused;
                      }}
                    >
                      {bulkControlRef.current.paused ? "Resume" : "Pause"}
                    </button>

                    <button
                      className="danger-btn"
                      onClick={() => {
                        bulkControlRef.current.cancelled = true;
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </p>
            )}
          </div>
        </div>
  );
};

export default BulkUploadTab;