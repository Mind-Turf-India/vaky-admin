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
  const [name, setName] = useState("");
  const [festivalDate, setFestivalDate] = useState("");
  const [showDaysBefore, setShowDaysBefore] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // For template editing
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingFestivalId, setEditingFestivalId] = useState(null);
  const [templateFile, setTemplateFile] = useState(null);

  useEffect(() => {
    fetchFestivals();
  }, []);

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
      
      // Filter out the template to delete
      const updatedTemplates = festival.templates.filter(t => t.id !== templateId);
      
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
      
      // Update UI
      setFestivals(
        festivals.map(f => 
          f.id === festivalId 
            ? { ...f, templates: updatedTemplates } 
            : f
        )
      );
      
    } catch (error) {
      console.error("Error deleting template:", error);
      setError("Failed to delete template: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (festivalId, templateId) => {
    setEditingFestivalId(festivalId);
    setEditingTemplateId(templateId);
    setTemplateFile(null);
  };

  const handleUpdateTemplate = async () => {
    if (!templateFile) {
      setError("Please select a new image file");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      // Upload new image
      const newImageURL = await uploadImage(templateFile);
      
      // Find the festival and template
      const festival = festivals.find(f => f.id === editingFestivalId);
      if (!festival) {
        throw new Error("Festival not found");
      }
      
      const template = festival.templates.find(t => t.id === editingTemplateId);
      if (!template) {
        throw new Error("Template not found");
      }
      
      // Store the old image URL for deletion
      const oldImageURL = template.imageURL;
      
      // Update the template with new image URL
      const updatedTemplates = festival.templates.map(t => 
        t.id === editingTemplateId 
          ? { ...t, imageURL: newImageURL, name: templateFile.name.split('.')[0] }
          : t
      );
      
      // Update the festival document
      await updateDoc(doc(db, "festivals", editingFestivalId), {
        templates: updatedTemplates
      });
      
      // Try to delete the old image from Storage
      try {
        if (oldImageURL) {
          const imagePath = oldImageURL.split('.com/o/')[1]?.split('?')[0];
          if (imagePath) {
            const decodedPath = decodeURIComponent(imagePath);
            const imageRef = ref(storage, decodedPath);
            await deleteObject(imageRef);
          }
        }
      } catch (imgErr) {
        console.error("Error deleting old template image:", imgErr);
      }
      
      // Update UI
      setFestivals(
        festivals.map(f => 
          f.id === editingFestivalId 
            ? { ...f, templates: updatedTemplates } 
            : f
        )
      );
      
      // Reset template editing state
      setEditingFestivalId(null);
      setEditingTemplateId(null);
      setTemplateFile(null);
      
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
  };

  return (
    <div>
      <h2>Festivals Manager</h2>
      
      {error && <div style={{ color: "red", margin: "10px 0" }}>{error}</div>}
      
      {/* Festival Edit Modal */}
      {editingTemplateId && (
        <div style={{ 
          border: "1px solid #ccc", 
          padding: "15px", 
          margin: "10px 0", 
          backgroundColor: "#f9f9f9",
          borderRadius: "5px" 
        }}>
          <h3>Update Template Image</h3>
          <p>Select a new image for this template:</p>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleTemplateFileChange} 
            disabled={loading}
          />
          <div style={{ marginTop: "10px" }}>
            <button 
              onClick={handleUpdateTemplate} 
              disabled={loading || !templateFile}
              style={{ 
                backgroundColor: "#4CAF50", 
                color: "white", 
                marginRight: "10px",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Updating..." : "Update Image"}
            </button>
            <button 
              onClick={cancelTemplateEdit}
              disabled={loading}
              style={{ cursor: loading ? "not-allowed" : "pointer" }}
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
              cursor: loading ? "not-allowed" : "pointer" 
            }}
          >
            Cancel Editing
          </button>
        )}
      </div>

      {/* Festivals Table */}
      {loading && !editingTemplateId ? <p>Loading festivals...</p> : (
        <table border="1" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Festival Date</th>
              <th>Show Days Before</th>
              <th>Templates</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {festivals.map((festival) => (
              <tr key={festival.id}>
                <td>{festival.name}</td>
                <td>{festival.festivalDate.toDate().toLocaleString("en-IN")}</td>
                <td>{festival.showDaysBefore}</td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {festival.templates && festival.templates.map((template) => (
                      <div key={template.id} style={{ position: "relative", border: "1px solid #ddd", padding: "5px" }}>
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
                            onClick={() => handleEditTemplate(festival.id, template.id)}
                            style={{ fontSize: "12px", padding: "2px 5px" }}
                            disabled={loading}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteTemplate(festival.id, template.id, template.imageURL)}
                            style={{ fontSize: "12px", padding: "2px 5px", backgroundColor: "#ff6666", color: "white" }}
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
                  <button 
                    onClick={() => handleEditFestival(festival)}
                    disabled={loading}
                    style={{ marginRight: "5px" }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteFestival(festival)}
                    disabled={loading}
                    style={{ backgroundColor: "#ff6666", color: "white" }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      {festivals.length === 0 && !loading && (
        <p>No festivals found. Add a festival to get started.</p>
      )}
    </div>
  );
};

export default ManageFestivals;