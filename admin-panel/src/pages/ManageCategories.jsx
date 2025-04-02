import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebaseConfig";

const ManageCategories = () => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [templates, setTemplates] = useState([]);
  const [newTemplates, setNewTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const categoriesRef = collection(db, "categories");
      const snapshot = await getDocs(categoriesRef);
      setCategories(snapshot.docs.map((doc) => doc.id));
      setError("");
    } catch (err) {
      setError("Failed to fetch categories: " + err.message);
      console.error("Error fetching categories:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async (category) => {
    try {
      setLoading(true);
      setSelectedCategory(category);
      const templatesRef = collection(db, "categories", category, "templates");
      const snapshot = await getDocs(templatesRef);
      setTemplates(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: formatTimestamp(doc.data().createdAt)
        }))
      );
      setError("");
    } catch (err) {
      setError("Failed to fetch templates: " + err.message);
      console.error("Error fetching templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short"
    }).format(date);
  };

  const handleImageUpload = async (file) => {
    const storageRef = ref(storage, `templates/${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleBulkAddTemplates = async () => {
    if (!selectedCategory) {
      alert("Please select a category first!");
      return;
    }

    try {
      setLoading(true);
      for (let template of newTemplates) {
        const imageUrl = template.imageFile
          ? await handleImageUpload(template.imageFile)
          : "";

        await addDoc(collection(db, "categories", selectedCategory, "templates"), {
          title: template.title || "Untitled",
          isPaid: template.isPaid || false,
          imageURL: imageUrl,
          createdAt: serverTimestamp()
        });
      }

      alert("Bulk templates added successfully!");
      setNewTemplates([]);
      fetchTemplates(selectedCategory);
    } catch (err) {
      setError("Failed to add templates: " + err.message);
      console.error("Error adding templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTemplate = async (templateId, updatedTitle, updatedIsPaid) => {
    try {
      setLoading(true);
      const templateRef = doc(db, "categories", selectedCategory, "templates", templateId);
      await updateDoc(templateRef, {
        title: updatedTitle,
        isPaid: updatedIsPaid
      });

      alert("Template updated successfully!");
      setTemplates(
        templates.map((t) =>
          t.id === templateId ? { ...t, title: updatedTitle, isPaid: updatedIsPaid } : t
        )
      );
      setError("");
    } catch (err) {
      setError("Failed to update template: " + err.message);
      console.error("Error updating template:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId, imageURL) => {
    if (!window.confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      setLoading(true);
      
      // Delete document from Firestore
      const templateRef = doc(db, "categories", selectedCategory, "templates", templateId);
      await deleteDoc(templateRef);
      
      // Delete image from Storage if it exists
      if (imageURL) {
        try {
          // Extract the path from the URL
          const imagePath = imageURL.split('.com/o/')[1]?.split('?')[0];
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
      
      // Update UI by removing the deleted template
      setTemplates(templates.filter(t => t.id !== templateId));
      alert("Template deleted successfully!");
      setError("");
    } catch (err) {
      setError("Failed to delete template: " + err.message);
      console.error("Error deleting template:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Manage Categories & Templates</h2>
      
      {error && <div style={{ color: "red", margin: "10px 0" }}>{error}</div>}
      {loading && <div>Loading...</div>}

      {/* Select Category */}
      <h3>Select Category</h3>
      <select 
        onChange={(e) => fetchTemplates(e.target.value)} 
        value={selectedCategory}
        disabled={loading}
      >
        <option value="">Select a Category</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      {/* Bulk Add Templates */}
      <h3>Bulk Add Templates</h3>
      <div>
        {newTemplates.map((temp, index) => (
          <div key={index} style={{ marginBottom: "10px", padding: "10px", border: "1px solid #ccc" }}>
            <input
              type="text"
              placeholder="Title"
              value={temp.title || ""}
              onChange={(e) => {
                const updated = [...newTemplates];
                updated[index].title = e.target.value;
                setNewTemplates(updated);
              }}
              disabled={loading}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const updated = [...newTemplates];
                updated[index].imageFile = e.target.files[0];
                setNewTemplates(updated);
              }}
              disabled={loading}
            />
            <label>
              <input
                type="checkbox"
                checked={temp.isPaid || false}
                onChange={(e) => {
                  const updated = [...newTemplates];
                  updated[index].isPaid = e.target.checked;
                  setNewTemplates(updated);
                }}
                disabled={loading}
              />
              Paid
            </label>
            <button
              onClick={() => {
                const updated = newTemplates.filter((_, i) => i !== index);
                setNewTemplates(updated);
              }}
              disabled={loading}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button 
        onClick={() => setNewTemplates([...newTemplates, {}])}
        disabled={loading}
      >
        + Add Template
      </button>
      <button 
        onClick={handleBulkAddTemplates}
        disabled={loading || !selectedCategory || newTemplates.length === 0}
      >
        Upload All
      </button>

      {/* Display Templates */}
      {templates.length > 0 && (
        <div>
          <h3>Templates in {selectedCategory}</h3>
          <table border="1" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Image</th>
                <th>Paid?</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>
                    <input
                      type="text"
                      value={template.title}
                      onChange={(e) =>
                        setTemplates(
                          templates.map((t) =>
                            t.id === template.id ? { ...t, title: e.target.value } : t
                          )
                        )
                      }
                      disabled={loading}
                    />
                  </td>
                  <td>
                    {template.imageURL ? (
                      <img src={template.imageURL} alt="Template" width="50" />
                    ) : (
                      "No image"
                    )}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={template.isPaid}
                      onChange={(e) =>
                        setTemplates(
                          templates.map((t) =>
                            t.id === template.id ? { ...t, isPaid: e.target.checked } : t
                          )
                        )
                      }
                      disabled={loading}
                    />
                  </td>
                  <td>{template.createdAt}</td>
                  <td>
                    <button
                      onClick={() =>
                        handleUpdateTemplate(template.id, template.title, template.isPaid)
                      }
                      disabled={loading}
                      style={{ marginRight: "5px" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id, template.imageURL)}
                      disabled={loading}
                      style={{ backgroundColor: "#ff6666" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ManageCategories;