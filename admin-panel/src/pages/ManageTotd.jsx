import { useState, useEffect } from "react";
import { db, storage } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const ManageTotd = () => {
  const [totd, setTOTD] = useState({
    morning: {},
    afternoon: {},
    evening: {},
  });

  const [newPost, setNewPost] = useState({
    timeOfDay: "morning",
    title: "",
    isPaid: false,
    imageFiles: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [editableRows, setEditableRows] = useState({});
  const [editState, setEditState] = useState({});
  const [selectedPosts, setSelectedPosts] = useState({
    morning: [],
    afternoon: [],
    evening: [],
  });
  const [selectAll, setSelectAll] = useState({
    morning: false,
    afternoon: false,
    evening: false,
  });

  useEffect(() => {
    fetchTOTD();
  }, []);

  // Toggle edit mode for a specific row
  const toggleEditMode = (timeOfDay, postKey) => {
    const key = `${timeOfDay}-${postKey}`;
    
    // If we're entering edit mode, initialize edit state with current values
    if (!editableRows[key]) {
      setEditState(prev => ({
        ...prev,
        [key]: {
          title: totd[timeOfDay][postKey].title || '',
          isPaid: totd[timeOfDay][postKey].isPaid || false
        }
      }));
    }
    
    setEditableRows(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Check if a row is in edit mode
  const isEditing = (timeOfDay, postKey) => {
    const key = `${timeOfDay}-${postKey}`;
    return editableRows[key] || false;
  };

  // Get the current edit value for a field
  const getEditValue = (timeOfDay, postKey, field) => {
    const key = `${timeOfDay}-${postKey}`;
    if (editableRows[key] && editState[key]) {
      return editState[key][field];
    }
    return totd[timeOfDay][postKey][field];
  };

  // Update the edit state without affecting Firestore
  const updateEditState = (timeOfDay, postKey, field, value) => {
    const key = `${timeOfDay}-${postKey}`;
    setEditState(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  // 🔹 Fetch TOTD data from Firestore - using document structure
  const fetchTOTD = async () => {
    setIsLoading(true);
    const categories = ["morning", "afternoon", "evening"];
    let data = {};

    try {
      for (let category of categories) {
        const docRef = doc(db, "totd", category);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          data[category] = docSnap.data();
        } else {
          data[category] = {};
        }
      }
      
      setTOTD(data);
    } catch (error) {
      console.error("Error fetching TOTD data:", error);
      alert("Failed to fetch TOTD data");
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Handle Image Upload
  const handleImageUpload = async (file) => {
    const storageRef = ref(storage, `totd/${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  // 🔹 Add new TOTD posts in bulk
  const handleAddBulkPosts = async () => {
    const { timeOfDay, title, isPaid, imageFiles } = newPost;
    
    if (!imageFiles.length) {
      return alert("Please select at least one image file");
    }

    setIsLoading(true);
    
    try {
      // Get current document to check existing posts
      const docRef = doc(db, "totd", timeOfDay);
      const docSnap = await getDoc(docRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      // Find the next post number
      const existingPostKeys = Object.keys(existingData).filter(key => key.startsWith('post'));
      const nextPostNumber = existingPostKeys.length > 0 
        ? Math.max(...existingPostKeys.map(key => parseInt(key.replace('post', '')))) + 1 
        : 1;

      // Upload each image and create post entries
      let updatedData = { ...existingData };
      
      for (let i = 0; i < imageFiles.length; i++) {
        const postKey = `post${nextPostNumber + i}`;
        const imageUrl = await handleImageUpload(imageFiles[i]);
        
        updatedData[postKey] = {
          title: title || `${timeOfDay} thought ${nextPostNumber + i}`,
          isPaid: isPaid,
          imageUrl: imageUrl,
          avgRating: 0,
          ratingCount: 0,
          createdAt: Timestamp.now(),
        };
      }

      // Set the updated document
      await setDoc(doc(db, "totd", timeOfDay), updatedData);
      
      // Reset form and refresh data
      setNewPost({
        timeOfDay: "morning",
        title: "",
        isPaid: false,
        imageFiles: [],
      });
      
      await fetchTOTD();
      alert(`${imageFiles.length} posts added successfully!`);
      
    } catch (error) {
      console.error("Error adding bulk posts:", error);
      alert("Failed to add posts");
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Update TOTD Post
  const handleUpdatePost = async (timeOfDay, postKey, field, value) => {
    setIsLoading(true);
    
    try {
      const docRef = doc(db, "totd", timeOfDay);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        if (data[postKey]) {
          // Update the specific field in the post
          await updateDoc(docRef, {
            [`${postKey}.${field}`]: value
          });
          
          await fetchTOTD();
          
          // If this was a "isPaid" toggle update, notify success
          if (field === "isPaid") {
            console.log(`Post ${postKey} updated to ${value ? "paid" : "free"} content`);
          }
        }
      }
    } catch (error) {
      console.error("Error updating post:", error);
      alert("Failed to update post");
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Save post changes
  const handleSavePost = async (timeOfDay, postKey) => {
    setIsLoading(true);
    const key = `${timeOfDay}-${postKey}`;
    
    try {
      const docRef = doc(db, "totd", timeOfDay);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        if (data[postKey] && editState[key]) {
          // Update with the edited state values
          await updateDoc(docRef, {
            [`${postKey}.title`]: editState[key].title,
            [`${postKey}.isPaid`]: editState[key].isPaid
          });
          
          await fetchTOTD();
          toggleEditMode(timeOfDay, postKey); // Exit edit mode
          console.log("Post updated successfully!");
        }
      }
    } catch (error) {
      console.error("Error saving post:", error);
      alert("Failed to save post");
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Delete TOTD Post
  const handleDeletePost = async (timeOfDay, postKey) => {
    if (!confirm(`Are you sure you want to delete this post?`)) return;
    
    setIsLoading(true);
    
    try {
      const docRef = doc(db, "totd", timeOfDay);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        if (data[postKey]) {
          // Create a copy of the data
          const updatedData = { ...data };
          // Delete the specific post
          delete updatedData[postKey];
          
          // Set the updated document
          await setDoc(docRef, updatedData);
          
          await fetchTOTD();
          alert("Post deleted successfully");
        }
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post");
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Handle selection of posts
  const handleSelectPost = (timeOfDay, postKey) => {
    setSelectedPosts(prev => {
      const newSelectedPosts = { ...prev };
      
      if (newSelectedPosts[timeOfDay].includes(postKey)) {
        // Remove if already selected
        newSelectedPosts[timeOfDay] = newSelectedPosts[timeOfDay].filter(key => key !== postKey);
      } else {
        // Add if not selected
        newSelectedPosts[timeOfDay] = [...newSelectedPosts[timeOfDay], postKey];
      }
      
      return newSelectedPosts;
    });
  };

  // 🔹 Handle select all for a category
  const handleSelectAll = (timeOfDay) => {
    const newSelectAll = { ...selectAll };
    newSelectAll[timeOfDay] = !selectAll[timeOfDay];
    setSelectAll(newSelectAll);
    
    const postKeys = Object.keys(totd[timeOfDay]).filter(key => key.startsWith('post'));
    
    setSelectedPosts(prev => {
      const newSelectedPosts = { ...prev };
      
      if (newSelectAll[timeOfDay]) {
        // Select all
        newSelectedPosts[timeOfDay] = [...postKeys];
      } else {
        // Deselect all
        newSelectedPosts[timeOfDay] = [];
      }
      
      return newSelectedPosts;
    });
  };

  // 🔹 Delete selected posts
  const handleDeleteSelected = async (timeOfDay) => {
    const selectedKeys = selectedPosts[timeOfDay];
    
    if (selectedKeys.length === 0) {
      return alert("No posts selected for deletion");
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedKeys.length} selected posts?`)) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const docRef = doc(db, "totd", timeOfDay);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const updatedData = { ...data };
        
        // Remove each selected post
        selectedKeys.forEach(key => {
          delete updatedData[key];
        });
        
        // Update the document
        await setDoc(docRef, updatedData);
        
        // Reset selections
        setSelectedPosts(prev => ({
          ...prev,
          [timeOfDay]: []
        }));
        
        setSelectAll(prev => ({
          ...prev,
          [timeOfDay]: false
        }));
        
        await fetchTOTD();
        alert(`${selectedKeys.length} posts deleted successfully`);
      }
    } catch (error) {
      console.error("Error deleting selected posts:", error);
      alert("Failed to delete selected posts");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Thought of the Day (TOTD) Manager</h2>
      
      {/* 🔹 Add New TOTD Posts in Bulk */}
      <div style={{ 
        border: "1px solid #ddd", 
        padding: "15px", 
        marginBottom: "20px",
        borderRadius: "5px"
      }}>
        <h3 style={{ marginBottom: "15px" }}>Add New TOTD Posts (Bulk Upload)</h3>
        
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>Category:</label>
          <select 
            value={newPost.timeOfDay} 
            onChange={(e) => setNewPost({ ...newPost, timeOfDay: e.target.value })}
            style={{ padding: "5px", width: "100%" }}
          >
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>
        
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>Title (Optional - will auto-generate if empty):</label>
          <input 
            type="text" 
            placeholder="Title" 
            value={newPost.title} 
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} 
            style={{ padding: "5px", width: "100%" }}
          />
        </div>
        
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>Upload Images (Multiple):</label>
          <input 
            type="file" 
            multiple 
            onChange={(e) => setNewPost({ ...newPost, imageFiles: Array.from(e.target.files) })} 
            disabled={isLoading}
          />
          {newPost.imageFiles.length > 0 && (
            <small style={{ display: "block", marginTop: "5px", color: "#666" }}>
              {newPost.imageFiles.length} file(s) selected
            </small>
          )}
        </div>
        
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>
            <input 
              type="checkbox"
              checked={newPost.isPaid} 
              onChange={(e) => setNewPost({ ...newPost, isPaid: e.target.checked })} 
              style={{ marginRight: "5px" }}
            />
            Is Paid Content?
          </label>
        </div>
        
        <button 
          onClick={handleAddBulkPosts} 
          disabled={isLoading || newPost.imageFiles.length === 0}
          style={{ 
            padding: "8px 16px", 
            backgroundColor: "#4CAF50", 
            color: "white", 
            border: "none", 
            borderRadius: "4px", 
            cursor: isLoading || newPost.imageFiles.length === 0 ? "not-allowed" : "pointer" 
          }}
        >
          {isLoading ? "Processing..." : "Add TOTD Posts"}
        </button>
      </div>

      {/* 🔹 Display & Manage TOTD Posts */}
      {["morning", "afternoon", "evening"].map((timeOfDay) => (
        <div key={timeOfDay}>
          <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>{timeOfDay.toUpperCase()} THOUGHTS</h3>
          
          {/* Bulk Actions */}
          <div style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between" }}>
            <div>
              <button
                onClick={() => handleSelectAll(timeOfDay)}
                style={{ 
                  marginRight: "10px", 
                  padding: "5px 10px",
                  backgroundColor: selectAll[timeOfDay] ? "#5b9bd5" : "#f0f0f0",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  cursor: "pointer"
                }}
              >
                {selectAll[timeOfDay] ? "Deselect All" : "Select All"}
              </button>
              <button
                onClick={() => handleDeleteSelected(timeOfDay)}
                disabled={selectedPosts[timeOfDay].length === 0 || isLoading}
                style={{ 
                  padding: "5px 10px",
                  backgroundColor: selectedPosts[timeOfDay].length === 0 ? "#f0f0f0" : "#ff6666",
                  color: selectedPosts[timeOfDay].length === 0 ? "#888" : "white",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  cursor: selectedPosts[timeOfDay].length === 0 || isLoading ? "not-allowed" : "pointer"
                }}
              >
                Delete Selected ({selectedPosts[timeOfDay].length})
              </button>
            </div>
            <div>
              {isLoading && <span style={{ color: "#888" }}>Processing...</span>}
            </div>
          </div>
          
          {Object.keys(totd[timeOfDay]).filter(key => key.startsWith('post')).length === 0 ? (
            <p style={{ color: "#666" }}>No posts available for this category</p>
          ) : (
            <table border="1" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>Select</th>
                  <th>Post ID</th>
                  <th>Image</th>
                  <th>Title</th>
                  <th style={{ width: "100px" }}>Type</th>
                  <th>Rating</th>
                  <th>Date Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(totd[timeOfDay])
                  .filter(key => key.startsWith('post'))
                  .sort((a, b) => {
                    // Sort by post number (post1, post2, etc.)
                    const numA = parseInt(a.replace('post', ''));
                    const numB = parseInt(b.replace('post', ''));
                    return numA - numB;
                  })
                  .map((postKey) => {
                    const post = totd[timeOfDay][postKey] || {};
                    // Skip rendering if not a valid post object
                    if (!post || typeof post !== 'object') return null;
                    
                    const isEditingMode = isEditing(timeOfDay, postKey);
                    const isSelected = selectedPosts[timeOfDay].includes(postKey);
                    
                    return (
                      <tr key={postKey} style={{ backgroundColor: isSelected ? "#f0f8ff" : "white" }}>
                        <td style={{ textAlign: "center" }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => handleSelectPost(timeOfDay, postKey)}
                          />
                        </td>
                        <td>{postKey}</td>
                        <td>
                          <img 
                            src={post.imageUrl} 
                            alt={post.title || "TOTD image"} 
                            width="80" 
                            height="80"
                            style={{ objectFit: "cover" }}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            value={isEditingMode ? getEditValue(timeOfDay, postKey, "title") : (post.title || '')}
                            onChange={(e) => updateEditState(timeOfDay, postKey, "title", e.target.value)}
                            disabled={!isEditingMode || isLoading}
                            style={{ 
                              padding: "5px", 
                              width: "100%",
                              border: isEditingMode ? "1px solid #5b9bd5" : "1px solid #ddd",
                              backgroundColor: isEditingMode ? "white" : "#f9f9f9"
                            }}
                          />
                        </td>
                        <td>
                          <select 
                            value={isEditingMode ? (getEditValue(timeOfDay, postKey, "isPaid") ? "true" : "false") : (post.isPaid ? "true" : "false")}
                            onChange={(e) => {
                              const value = e.target.value === "true";
                              if (isEditingMode) {
                                updateEditState(timeOfDay, postKey, "isPaid", value);
                              } else {
                                handleUpdatePost(timeOfDay, postKey, "isPaid", value);
                              }
                            }}
                            disabled={isLoading}
                            style={{ 
                              padding: "5px", 
                              width: "100%",
                              border: isEditingMode ? "1px solid #5b9bd5" : "1px solid #ddd",
                              backgroundColor: isEditingMode ? "white" : "#f9f9f9"
                            }}
                          >
                            <option value="false">Free</option>
                            <option value="true">Paid</option>
                          </select>
                        </td>
                        <td>{(post.avgRating || 0).toFixed(1)} ({post.ratingCount || 0})</td>
                        <td>{post.createdAt ? post.createdAt.toDate().toLocaleDateString() : "N/A"}</td>
                        <td>
                          <div style={{ display: "flex", gap: "5px" }}>
                            {isEditingMode ? (
                              <button 
                                onClick={() => handleSavePost(timeOfDay, postKey)}
                                disabled={isLoading}
                                style={{ 
                                  padding: "5px", 
                                  backgroundColor: "#4CAF50", 
                                  color: "white",
                                  border: "none",
                                  borderRadius: "3px"
                                }}
                              >
                                Save
                              </button>
                            ) : (
                              <button 
                                onClick={() => toggleEditMode(timeOfDay, postKey)}
                                disabled={isLoading}
                                style={{ 
                                  padding: "5px", 
                                  backgroundColor: "#5b9bd5", 
                                  color: "white",
                                  border: "none",
                                  borderRadius: "3px"
                                }}
                              >
                                Edit
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeletePost(timeOfDay, postKey)}
                              disabled={isLoading}
                              style={{ 
                                padding: "5px", 
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
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
};

export default ManageTotd;