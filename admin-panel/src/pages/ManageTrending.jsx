import { useState, useEffect } from "react";
import { db, storage } from "../firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const ManageTrending = () => {
  const [quotes, setQuotes] = useState([]);
  const [bulkQuotes, setBulkQuotes] = useState([]); // Bulk quotes array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTrendingQuotes();
  }, []);

  // Fetch existing trending quotes
  const fetchTrendingQuotes = async () => {
    try {
      setLoading(true);
      setError("");
      const querySnapshot = await getDocs(collection(db, "templates"));
      const quotesList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setQuotes(quotesList);
    } catch (err) {
      console.error("Error fetching quotes:", err);
      setError("Failed to load quotes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle image upload
  const uploadImage = async (file) => {
    const storageRef = ref(storage, `trendingQuotes/${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  // Extract filename without extension
  const getFileNameWithoutExtension = (fileName) => {
    return fileName.split('.').slice(0, -1).join('.');
  };

  // Handle Bulk Upload
  const handleBulkUpload = async () => {
    try {
      setLoading(true);
      setError("");
      for (const quote of bulkQuotes) {
        const imageURL = await uploadImage(quote.image);
        await addDoc(collection(db, "templates"), {
          title: quote.title,
          category: quote.category,
          isPaid: quote.isPaid,
          imageUrl: imageURL,
          createdAt: serverTimestamp(),
        });
      }
      alert("Bulk quotes added successfully!");
      setBulkQuotes([]);
      await fetchTrendingQuotes();
    } catch (error) {
      console.error("Error in bulk upload:", error);
      setError("Upload failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Editing isPaid Status & Title
//   const handleEditQuote = async (id, field, value) => {
//     try {
//       setLoading(true);
//       setError("");
//       const quoteRef = doc(db, "templates", id);
//       await updateDoc(quoteRef, { [field]: value });
//       setQuotes(
//         quotes.map((q) => (q.id === id ? { ...q, [field]: value } : q))
//       );
//       alert("Quote updated successfully!");
//     } catch (error) {
//       console.error("Error updating quote:", error);
//       setError("Update failed: " + error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

  // Handle Save All Changes at once
  const handleSaveQuote = async (id, updatedData) => {
    try {
      setLoading(true);
      setError("");
      const quoteRef = doc(db, "templates", id);
      await updateDoc(quoteRef, updatedData);
      setQuotes(
        quotes.map((q) => (q.id === id ? { ...q, ...updatedData } : q))
      );
      alert("Quote updated successfully!");
    } catch (error) {
      console.error("Error updating quote:", error);
      setError("Update failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Quote
  const handleDeleteQuote = async (id, imageUrl) => {
    if (!window.confirm("Are you sure you want to delete this quote?")) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      // Delete the document from Firestore
      const quoteRef = doc(db, "templates", id);
      await deleteDoc(quoteRef);
      
      // Try to delete the image from Storage if it exists
      if (imageUrl) {
        try {
          // Extract the path from the URL
          const imagePath = imageUrl.split('.com/o/')[1]?.split('?')[0];
          if (imagePath) {
            // URL decode the path
            const decodedPath = decodeURIComponent(imagePath);
            const imageRef = ref(storage, decodedPath);
            await deleteObject(imageRef);
          }
        } catch (imgErr) {
          console.error("Error deleting image (continuing anyway):", imgErr);
        }
      }
      
      // Update UI by removing the deleted quote
      setQuotes(quotes.filter(q => q.id !== id));
      alert("Quote deleted successfully!");
      
    } catch (error) {
      console.error("Error deleting quote:", error);
      setError("Delete failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Create image preview URL
  const createPreviewURL = (file) => {
    return URL.createObjectURL(file);
  };

  return (
    <div>
      <h2>Trending Quotes Manager</h2>
      
      {error && <div style={{ color: "red", margin: "10px 0" }}>{error}</div>}

      {/* Bulk Upload */}
      <h3>Bulk Upload Quotes</h3>
      <input
        type="file"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files);
          const bulkData = files.map((file) => ({
            id: Math.random().toString(36).substr(2, 9),
            title: getFileNameWithoutExtension(file.name), // Set default title as filename
            category: "Default",
            isPaid: false,
            image: file,
            previewUrl: createPreviewURL(file) // Create preview URL
          }));
          setBulkQuotes(bulkData);
        }}
        disabled={loading}
      />

      {bulkQuotes.length > 0 && (
        <div>
          <h4>Set Titles & Payment Status</h4>
          {bulkQuotes.map((quote, index) => (
            <div key={quote.id} style={{ marginBottom: "15px", padding: "10px", border: "1px solid #ddd", display: "flex", alignItems: "center" }}>
              <div style={{ flex: "1" }}>
                <div style={{ marginBottom: "5px" }}>
                  <label style={{ display: "block", marginBottom: "3px" }}>Title:</label>
                  <input
                    type="text"
                    placeholder="Enter title"
                    value={quote.title}
                    onChange={(e) =>
                      setBulkQuotes(
                        bulkQuotes.map((q, i) =>
                          i === index ? { ...q, title: e.target.value } : q
                        )
                      )
                    }
                    disabled={loading}
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ marginBottom: "5px" }}>
                  <label style={{ display: "block", marginBottom: "3px" }}>Category:</label>
                  <input
                    type="text"
                    placeholder="Enter category"
                    value={quote.category}
                    onChange={(e) =>
                      setBulkQuotes(
                        bulkQuotes.map((q, i) =>
                          i === index ? { ...q, category: e.target.value } : q
                        )
                      )
                    }
                    disabled={loading}
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={quote.isPaid}
                      onChange={(e) =>
                        setBulkQuotes(
                          bulkQuotes.map((q, i) =>
                            i === index ? { ...q, isPaid: e.target.checked } : q
                          )
                        )
                      }
                      disabled={loading}
                    />
                    Paid
                  </label>
                </div>
              </div>
              <div style={{ marginLeft: "15px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                {/* Image Preview */}
                <div style={{ width: "80px", height: "80px", marginBottom: "5px", border: "1px solid #ccc", overflow: "hidden" }}>
                  <img 
                    src={quote.previewUrl} 
                    alt="Preview" 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                  />
                </div>
                <button 
                  onClick={() => {
                    // Revoke preview URL to prevent memory leaks
                    URL.revokeObjectURL(quote.previewUrl);
                    setBulkQuotes(bulkQuotes.filter((q, i) => i !== index));
                  }}
                  disabled={loading}
                  style={{ width: "80px" }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button 
            onClick={handleBulkUpload}
            disabled={loading || bulkQuotes.some(q => !q.title)}
            style={{ marginTop: "10px", padding: "8px 16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            {loading ? "Uploading..." : "Upload All Quotes"}
          </button>
        </div>
      )}

      {/* Display Quotes */}
      <h3>Existing Trending Quotes</h3>
      {loading && !bulkQuotes.length ? <p>Loading quotes...</p> : (
        <table border="1" style={{ borderCollapse: "collapse", width: "100%", marginTop: "20px" }}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Image</th>
              <th>Paid</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id}>
                <td>
                  <input
                    type="text"
                    value={quote.title || ""}
                    onChange={(e) => 
                      setQuotes(
                        quotes.map((q) =>
                          q.id === quote.id ? { ...q, title: e.target.value } : q
                        )
                      )
                    }
                    disabled={loading}
                    style={{ width: "100%" }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={quote.category || ""}
                    onChange={(e) => 
                      setQuotes(
                        quotes.map((q) =>
                          q.id === quote.id ? { ...q, category: e.target.value } : q
                        )
                      )
                    }
                    disabled={loading}
                    style={{ width: "100%" }}
                  />
                </td>
                <td>
                  {quote.imageUrl ? (
                    <img src={quote.imageUrl} alt="quote" width="50" height="50" style={{ objectFit: "cover" }} />
                  ) : (
                    "No image"
                  )}
                </td>
                <td>
                  <select
                    value={quote.isPaid}
                    onChange={(e) =>
                      setQuotes(
                        quotes.map((q) =>
                          q.id === quote.id ? { ...q, isPaid: e.target.value === "true" } : q
                        )
                      )
                    }
                    disabled={loading}
                  >
                    <option value="false">Unpaid</option>
                    <option value="true">Paid</option>
                  </select>
                </td>
                <td>
                  {quote.createdAt ? 
                    quote.createdAt.toDate().toLocaleString("en-US", {
                      timeZone: "Asia/Kolkata",
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "numeric",
                      second: "numeric",
                    }) : "N/A"
                  }
                </td>
                <td>
                  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                    <button 
                      onClick={() => handleSaveQuote(quote.id, {
                        title: quote.title,
                        category: quote.category,
                        isPaid: quote.isPaid === "true" || quote.isPaid === true
                      })}
                      disabled={loading}
                      style={{ backgroundColor: "#4CAF50", color: "white" }}
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => handleDeleteQuote(quote.id, quote.imageUrl)}
                      disabled={loading}
                      style={{ backgroundColor: "#ff6666", color: "white" }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      {quotes.length === 0 && !loading && (
        <p>No quotes found. Upload some quotes to get started.</p>
      )}
    </div>
  );
};

export default ManageTrending;