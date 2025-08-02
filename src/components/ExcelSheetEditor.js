// src/components/ExcelSheetEditor.js
import React, { useState } from "react";

const ExcelSheetEditor = ({ sheetKey, rows, onSave }) => {
  const [localRows, setLocalRows] = useState(rows);

  const handleChange = (index, key, value) => {
    const updated = [...localRows];
    updated[index][key] = value;
    setLocalRows(updated);
  };

  return (
    <div>
      <table className="editable-table">
        <thead>
          <tr>
            <th>Sl No</th>
            <th>Parameter</th>
            <th>Status</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          {localRows.map((row, i) => (
            <tr key={i}>
              <td>
                <input
                  value={row.slNo}
                  onChange={(e) => handleChange(i, "slNo", e.target.value)}
                />
              </td>
              <td>
                <input
                  value={row.parameter}
                  onChange={(e) => handleChange(i, "parameter", e.target.value)}
                />
              </td>
              <td>
                <input
                  value={row.status}
                  onChange={(e) => handleChange(i, "status", e.target.value)}
                />
              </td>
              <td>
                <input
                  value={row.remark}
                  onChange={(e) => handleChange(i, "remark", e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => onSave(localRows)} className="save-btn">
        💾 Save
      </button>
    </div>
  );
};

export default ExcelSheetEditor;
