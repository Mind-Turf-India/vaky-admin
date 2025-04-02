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

  useEffect(() => {
    fetchTOTD();
  }, []);

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
        }
      }
    } catch (error) {
      console.error("Error updating post:", error);
      alert("Failed to update post");
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
          // Create a copy of the data without the post to be deleted
          const {  ...restData } = data;
          
          // Set the updated document
          await setDoc(docRef, restData);
          
          await fetchTOTD();
        }
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post");
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
          
          {Object.keys(totd[timeOfDay]).filter(key => key.startsWith('post')).length === 0 ? (
            <p style={{ color: "#666" }}>No posts available for this category</p>
          ) : (
            <table border="1" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>Post ID</th>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Type</th>
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
                    return (
                      <tr key={postKey}>
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
                            value={post.title || ''} 
                            onChange={(e) => handleUpdatePost(timeOfDay, postKey, "title", e.target.value)}
                            disabled={isLoading}
                            style={{ padding: "5px", width: "100%" }}
                          />
                        </td>
                        <td>
                          <select 
                            value={post.isPaid ? "true" : "false"} 
                            onChange={(e) => handleUpdatePost(timeOfDay, postKey, "isPaid", e.target.value === "true")}
                            disabled={isLoading}
                            style={{ padding: "5px" }}
                          >
                            <option value="false">Free</option>
                            <option value="true">Paid</option>
                          </select>
                        </td>
                        <td>{(post.avgRating || 0).toFixed(1)} ({post.ratingCount || 0})</td>
                        <td>{post.createdAt ? post.createdAt.toDate().toLocaleDateString() : "N/A"}</td>
                        <td>
                          <button 
                            onClick={() => handleDeletePost(timeOfDay, postKey)}
                            disabled={isLoading}
                            style={{ backgroundColor: "#ff6666", color: "white" }}
                          >
                            Delete
                          </button>
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