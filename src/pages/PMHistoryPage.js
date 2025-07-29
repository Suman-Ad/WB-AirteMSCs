import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

const PMHistoryPage = ({ userData }) => {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUploads = async () => {
      setLoading(true);
      try {
        const uploadsRef = collection(db, "pmUploads");

        let q;
        if (userData.role === "Admin" || userData.role === "Super Admin") {
          q = query(uploadsRef, orderBy("createdAt", "desc"));
        } else {
          q = query(
            uploadsRef,
            where("site", "==", userData.site),
            orderBy("createdAt", "desc")
          );
        }

        const querySnapshot = await getDocs(q);
        const result = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setUploads(result);
      } catch (error) {
        console.error("Error fetching uploads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUploads();
  }, [userData]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Uploaded PM History</h2>

      {loading ? (
        <p>Loading...</p>
      ) : uploads.length === 0 ? (
        <p>No uploads found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>File Name</th>
              <th>PM Type</th>
              <th>Site</th>
              <th>Uploaded By</th>
              <th>Date</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((upload) => (
              <tr key={upload.id} style={{ borderBottom: "1px solid #ccc" }}>
                <td>{upload.fileName}</td>
                <td>{upload.pmType}</td>
                <td>{upload.site}</td>
                <td>{upload.uploaderName} ({upload.uploaderRole})</td>
                <td>{upload.createdAt?.toDate().toLocaleString()}</td>
                <td>
                  <a href={upload.fileUrl} target="_blank" rel="noreferrer">
                    Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PMHistoryPage;
