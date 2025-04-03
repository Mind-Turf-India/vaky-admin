import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebaseConfig";

const ManageCategories = () => {
  // States for existing functionality
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [templates, setTemplates] = useState([]);
  const [newTemplates, setNewTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // New states for category management
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [newCategoryNameEdit, setNewCategoryNameEdit] = useState("");
  
  // State for selection functionality
  const [selectedTemplates, setSelectedTemplates] = useState({});
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    // Reset selections when templates change
    const initialSelections = {};
    templates.forEach(template => {
      initialSelections[template.id] = false;
    });
    setSelectedTemplates(initialSelections);
    setSelectAll(false);
  }, [templates]);

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
    const fileName = `${Date.now()}-${file.name}`;
    const storageRef = ref(storage, `categories/${fileName}`);
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

  // New category management functions
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      alert("Please enter a category name!");
      return;
    }

    if (categories.includes(newCategoryName)) {
      alert("Category already exists!");
      return;
    }

    try {
      setLoading(true);
      // Create an empty document with the category name as the ID
      await setDoc(doc(db, "categories", newCategoryName), {
        createdAt: serverTimestamp()
      });

      setNewCategoryName("");
      alert("Category added successfully!");
      await fetchCategories();
    } catch (err) {
      setError("Failed to add category: " + err.message);
      console.error("Error adding category:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategory = async () => {
    if (!newCategoryNameEdit.trim() || !editingCategory) {
      return;
    }

    if (categories.includes(newCategoryNameEdit)) {
      alert("Category name already exists!");
      return;
    }

    try {
      setLoading(true);
      
      // 1. Create a new category with the new name
      await setDoc(doc(db, "categories", newCategoryNameEdit), {
        createdAt: serverTimestamp()
      });
      
      // 2. Copy all templates from old category to new one
      const templatesRef = collection(db, "categories", editingCategory, "templates");
      const snapshot = await getDocs(templatesRef);
      
      for (const templateDoc of snapshot.docs) {
        const templateData = templateDoc.data();
        await addDoc(collection(db, "categories", newCategoryNameEdit, "templates"), {
          ...templateData,
          createdAt: templateData.createdAt || serverTimestamp()
        });
      }
      
      // 3. Delete the old category
      await handleDeleteCategory(editingCategory);
      
      // 4. Reset state and fetch updated categories
      setEditingCategory("");
      setNewCategoryNameEdit("");
      await fetchCategories();
      
      // 5. Select the new category
      setSelectedCategory(newCategoryNameEdit);
      await fetchTemplates(newCategoryNameEdit);
      
      alert("Category updated successfully!");
    } catch (err) {
      setError("Failed to update category: " + err.message);
      console.error("Error updating category:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryName) => {
    const categoryToDelete = categoryName || selectedCategory;
    
    if (!categoryToDelete) {
      alert("Please select a category first!");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the category "${categoryToDelete}" and ALL its templates?`)) {
      return;
    }

    try {
      setLoading(true);
      
      // 1. Delete all templates in the category
      const templatesRef = collection(db, "categories", categoryToDelete, "templates");
      const snapshot = await getDocs(templatesRef);
      
      for (const templateDoc of snapshot.docs) {
        const templateData = templateDoc.data();
        const templateId = templateDoc.id;
        
        // Delete the template document
        await deleteDoc(doc(db, "categories", categoryToDelete, "templates", templateId));
        
        // Delete the image if it exists
        if (templateData.imageURL) {
          try {
            const imagePath = templateData.imageURL.split('.com/o/')[1]?.split('?')[0];
            if (imagePath) {
              const decodedPath = decodeURIComponent(imagePath);
              const imageRef = ref(storage, decodedPath);
              await deleteObject(imageRef);
            }
          } catch (imgErr) {
            console.error("Error deleting image:", imgErr);
          }
        }
      }
      
      // 2. Delete the category document
      await deleteDoc(doc(db, "categories", categoryToDelete));
      
      // 3. Update UI state
      if (categoryName === selectedCategory) {
        setSelectedCategory("");
        setTemplates([]);
      }
      
      await fetchCategories();
      alert("Category deleted successfully!");
    } catch (err) {
      setError("Failed to delete category: " + err.message);
      console.error("Error deleting category:", err);
    } finally {
      setLoading(false);
    }
  };

  // Selection functionality
  const handleToggleSelectAll = (checked) => {
    setSelectAll(checked);
    const newSelections = {};
    templates.forEach(template => {
      newSelections[template.id] = checked;
    });
    setSelectedTemplates(newSelections);
  };

  const handleToggleSelect = (templateId, checked) => {
    setSelectedTemplates({
      ...selectedTemplates,
      [templateId]: checked
    });
    
    // Check if all are selected after this change
    const updatedSelections = { ...selectedTemplates, [templateId]: checked };
    const allSelected = templates.every(template => updatedSelections[template.id]);
    setSelectAll(allSelected);
  };

  const handleDeleteSelected = async () => {
    const selectedIds = Object.keys(selectedTemplates).filter(id => selectedTemplates[id]);
    
    if (selectedIds.length === 0) {
      alert("No templates selected!");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected template(s)?`)) {
      return;
    }

    try {
      setLoading(true);
      
      for (const templateId of selectedIds) {
        const template = templates.find(t => t.id === templateId);
        if (!template) continue;
        
        // Delete from Firestore
        await deleteDoc(doc(db, "categories", selectedCategory, "templates", templateId));
        
        // Delete image if it exists
        if (template.imageURL) {
          try {
            const imagePath = template.imageURL.split('.com/o/')[1]?.split('?')[0];
            if (imagePath) {
              const decodedPath = decodeURIComponent(imagePath);
              const imageRef = ref(storage, decodedPath);
              await deleteObject(imageRef);
            }
          } catch (imgErr) {
            console.error(`Error deleting image for template ${templateId}:`, imgErr);
          }
        }
      }
      
      // Refresh templates
      await fetchTemplates(selectedCategory);
      alert("Selected templates deleted successfully!");
    } catch (err) {
      setError("Failed to delete selected templates: " + err.message);
      console.error("Error deleting selected templates:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Manage Categories & Templates</h2>
      
      {error && <div style={{ color: "red", margin: "10px 0" }}>{error}</div>}
      {loading && <div>Loading...</div>}

      {/* Category Management Section */}
      <div style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "20px" }}>
        <h3>Categories</h3>
        
        {/* Add Category */}
        <div style={{ marginBottom: "15px" }}>
          <input
            type="text"
            placeholder="New Category Name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            disabled={loading}
            style={{ marginRight: "10px" }}
          />
          <button 
            onClick={handleAddCategory}
            disabled={loading || !newCategoryName.trim()}
          >
            Add Category
          </button>
        </div>
        
        {/* Edit Category */}
        {editingCategory && (
          <div style={{ marginBottom: "15px" }}>
            <input
              type="text"
              placeholder="New Name for Category"
              value={newCategoryNameEdit}
              onChange={(e) => setNewCategoryNameEdit(e.target.value)}
              disabled={loading}
              style={{ marginRight: "10px" }}
            />
            <button 
              onClick={handleEditCategory}
              disabled={loading || !newCategoryNameEdit.trim()}
            >
              Save
            </button>
            <button 
              onClick={() => {
                setEditingCategory("");
                setNewCategoryNameEdit("");
              }}
              disabled={loading}
              style={{ marginLeft: "5px" }}
            >
              Cancel
            </button>
          </div>
        )}
        
        {/* Categories Table */}
        <table border="1" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Category Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category}>
                <td>{category}</td>
                <td>
                  <button
                    onClick={() => {
                      setEditingCategory(category);
                      setNewCategoryNameEdit(category);
                    }}
                    disabled={loading}
                    style={{ marginRight: "5px" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    disabled={loading}
                    style={{ backgroundColor: "#ff6666", marginRight: "5px" }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => fetchTemplates(category)}
                    disabled={loading}
                  >
                    View Templates
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Select Category for Templates */}
      <h3>Current Working Category</h3>
      <select 
        onChange={(e) => fetchTemplates(e.target.value)} 
        value={selectedCategory}
        disabled={loading}
        style={{ marginBottom: "20px", padding: "5px", width: "200px" }}
      >
        <option value="">Select a Category</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      {/* Bulk Add Templates */}
      {selectedCategory && (
        <div style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "20px" }}>
          <h3>Bulk Add Templates to {selectedCategory}</h3>
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
                  style={{ marginRight: "10px" }}
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
                  style={{ marginRight: "10px" }}
                />
                <label style={{ marginRight: "10px" }}>
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
            style={{ marginRight: "10px" }}
          >
            + Add Template
          </button>
          <button 
            onClick={handleBulkAddTemplates}
            disabled={loading || !selectedCategory || newTemplates.length === 0}
          >
            Upload All
          </button>
        </div>
      )}

      {/* Display Templates with Selection */}
      {selectedCategory && templates.length > 0 && (
        <div style={{ border: "1px solid #ccc", padding: "15px" }}>
          <h3>Templates in {selectedCategory}</h3>
          
          {/* Bulk Actions */}
          <div style={{ marginBottom: "15px" }}>
            <button
              onClick={handleDeleteSelected}
              disabled={loading || Object.values(selectedTemplates).every(value => !value)}
              style={{ backgroundColor: "#ff6666", marginRight: "10px" }}
            >
              Delete Selected
            </button>
          </div>
          
          <table border="1" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: "30px" }}>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    disabled={loading}
                  />
                </th>
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
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedTemplates[template.id] || false}
                      onChange={(e) => handleToggleSelect(template.id, e.target.checked)}
                      disabled={loading}
                    />
                  </td>
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
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {template.imageURL ? (
                      <img src={template.imageURL} alt="Template" width="50" />
                    ) : (
                      "No image"
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
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