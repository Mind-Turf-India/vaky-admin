import { useState, useEffect } from "react";
import { db, storage } from "../firebaseConfig";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  Timestamp,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { uploadImage } from "../firebaseStorage";

const ManageFestivals = () => {
  const [festivals, setFestivals] = useState([]);
  const [filteredFestivals, setFilteredFestivals] = useState([]);
  const [name, setName] = useState("");
  const [festivalDate, setFestivalDate] = useState("");
  const [showDaysBefore, setShowDaysBefore] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFestivals, setSelectedFestivals] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  
  // For template editing
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingFestivalId, setEditingFestivalId] = useState(null);
  const [templateFile, setTemplateFile] = useState(null);
  const [isPaidTemplate, setIsPaidTemplate] = useState(false);

  useEffect(() => {
    fetchFestivals();
  }, []);

  useEffect(() => {
    // Filter festivals based on search term
    if (searchTerm.trim() === "") {
      setFilteredFestivals(festivals);
    } else {
      const filtered = festivals.filter(festival => 
        festival.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredFestivals(filtered);
    }
  }, [searchTerm, festivals]);

  const fetchFestivals = async () => {
    try {
      setLoading(true);
      setError("");
      const querySnapshot = await getDocs(collection(db, "festivals"));
      const festivalList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFestivals(festivalList);
      setFilteredFestivals(festivalList);
    } catch (err) {
      console.error("Error fetching festivals:", err);
      setError("Failed to load festivals. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFiles([...e.target.files]);
  };

  const handleTemplateFileChange = (e) => {
    setTemplateFile(e.target.files[0]);
  };

  const handleAddFestival = async () => {
    if (!name || !festivalDate) {
      setError("Festival name and date are required");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      const uploadedImages = await Promise.all(
        selectedFiles.map(async (file) => ({
          id: `template_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          imageURL: await uploadImage(file),
          isPaid: false,
          name: file.name.split('.')[0] // Store the original filename without extension
        }))
      );

      const festivalData = {
        name,
        festivalDate: Timestamp.fromDate(new Date(festivalDate)),
        showDaysBefore,
        createdAt: Timestamp.now(),
        templates: uploadedImages,
      };

      if (editingId) {
        // If editing, keep existing templates
        const existingFestival = festivals.find(f => f.id === editingId);
        if (existingFestival && existingFestival.templates) {
          festivalData.templates = [...existingFestival.templates, ...uploadedImages];
        }
        
        await updateDoc(doc(db, "festivals", editingId), festivalData);
      } else {
        await addDoc(collection(db, "festivals"), festivalData);
      }

      setName("");
      setFestivalDate("");
      setShowDaysBefore(1);
      setSelectedFiles([]);
      setEditingId(null);
      await fetchFestivals();
      
    } catch (error) {
      console.error("Error adding festival:", error);
      setError("Failed to add/update festival: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditFestival = (festival) => {
    setEditingId(festival.id);
    setName(festival.name);
    setFestivalDate(festival.festivalDate.toDate().toISOString().split("T")[0]);
    setShowDaysBefore(festival.showDaysBefore);
  };

  const handleDeleteFestival = async (festival) => {
    if (!window.confirm(`Are you sure you want to delete "${festival.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      // First, delete all template images from storage
      if (festival.templates && festival.templates.length > 0) {
        for (const template of festival.templates) {
          try {
            if (template.imageURL) {
              // Extract the path from the URL
              const imagePath = template.imageURL.split('.com/o/')[1]?.split('?')[0];
              if (imagePath) {
                // URL decode the path
                const decodedPath = decodeURIComponent(imagePath);
                const imageRef = ref(storage, decodedPath);
                await deleteObject(imageRef);
              }
            }
          } catch (imgErr) {
            console.error(`Error deleting template image (continuing anyway):`, imgErr);
          }
        }
      }
      
      // Delete the festival document from Firestore
      await deleteDoc(doc(db, "festivals", festival.id));
      
      // Update UI by removing the deleted festival
      setFestivals(festivals.filter(f => f.id !== festival.id));
      setFilteredFestivals(filteredFestivals.filter(f => f.id !== festival.id));
      
      if (editingId === festival.id) {
        // Reset form if the deleted festival was being edited
        setEditingId(null);
        setName("");
        setFestivalDate("");
        setShowDaysBefore(1);
      }
      
    } catch (error) {
      console.error("Error deleting festival:", error);
      setError("Failed to delete festival: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (festivalId, templateId, imageURL) => {
    if (!window.confirm("Are you sure you want to delete this template?")) {
      return;
    }
  
    try {
      setLoading(true);
      setError("");
      
      // Find the festival
      const festival = festivals.find(f => f.id === festivalId);
      if (!festival) {
        throw new Error("Festival not found");
      }
      
      // Important fix: Make a deep copy of the templates array
      const currentTemplates = [...festival.templates];
      
      // Filter out the template to delete
      const updatedTemplates = currentTemplates.filter(t => t.id !== templateId);
      
      console.log("Current templates count:", currentTemplates.length);
      console.log("Updated templates count:", updatedTemplates.length);
      
      // Update the festival document
      await updateDoc(doc(db, "festivals", festivalId), {
        templates: updatedTemplates
      });
      
      // Try to delete the image from Storage
      try {
        if (imageURL) {
          const imagePath = imageURL.split('.com/o/')[1]?.split('?')[0];
          if (imagePath) {
            const decodedPath = decodeURIComponent(imagePath);
            const imageRef = ref(storage, decodedPath);
            await deleteObject(imageRef);
          }
        }
      } catch (imgErr) {
        console.error("Error deleting template image:", imgErr);
      }
      
      // Update UI - create a new festivals array with the updated festival
      const updatedFestivals = festivals.map(f => 
        f.id === festivalId 
          ? { ...f, templates: updatedTemplates } 
          : f
      );
      
      setFestivals(updatedFestivals);
      setFilteredFestivals(
        filteredFestivals.map(f => 
          f.id === festivalId 
            ? { ...f, templates: updatedTemplates } 
            : f
        )
      );
      
      alert("Template deleted successfully");
      
    } catch (error) {
      console.error("Error deleting template:", error);
      setError("Failed to delete template: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (festivalId, templateId) => {
    const festival = festivals.find(f => f.id === festivalId);
    const template = festival?.templates.find(t => t.id === templateId);
    
    if (template) {
      setIsPaidTemplate(template.isPaid || false);
      setTemplateTitle(template.name || ""); // Set the current template title
      setEditingFestivalId(festivalId);
      setEditingTemplateId(templateId);
      setTemplateFile(null);
    }
  };

  const handleUpdateTemplate = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Find the festival and template
      const festival = festivals.find(f => f.id === editingFestivalId);
      if (!festival) {
        throw new Error("Festival not found");
      }
      
      // Important fix: Make a deep copy of the templates array
      const currentTemplates = [...festival.templates];
      
      const template = currentTemplates.find(t => t.id === editingTemplateId);
      if (!template) {
        throw new Error("Template not found");
      }
      
      let newImageURL = template.imageURL;
      
      // If a new file was selected, upload it
      if (templateFile) {
        // Upload new image
        newImageURL = await uploadImage(templateFile);
        
        // Delete old image
        try {
          if (template.imageURL) {
            const imagePath = template.imageURL.split('.com/o/')[1]?.split('?')[0];
            if (imagePath) {
              const decodedPath = decodeURIComponent(imagePath);
              const imageRef = ref(storage, decodedPath);
              await deleteObject(imageRef);
            }
          }
        } catch (imgErr) {
          console.error("Error deleting old template image:", imgErr);
        }
      }
      
      // Update only the specific template
      const updatedTemplates = currentTemplates.map(t => 
        t.id === editingTemplateId 
          ? { 
              ...t, 
              imageURL: newImageURL, 
              isPaid: isPaidTemplate,
              // Use the edited title or fall back to file name or original name
              name: templateTitle.trim() !== "" 
                ? templateTitle.trim() 
                : (templateFile ? templateFile.name.split('.')[0] : t.name)
            }
          : t
      );
      
      // Update the festival document
      await updateDoc(doc(db, "festivals", editingFestivalId), {
        templates: updatedTemplates
      });
      
      // Update UI - create a new festivals array with the updated festival
      const updatedFestivals = festivals.map(f => 
        f.id === editingFestivalId 
          ? { ...f, templates: updatedTemplates } 
          : f
      );
      
      setFestivals(updatedFestivals);
      setFilteredFestivals(
        filteredFestivals.map(f => 
          f.id === editingFestivalId 
            ? { ...f, templates: updatedTemplates } 
            : f
        )
      );
      
      // Reset template editing state
      setEditingFestivalId(null);
      setEditingTemplateId(null);
      setTemplateFile(null);
      setIsPaidTemplate(false);
      setTemplateTitle(""); // Reset the template title
      
      alert("Template updated successfully");
      
    } catch (error) {
      console.error("Error updating template:", error);
      setError("Failed to update template: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelTemplateEdit = () => {
    setEditingFestivalId(null);
    setEditingTemplateId(null);
    setTemplateFile(null);
    setIsPaidTemplate(false);
    setTemplateTitle(""); // Reset the template title
  };

  const toggleFestivalSelection = (festivalId) => {
    if (selectedFestivals.includes(festivalId)) {
      setSelectedFestivals(selectedFestivals.filter(id => id !== festivalId));
    } else {
      setSelectedFestivals([...selectedFestivals, festivalId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedFestivals([]);
    } else {
      setSelectedFestivals(filteredFestivals.map(festival => festival.id));
    }
    setSelectAll(!selectAll);
  };

  const handleDeleteSelectedFestivals = async () => {
    if (selectedFestivals.length === 0) {
      return alert("No festivals selected for deletion");
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedFestivals.length} selected festivals?`)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Process each festival for deletion
      for (const festivalId of selectedFestivals) {
        const festival = festivals.find(f => f.id === festivalId);
        
        if (festival) {
          // First, delete all template images from storage
          if (festival.templates && festival.templates.length > 0) {
            for (const template of festival.templates) {
              try {
                if (template.imageURL) {
                  const imagePath = template.imageURL.split('.com/o/')[1]?.split('?')[0];
                  if (imagePath) {
                    const decodedPath = decodeURIComponent(imagePath);
                    const imageRef = ref(storage, decodedPath);
                    await deleteObject(imageRef);
                  }
                }
              } catch (imgErr) {
                console.error(`Error deleting template image (continuing anyway):`, imgErr);
              }
            }
          }
          
          // Delete the festival document from Firestore
          await deleteDoc(doc(db, "festivals", festivalId));
        }
      }

      // Update UI
      const remainingFestivals = festivals.filter(f => !selectedFestivals.includes(f.id));
      setFestivals(remainingFestivals);
      setFilteredFestivals(remainingFestivals);
      
      // Reset selection state
      setSelectedFestivals([]);
      setSelectAll(false);
      
      // Reset editing state if needed
      if (selectedFestivals.includes(editingId)) {
        setEditingId(null);
        setName("");
        setFestivalDate("");
        setShowDaysBefore(1);
      }
      
      alert(`${selectedFestivals.length} festivals deleted successfully`);
    } catch (error) {
      console.error("Error deleting selected festivals:", error);
      setError("Failed to delete all selected festivals: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTemplatePaidStatus = async (festivalId, templateId, currentStatus) => {
    try {
      setLoading(true);
      setError("");
      
      // Find the festival
      const festival = festivals.find(f => f.id === festivalId);
      if (!festival) {
        throw new Error("Festival not found");
      }
      
      // Important fix: Make a deep copy of the templates array
      const currentTemplates = [...festival.templates];
      
      // Update the isPaid status for only the specific template
      const updatedTemplates = currentTemplates.map(t => 
        t.id === templateId 
          ? { ...t, isPaid: !currentStatus } 
          : t
      );
      
      // Update the festival document
      await updateDoc(doc(db, "festivals", festivalId), {
        templates: updatedTemplates
      });
      
      // Update UI - create a new festivals array with the updated festival
      const updatedFestivals = festivals.map(f => 
        f.id === festivalId 
          ? { ...f, templates: updatedTemplates } 
          : f
      );
      
      setFestivals(updatedFestivals);
      setFilteredFestivals(
        filteredFestivals.map(f => 
          f.id === festivalId 
            ? { ...f, templates: updatedTemplates } 
            : f
        )
      );
      
    } catch (error) {
      console.error("Error updating template paid status:", error);
      setError("Failed to update template status: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Festivals Manager</h2>
      
      {error && <div style={{ color: "red", margin: "10px 0" }}>{error}</div>}
      
      {/* Search Bar */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Search festivals by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            padding: "8px", 
            width: "100%", 
            borderRadius: "4px",
            border: "1px solid #ddd"
          }}
        />
      </div>
      
      {/* Template Edit Modal */}
      {editingTemplateId && (
  <div style={{ 
    border: "1px solid #ccc", 
    padding: "15px", 
    margin: "10px 0", 
    backgroundColor: "#f9f9f9",
    borderRadius: "5px" 
  }}>
    <h3>Update Template</h3>
    <div style={{ marginBottom: "10px" }}>
      <label style={{ display: "block", marginBottom: "5px" }}>Template Title:</label>
      <input
        type="text"
        placeholder="Template Title"
        value={templateTitle}
        onChange={(e) => setTemplateTitle(e.target.value)}
        disabled={loading}
        style={{ padding: "5px", width: "100%" }}
      />
    </div>
          
          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Template Type:</label>
            <select
              value={isPaidTemplate ? "paid" : "free"}
              onChange={(e) => setIsPaidTemplate(e.target.value === "paid")}
              disabled={loading}
              style={{ padding: "5px", width: "100%" }}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          
          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Replace Image (Optional):</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleTemplateFileChange} 
              disabled={loading}
            />
            <small style={{ display: "block", marginTop: "5px", color: "#666" }}>
              Leave empty to keep the current image
            </small>
          </div>
          
          <div style={{ marginTop: "10px" }}>
            <button 
              onClick={handleUpdateTemplate} 
              disabled={loading}
              style={{ 
                backgroundColor: "#4CAF50", 
                color: "white", 
                marginRight: "10px",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Updating..." : "Update Template"}
            </button>
            <button 
              onClick={cancelTemplateEdit}
              disabled={loading}
              style={{ 
                padding: "8px 16px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer" 
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Festival Add/Edit Form */}
      <div style={{ 
        border: "1px solid #ddd", 
        padding: "15px", 
        marginBottom: "20px",
        borderRadius: "5px"
      }}>
        <h3>{editingId ? "Edit Festival" : "Add New Festival"}</h3>
        
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>Festival Name:</label>
          <input
            type="text"
            placeholder="Festival Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            style={{ padding: "5px", width: "100%" }}
          />
        </div>
        
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>Festival Date:</label>
          <input
            type="date"
            value={festivalDate}
            onChange={(e) => setFestivalDate(e.target.value)}
            disabled={loading}
            style={{ padding: "5px", width: "100%" }}
          />
        </div>
        
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>Show Days Before:</label>
          <input
            type="number"
            placeholder="Show Days Before"
            value={showDaysBefore}
            onChange={(e) => setShowDaysBefore(Number(e.target.value))}
            disabled={loading}
            style={{ padding: "5px", width: "100%" }}
          />
        </div>
        
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>Festival Templates:</label>
          <input 
            type="file" 
            multiple 
            onChange={handleFileChange} 
            disabled={loading}
          />
          <small style={{ display: "block", marginTop: "5px", color: "#666" }}>
            {editingId ? "New templates will be added to existing ones" : "Select multiple template images"}
          </small>
        </div>
        
        <button 
          onClick={handleAddFestival} 
          disabled={loading}
          style={{ 
            padding: "8px 16px", 
            backgroundColor: "#4CAF50", 
            color: "white", 
            border: "none", 
            borderRadius: "4px", 
            cursor: loading ? "not-allowed" : "pointer" 
          }}
        >
          {loading ? "Processing..." : editingId ? "Update Festival" : "Add Festival"}
        </button>
        
        {editingId && (
          <button 
            onClick={() => {
              setEditingId(null);
              setName("");
              setFestivalDate("");
              setShowDaysBefore(1);
              setSelectedFiles([]);
            }}
            disabled={loading}
            style={{ 
              padding: "8px 16px", 
              marginLeft: "10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer" 
            }}
          >
            Cancel Editing
          </button>
        )}
      </div>

      {/* Bulk Actions for Festivals */}
      <div style={{ marginBottom: "15px", display: "flex", justifyContent: "space-between" }}>
        <div>
          <button
            onClick={toggleSelectAll}
            style={{ 
              marginRight: "10px", 
              padding: "5px 10px",
              backgroundColor: selectAll ? "#5b9bd5" : "#f0f0f0",
              border: "1px solid #ddd",
              borderRadius: "3px",
              cursor: "pointer"
            }}
          >
            {selectAll ? "Deselect All" : "Select All"}
          </button>
          <button
            onClick={handleDeleteSelectedFestivals}
            disabled={selectedFestivals.length === 0 || loading}
            style={{ 
              padding: "5px 10px",
              backgroundColor: selectedFestivals.length === 0 ? "#f0f0f0" : "#ff6666",
              color: selectedFestivals.length === 0 ? "#888" : "white",
              border: "1px solid #ddd",
              borderRadius: "3px",
              cursor: selectedFestivals.length === 0 || loading ? "not-allowed" : "pointer"
            }}
          >
            Delete Selected ({selectedFestivals.length})
          </button>
        </div>
        <div>
          {loading && <span style={{ color: "#888" }}>Processing...</span>}
        </div>
      </div>

      {/* Festivals Table */}
      {loading && !editingTemplateId ? <p>Loading festivals...</p> : (
        <table border="1" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: "40px" }}>Select</th>
              <th>Name</th>
              <th>Festival Date</th>
              <th>Show Days Before</th>
              <th>Templates</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFestivals.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                  {searchTerm ? "No festivals match your search" : "No festivals found. Add a festival to get started."}
                </td>
              </tr>
            ) : (
              filteredFestivals.map((festival) => (
                <tr key={festival.id} style={{ 
                  backgroundColor: selectedFestivals.includes(festival.id) ? "#f0f8ff" : "white" 
                }}>
                  <td style={{ textAlign: "center" }}>
                    <input 
                      type="checkbox" 
                      checked={selectedFestivals.includes(festival.id)}
                      onChange={() => toggleFestivalSelection(festival.id)}
                    />
                  </td>
                  <td>{festival.name}</td>
                  <td>{festival.festivalDate.toDate().toLocaleDateString("en-IN")}</td>
                  <td>{festival.showDaysBefore}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {festival.templates && festival.templates.map((template) => (
                        <div key={template.id} style={{ 
                          position: "relative", 
                          border: "1px solid #ddd", 
                          padding: "5px",
                          borderRadius: "4px",
                          backgroundColor: template.isPaid ? "#f8f8ff" : "#fff",
                          borderColor: template.isPaid ? "#5b9bd5" : "#ddd"
                        }}>
                          <div style={{ 
                            position: "absolute", 
                            top: "5px", 
                            right: "5px", 
                            backgroundColor: template.isPaid ? "#5b9bd5" : "#aaa",
                            color: "white",
                            fontSize: "10px",
                            padding: "2px 5px",
                            borderRadius: "10px"
                          }}>
                            {template.isPaid ? "PAID" : "FREE"}
                          </div>
                          <img 
                            src={template.imageURL} 
                            alt={template.name || "template"} 
                            width="80" 
                            height="80"
                            style={{ objectFit: "cover" }}
                          />
                          <div style={{ marginTop: "5px", fontSize: "12px", textAlign: "center" }}>
                            {template.name || "Unnamed"}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
                            <button 
                              onClick={() => toggleTemplatePaidStatus(festival.id, template.id, template.isPaid)}
                              style={{ 
                                fontSize: "12px", 
                                padding: "2px 5px",
                                backgroundColor: template.isPaid ? "#e1e1ff" : "#e8e8e8",
                                border: "1px solid #ddd",
                                borderRadius: "3px"
                              }}
                              disabled={loading}
                            >
                              {template.isPaid ? "→ Free" : "→ Paid"}
                            </button>
                            <button 
                              onClick={() => handleEditTemplate(festival.id, template.id)}
                              style={{ 
                                fontSize: "12px", 
                                padding: "2px 5px",
                                backgroundColor: "#5b9bd5",
                                color: "white",
                                border: "none",
                                borderRadius: "3px"
                              }}
                              disabled={loading}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteTemplate(festival.id, template.id, template.imageURL)}
                              style={{ 
                                fontSize: "12px", 
                                padding: "2px 5px", 
                                backgroundColor: "#ff6666", 
                                color: "white",
                                border: "none",
                                borderRadius: "3px"
                              }}
                              disabled={loading}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "5px" }}>
                      <button 
                        onClick={() => handleEditFestival(festival)}
                        disabled={loading}
                        style={{ 
                          padding: "5px 10px",
                          backgroundColor: "#5b9bd5",
                          color: "white",
                          border: "none",
                          borderRadius: "3px"
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteFestival(festival)}
                        disabled={loading}
                        style={{ 
                          padding: "5px 10px",
                          backgroundColor: "#ff6666", 
                          color: "white",
                          border: "none",
                          borderRadius: "3px"
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ManageFestivals;