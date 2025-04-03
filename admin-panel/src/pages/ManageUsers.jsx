import { useState, useEffect } from "react";
import { collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebaseConfig"; // Make sure you've exported auth from your config

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const userList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.role === "user"); // Only show normal users
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await deleteDoc(doc(db, "users", userId));
      setUsers(users.filter(user => user.id !== userId));
      // Also remove from selected users if present
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
      alert("User deleted successfully!");
    } catch (error) {
      console.error("Error deleting user:", error.message);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedUsers.length === 0) {
      alert("No users selected!");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${selectedUsers.length} user(s)?`)) {
      try {
        for (const userId of selectedUsers) {
          await deleteDoc(doc(db, "users", userId));
        }
        setUsers(users.filter(user => !selectedUsers.includes(user.id)));
        setSelectedUsers([]);
        alert("Selected users deleted successfully!");
      } catch (error) {
        console.error("Error deleting selected users:", error.message);
      }
    }
  };

  const handleResetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error("Error sending password reset email:", error.message);
      alert(`Failed to send reset email: ${error.message}`);
    }
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      // If all are selected, unselect all
      setSelectedUsers([]);
    } else {
      // Otherwise, select all filtered users
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  const handleSelectUser = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser({...user});
  };

  const handleSaveEdit = async () => {
    try {
      if (!editingUser) return;
      
      await updateDoc(doc(db, "users", editingUser.id), {
        isSubscribed: editingUser.isSubscribed,
        // Add other fields you want to update
      });
      
      // Update local state
      setUsers(users.map(user => 
        user.id === editingUser.id ? { ...user, ...editingUser } : user
      ));
      
      setEditingUser(null);
      alert("User updated successfully!");
    } catch (error) {
      console.error("Error updating user:", error.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
  };

  // Filter users based on search query
  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    
    // Check if it's a Firebase Timestamp
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleString();
    } 
    
    // Handle regular Date objects or ISO strings
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="manage-users-container">
      <h2>Manage Users</h2>
      
      {/* Search and bulk actions */}
      <div className="actions-container" style={{ marginBottom: "15px", display: "flex", justifyContent: "space-between" }}>
        <input 
          type="text" 
          placeholder="Search users by email or name..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          style={{ padding: "8px", width: "60%" }}
        />
        
        <button 
          onClick={handleDeleteSelected}
          disabled={selectedUsers.length === 0}
          className="delete-selected-btn"
          style={{ 
            padding: "8px 15px", 
            backgroundColor: selectedUsers.length === 0 ? "#ccc" : "#ff6666",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: selectedUsers.length === 0 ? "not-allowed" : "pointer"
          }}
        >
          Delete Selected ({selectedUsers.length})
        </button>
      </div>
      
      {/* User editing modal */}
      {editingUser && (
        <div className="edit-modal" style={{ 
          border: "1px solid #ccc",
          padding: "20px",
          borderRadius: "5px",
          marginBottom: "20px",
          backgroundColor: "#f9f9f9"
        }}>
          <h3>Edit User: {editingUser.email}</h3>
          
          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Email:</label>
            <input 
              type="text" 
              value={editingUser.email} 
              disabled 
              style={{ padding: "8px", width: "100%", backgroundColor: "#eee" }}
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Subscription Status:</label>
            <select 
              value={editingUser.isSubscribed ? "true" : "false"} 
              onChange={(e) => setEditingUser({
                ...editingUser, 
                isSubscribed: e.target.value === "true"
              })}
              style={{ padding: "8px", width: "100%" }}
            >
              <option value="true">Subscribed</option>
              <option value="false">Not Subscribed</option>
            </select>
          </div>
          
          <div className="button-group" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button 
              onClick={handleSaveEdit}
              style={{ padding: "8px 15px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Save
            </button>
            <button 
              onClick={handleCancelEdit}
              style={{ padding: "8px 15px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Users table */}
      <table className="users-table" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd" }}>
        <thead>
          <tr style={{ backgroundColor: "#f2f2f2" }}>
            <th style={{ padding: "10px", textAlign: "center", border: "1px solid #ddd" }}>
              <input 
                type="checkbox" 
                checked={selectedUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                onChange={handleSelectAll}
              />
            </th>
            <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Email</th>
            <th style={{ padding: "10px", textAlign: "center", border: "1px solid #ddd" }}>Role</th>
            <th style={{ padding: "10px", textAlign: "center", border: "1px solid #ddd" }}>Subscription</th>
            <th style={{ padding: "10px", textAlign: "center", border: "1px solid #ddd" }}>Created At</th>
            <th style={{ padding: "10px", textAlign: "center", border: "1px solid #ddd" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <tr key={user.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "10px", textAlign: "center", border: "1px solid #ddd" }}>
                  <input 
                    type="checkbox" 
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => handleSelectUser(user.id)}
                  />
                </td>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>{user.email}</td>
                <td style={{ padding: "10px", textAlign: "center", border: "1px solid #ddd" }}>{user.role}</td>
                <td style={{ 
                  padding: "10px", 
                  textAlign: "center", 
                  backgroundColor: user.isSubscribed ? "#e8f5e9" : "#ffebee",
                  border: "1px solid #ddd"
                }}>
                  {user.isSubscribed ? "Subscribed" : "Not Subscribed"}
                </td>
                <td style={{ padding: "10px", textAlign: "center", border: "1px solid #ddd" }}>{formatDate(user.createdAt)}</td>
                <td className="actions-cell" style={{ padding: "10px", textAlign: "center", border: "1px solid #ddd" }}>
                  <button 
                    onClick={() => handleEditUser(user)}
                    style={{ padding: "5px 10px", margin: "0 5px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteUser(user.id)}
                    style={{ padding: "5px 10px", margin: "0 5px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    Delete
                  </button>
                  <button 
                    onClick={() => handleResetPassword(user.email)}
                    style={{ padding: "5px 10px", margin: "0 5px", backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    Reset Password
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="no-results" style={{ padding: "20px", textAlign: "center", border: "1px solid #ddd" }}>No users found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ManageUsers;