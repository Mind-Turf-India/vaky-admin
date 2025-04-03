import { useState, useEffect, useRef } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, where, writeBatch, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebaseConfig";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const ManageQotd = () => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newQuote, setNewQuote] = useState({ 
    imageURL: "", 
    title: "", 
    date: new Date(),
    imageFile: null
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [editQuote, setEditQuote] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedQuotes, setSelectedQuotes] = useState([]);
  const [bulkEntries, setBulkEntries] = useState([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const fileInputRef = useRef(null);
  const bulkImageRef = useRef(null);

  // Function to format date as DD-MM-YYYY
  const formatDate = (date) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  };

  // Parse date from DD-MM-YYYY format
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const [day, month, year] = dateStr.split('-');
    return new Date(year, month - 1, day);
  };

  // Fetch QOTD Quotes (Sorted by Date)
  const fetchQuotes = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, "qotd"), orderBy("date", "desc"));

      // Apply date filter if selected
      if (startDate && endDate) {
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);
        q = query(
          collection(db, "qotd"),
          where("date", ">=", startDateStr),
          where("date", "<=", endDateStr),
          orderBy("date", "desc")
        );
      }

      const snapshot = await getDocs(q);
      const quoteList = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        dateObj: parseDate(doc.data().date) 
      }));
      setQuotes(quoteList);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      alert("Failed to load quotes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  // Apply date filters
  const applyFilters = () => {
    fetchQuotes();
  };

  // Reset filters
  const resetFilters = () => {
    setStartDate(null);
    setEndDate(null);
    fetchQuotes();
  };

  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview the selected image
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);

    setNewQuote({ ...newQuote, imageFile: file, imageURL: "" });
  };

  // Upload image to Firebase Storage
  const uploadImage = async (file) => {
    if (!file) return null;

    const storageRef = ref(storage, `qotd/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  // Add or Edit Quote
  const handleSave = async () => {
    try {
      setLoading(true);
      if (!newQuote.title || (!newQuote.imageURL && !newQuote.imageFile)) {
        alert("Please provide a title and either an image URL or upload an image.");
        setLoading(false);
        return;
      }

      let imageURL = newQuote.imageURL;
      if (newQuote.imageFile) {
        imageURL = await uploadImage(newQuote.imageFile);
      }

      const dateStr = formatDate(newQuote.date || new Date());
      const docId = editQuote ? editQuote.id : dateStr;

      // Check if a quote already exists for this date (when adding new)
      if (!editQuote) {
        const docRef = doc(db, "qotd", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const overwrite = window.confirm(`A quote already exists for ${dateStr}. Do you want to overwrite it?`);
          if (!overwrite) {
            setLoading(false);
            return;
          }
        }
      }

      await setDoc(doc(db, "qotd", docId), {
        imageURL: imageURL,
        title: newQuote.title,
        date: dateStr,
        updatedAt: new Date().toISOString()
      });

      // Reset form
      setNewQuote({ imageURL: "", title: "", date: new Date(), imageFile: null });
      setImagePreview(null);
      setEditQuote(null);
      fetchQuotes();
    } catch (error) {
      console.error("Error saving quote:", error);
      alert("Failed to save quote. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Delete Quote
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this quote?")) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, "qotd", id));
        fetchQuotes();
      } catch (error) {
        console.error("Error deleting quote:", error);
        alert("Failed to delete quote. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Bulk Delete
  const handleDeleteSelected = async () => {
    if (selectedQuotes.length === 0) {
      alert("No quotes selected!");
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedQuotes.length} selected quote(s)?`)) {
      try {
        setLoading(true);
        const batch = writeBatch(db);
        
        selectedQuotes.forEach(id => {
          batch.delete(doc(db, "qotd", id));
        });

        await batch.commit();
        setSelectedQuotes([]);
        fetchQuotes();
        alert("Selected quotes deleted successfully");
      } catch (error) {
        console.error("Error in bulk delete:", error);
        alert("Error deleting quotes: " + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Select/Deselect All
  const handleSelectAll = () => {
    if (selectedQuotes.length === quotes.length) {
      setSelectedQuotes([]);
    } else {
      setSelectedQuotes(quotes.map(quote => quote.id));
    }
  };

  // Toggle individual selection
  const handleSelectQuote = (id) => {
    if (selectedQuotes.includes(id)) {
      setSelectedQuotes(selectedQuotes.filter(quoteId => quoteId !== id));
    } else {
      setSelectedQuotes([...selectedQuotes, id]);
    }
  };

  // Add a new bulk entry
  const addBulkEntry = () => {
    const newEntry = {
      id: Date.now(),
      date: new Date(),
      title: "",
      imageFile: null,
      imagePreview: null
    };
    setBulkEntries([...bulkEntries, newEntry]);
  };

  // Update a bulk entry
  const updateBulkEntry = (id, field, value) => {
    const updatedEntries = bulkEntries.map(entry => {
      if (entry.id === id) {
        return { ...entry, [field]: value };
      }
      return entry;
    });
    setBulkEntries(updatedEntries);
  };

  // Handle image selection for a bulk entry
  const handleBulkImageChange = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview the selected image
    const reader = new FileReader();
    reader.onload = (e) => {
      const updatedEntries = bulkEntries.map(entry => {
        if (entry.id === id) {
          return { ...entry, imageFile: file, imagePreview: e.target.result };
        }
        return entry;
      });
      setBulkEntries(updatedEntries);
    };
    reader.readAsDataURL(file);
  };

  // Remove a bulk entry
  const removeBulkEntry = (id) => {
    setBulkEntries(bulkEntries.filter(entry => entry.id !== id));
  };

  // Save bulk uploaded quotes
  const handleBulkUpload = async () => {
    if (bulkEntries.length === 0) {
      alert("No entries to upload!");
      return;
    }

    // Validate all entries have required data
    const invalidEntries = bulkEntries.filter(entry => !entry.title || !entry.imageFile);
    if (invalidEntries.length > 0) {
      alert(`Please complete all required fields for all entries.`);
      return;
    }

    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      // Upload all images first
      for (let entry of bulkEntries) {
        const dateStr = formatDate(entry.date);
        
        // Upload image
        const imageURL = await uploadImage(entry.imageFile);
        
        // Add to batch
        batch.set(doc(db, "qotd", dateStr), {
          imageURL: imageURL,
          title: entry.title,
          date: dateStr,
          updatedAt: new Date().toISOString()
        });
      }

      await batch.commit();
      alert(`Successfully uploaded ${bulkEntries.length} quotes!`);
      setBulkEntries([]);
      setShowBulkUpload(false);
      fetchQuotes();
    } catch (error) {
      console.error("Error in bulk upload:", error);
      alert("Error uploading quotes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Set Edit mode
  const handleEdit = (quote) => {
    setEditQuote(quote);
    setNewQuote({
      imageURL: quote.imageURL,
      title: quote.title,
      date: quote.dateObj || new Date(),
      imageFile: null
    });
    setImagePreview(quote.imageURL);
  };

  // Reset form
  const handleReset = () => {
    setNewQuote({ imageURL: "", title: "", date: new Date(), imageFile: null });
    setImagePreview(null);
    setEditQuote(null);
  };

  return (
    <div className="manage-qotd-container">
      <h2>QOTD Manager</h2>

      {/* Search and Filter */}
      <div className="filter-container">
        <div className="date-filter">
          <label>Filter by Date Range: </label>
          <DatePicker
            selected={startDate}
            onChange={setStartDate}
            dateFormat="dd-MM-yyyy"
            placeholderText="Start Date"
            className="date-picker"
          />
          <DatePicker
            selected={endDate}
            onChange={setEndDate}
            dateFormat="dd-MM-yyyy"
            placeholderText="End Date"
            className="date-picker"
          />
          <button onClick={applyFilters} className="filter-btn">Apply Filter</button>
          <button onClick={resetFilters} className="reset-filter-btn">Reset</button>
        </div>

        <div className="bulk-actions">
          <button 
            onClick={handleDeleteSelected}
            disabled={selectedQuotes.length === 0}
            className="delete-selected-btn"
          >
            Delete Selected ({selectedQuotes.length})
          </button>
          <button 
            onClick={() => setShowBulkUpload(!showBulkUpload)}
            className="bulk-upload-btn"
          >
            {showBulkUpload ? 'Hide Bulk Upload' : 'Show Bulk Upload'}
          </button>
        </div>
      </div>

      {/* Bulk Upload Section */}
      {showBulkUpload && (
        <div className="bulk-upload-section">
          <h3>Bulk Upload Quotes</h3>
          <p>Add multiple quotes with images from your device</p>
          
          <div className="bulk-entries">
            {bulkEntries.map((entry, index) => (
              <div key={entry.id} className="bulk-entry">
                <h4>Entry #{index + 1}</h4>
                <div className="entry-form">
                  <div className="form-group">
                    <label>Date:</label>
                    <DatePicker
                      selected={entry.date}
                      onChange={(date) => updateBulkEntry(entry.id, 'date', date)}
                      dateFormat="dd-MM-yyyy"
                      className="date-picker"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Image:</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleBulkImageChange(entry.id, e)}
                    />
                    {entry.imagePreview && (
                      <div className="image-preview">
                        <img src={entry.imagePreview} alt="Preview" width="80" />
                      </div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Title:</label>
                    <input 
                      type="text" 
                      placeholder="Quote Title" 
                      value={entry.title} 
                      onChange={(e) => updateBulkEntry(entry.id, 'title', e.target.value)}
                      className="text-input"
                    />
                  </div>
                </div>
                <button onClick={() => removeBulkEntry(entry.id)} className="remove-entry-btn">
                  Remove Entry
                </button>
              </div>
            ))}
          </div>
          
          <div className="bulk-controls">
            <button onClick={addBulkEntry} className="add-entry-btn">
              Add Another Entry
            </button>
            
            {bulkEntries.length > 0 && (
              <button onClick={handleBulkUpload} className="confirm-upload-btn">
                Upload All Quotes ({bulkEntries.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Quote */}
      <div className="quote-form">
        <h3>{editQuote ? "Edit Quote" : "Add New Quote"}</h3>
        
        <div className="form-group">
          <label>Date:</label>
          <DatePicker
            selected={newQuote.date}
            onChange={(date) => setNewQuote({ ...newQuote, date })}
            dateFormat="dd-MM-yyyy"
            className="date-picker"
          />
        </div>
        
        <div className="form-group">
          <label>Image:</label>
          <div className="image-input-options">
            <div className="upload-option">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange}
                className="file-input"
              />
              <label>Upload from device</label>
            </div>
            <div className="url-option">
              <input 
                type="text" 
                placeholder="or enter Image URL" 
                value={newQuote.imageURL} 
                onChange={(e) => {
                  setNewQuote({ ...newQuote, imageURL: e.target.value, imageFile: null });
                  setImagePreview(e.target.value);
                }}
                className="text-input"
                disabled={!!newQuote.imageFile}
              />
            </div>
          </div>
          
          {imagePreview && (
            <div className="image-preview">
              <img 
                src={imagePreview} 
                alt="Preview" 
                width="150" 
                onError={(e) => {e.target.onerror = null; e.target.src='placeholder.png';}}
              />
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label>Title:</label>
          <input 
            type="text" 
            placeholder="Quote Title" 
            value={newQuote.title} 
            onChange={(e) => setNewQuote({ ...newQuote, title: e.target.value })}
            className="text-input"
          />
        </div>
        
        <div className="form-buttons">
          <button onClick={handleSave} className="save-btn" disabled={loading}>
            {editQuote ? "Update Quote" : "Add Quote"}
          </button>
          <button onClick={handleReset} className="reset-btn" disabled={loading}>
            Cancel
          </button>
        </div>
      </div>

      {/* Display Quotes Table */}
      <div className="quotes-table-container">
        {loading && <div className="loading">Loading quotes...</div>}
        
        <table className="quotes-table">
          <thead>
            <tr>
              <th>
                <input 
                  type="checkbox" 
                  checked={quotes.length > 0 && selectedQuotes.length === quotes.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Date</th>
              <th>Preview</th>
              <th>Title</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length > 0 ? (
              quotes.map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selectedQuotes.includes(quote.id)}
                      onChange={() => handleSelectQuote(quote.id)}
                    />
                  </td>
                  <td>{quote.date || quote.id}</td>
                  <td>
                    {quote.imageURL && (
                      <img 
                        src={quote.imageURL} 
                        alt="Quote" 
                        width="80" 
                        onError={(e) => {e.target.onerror = null; e.target.src='placeholder.png';}}
                      />
                    )}
                  </td>
                  <td>{quote.title}</td>
                  <td className="action-buttons">
                    <button onClick={() => handleEdit(quote)} className="edit-btn">Edit</button>
                    <button onClick={() => handleDelete(quote.id)} className="delete-btn">Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="no-data">
                  {loading ? "Loading..." : "No quotes found for the selected criteria"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add CSS styling */}
      <style jsx>{`
        .manage-qotd-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        h2 {
          margin-bottom: 20px;
          color: #333;
        }
        
        .filter-container {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 5px;
        }
        
        .date-filter {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .date-picker {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        button {
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        
        .filter-btn {
          background-color: #4CAF50;
          color: white;
        }
        
        .reset-filter-btn {
          background-color: #f0f0f0;
        }
        
        .bulk-actions {
          display: flex;
          gap: 10px;
        }
        
        .delete-selected-btn {
          background-color: #f44336;
          color: white;
        }
        
        .bulk-upload-btn {
          background-color: #2196F3;
          color: white;
        }
        
        .quote-form {
          margin-bottom: 30px;
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 5px;
          border: 1px solid #eee;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        
        .text-input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .form-buttons {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        
        .save-btn {
          background-color: #4CAF50;
          color: white;
        }
        
        .reset-btn {
          background-color: #f0f0f0;
        }
        
        .quotes-table-container {
          overflow-x: auto;
        }
        
        .quotes-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .quotes-table th, 
        .quotes-table td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }
        
        .quotes-table th {
          background-color: #f2f2f2;
        }
        
        .quotes-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        
        .quotes-table tr:hover {
          background-color: #f1f1f1;
        }
        
        .action-buttons {
          display: flex;
          gap: 5px;
        }
        
        .edit-btn {
          background-color: #2196F3;
          color: white;
        }
        
        .delete-btn {
          background-color: #f44336;
          color: white;
        }
        
        .image-preview {
          margin-top: 10px;
          border: 1px solid #ddd;
          padding: 5px;
          display: inline-block;
        }
        
        .no-data {
          text-align: center;
          padding: 20px;
          color: #666;
        }
        
        .bulk-upload-section {
          margin-bottom: 30px;
          padding: 20px;
          background-color: #f0f8ff;
          border-radius: 5px;
          border: 1px solid #cce0ff;
        }
        
        .bulk-entries {
          margin-top: 20px;
        }
        
        .bulk-entry {
          background-color: white;
          padding: 15px;
          margin-bottom: 15px;
          border-radius: 5px;
          border: 1px solid #ddd;
        }
        
        .remove-entry-btn {
          background-color: #f44336;
          color: white;
          margin-top: 10px;
        }
        
        .add-entry-btn {
          background-color: #673AB7;
          color: white;
        }
        
        .confirm-upload-btn {
          background-color: #4CAF50;
          color: white;
          margin-left: 10px;
        }
        
        .bulk-controls {
          margin-top: 20px;
          display: flex;
          gap: 10px;
        }
        
        .image-input-options {
          display: flex;
          gap: 15px;
          margin-bottom: 10px;
        }
        
        .loading {
          text-align: center;
          padding: 20px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default ManageQotd;