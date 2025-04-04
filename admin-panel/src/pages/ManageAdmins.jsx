import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const ManageAdmins = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("quote_moderator");
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch only quote_moderator and user_manager users from Firestore
  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        
        // Filter to only include quote_moderator and user_manager roles
        const adminList = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(user => user.role === "quote_moderator" || user.role === "user_manager");
        
        setAdmins(adminList);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching admins:", error);
        setLoading(false);
      }
    };
    
    fetchAdmins();
  }, []);

  // Create new admin and store in Firestore
  const handleCreateAdmin = async () => {
    if (!email || !password) {
      alert("Please enter both email and password");
      return;
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const formattedEmail = user.email.replace(/\./g, "_");

      // Store admin details in Firestore with role
      await setDoc(doc(db, "users", formattedEmail), { 
        email: user.email, 
        role 
      }, { merge: true });

      alert("Admin created successfully!");
      
      // Reset form fields
      setEmail("");
      setPassword("");

      // Add new admin to the list if it's a quote_moderator or user_manager
      if (role === "quote_moderator" || role === "user_manager") {
        setAdmins([...admins, { id: formattedEmail, email: user.email, role }]);
      }
    } catch (error) {
      console.error("Error creating admin:", error.message);
      alert(`Error creating admin: ${error.message}`);
    }
  };

  // Update admin role
  const handleRoleUpdate = async (userId, newRole) => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { role: newRole });

      if (newRole === "quote_moderator" || newRole === "user_manager") {
        // If the new role is still quote_moderator or user_manager, update the list
        setAdmins(admins.map(admin => admin.id === userId ? { ...admin, role: newRole } : admin));
        alert("Role updated successfully!");
      } else {
        // If the new role is changed to something else, remove from the list
        setAdmins(admins.filter(admin => admin.id !== userId));
        alert("Admin removed from managers list!");
      }
    } catch (error) {
      console.error("Error updating role:", error.message);
      alert(`Error updating role: ${error.message}`);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New Manager</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              placeholder="Manager Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="quote_moderator">Quote Moderator</option>
              <option value="user_manager">User Manager</option>
            </select>
          </div>
          
          <button 
            onClick={handleCreateAdmin}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Create Manager
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Manage Content & User Managers</h2>
        {loading ? (
          <div className="text-center py-4">
            <p>Loading managers...</p>
          </div>
        ) : (
          admins.length === 0 ? (
            <p className="text-center py-4">No managers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Update Role</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {admins.map(admin => (
                    <tr key={admin.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{admin.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          admin.role === "quote_moderator" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {admin.role === "quote_moderator" ? "Quote Moderator" : "User Manager"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select 
                          value={admin.role} 
                          onChange={(e) => handleRoleUpdate(admin.id, e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="quote_moderator">Quote Moderator</option>
                          <option value="user_manager">User Manager</option>
                          <option value="user">Regular User</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ManageAdmins;