import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const ManageAdmins = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("quote_moderator");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all users from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
      setLoading(false);
    };
    
    fetchUsers();
  }, []);

  // Create new admin and store in Firestore
  const handleCreateAdmin = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const formattedEmail = user.email.replace(/\./g, "_");

      // Store admin details in Firestore with role
      await setDoc(doc(db, "users", formattedEmail), { email, role }, { merge: true });

      alert("Admin created successfully!");
      setEmail("");
      setPassword("");

      // Refresh user list after adding a new admin
      setUsers([...users, { id: formattedEmail, email, role }]);
    } catch (error) {
      console.error("Error creating admin:", error.message);
    }
  };

  // Update admin role
  const handleRoleUpdate = async (userId, newRole) => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { role: newRole });

      alert("Role updated successfully!");
      setUsers(users.map(user => user.id === userId ? { ...user, role: newRole } : user));
    } catch (error) {
      console.error("Error updating role:", error.message);
    }
  };

  return (
    <div>
      <h2>Create Admin</h2>
      <input type="email" placeholder="Admin Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="quote_moderator">Quote Moderator</option>
        <option value="user_manager">User Manager</option>
      </select>
      <button onClick={handleCreateAdmin}>Create Admin</button>

      <h2>Manage Admins</h2>
      {loading ? <p>Loading users...</p> : (
        <table border="1">
          <thead>
            <tr>
              <th>Email</th>
              <th>Current Role</th>
              <th>Update Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>
                  <select value={user.role} onChange={(e) => handleRoleUpdate(user.id, e.target.value)}>
                    <option value="super_admin">Super Admin</option>
                    <option value="quote_moderator">Quote Moderator</option>
                    <option value="user_manager">User Manager</option>
                    <option value="user">User</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ManageAdmins;
