import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const Dashboard = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState("loading");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!auth.currentUser) {
        navigate("/");
        return;
      }

      try {
        setLoading(true);
        
        // Try to get user document by UID
        const userRef = doc(db, "users", auth.currentUser.uid);
        let userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userRole = userSnap.data().role;
          console.log("Role from UID lookup:", userRole);
          setRole(userRole);
        } else {
          // Try with email as ID (with dots replaced by underscores)
          const emailAsId = auth.currentUser.email.replace(/\./g, "_");
          console.log("Trying with email ID:", emailAsId);
          
          const emailRef = doc(db, "users", emailAsId);
          userSnap = await getDoc(emailRef);
          
          if (userSnap.exists()) {
            const userRole = userSnap.data().role;
            console.log("Role from email ID lookup:", userRole);
            setRole(userRole);
          } else {
            console.error("User document not found in Firestore");
            setRole("user"); // Default fallback
          }
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole("user"); // Default fallback on error
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Common navigation handlers
  const navigateTo = (path) => {
    navigate(path);
  };

  if (loading) {
    return <div>Loading user information...</div>;
  }

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome, {auth.currentUser?.email}</p>
      <p>Your role: <strong>{role}</strong></p>

      <div className="navigation-panels">
        {/* Super Admin Panel */}
        {role === "super_admin" && (
          <div className="admin-panel">
            <h3>Super Admin Panel</h3>
            <div className="button-group">
              <button onClick={() => navigateTo("/admins")}>Manage Admins</button>
              <button onClick={() => navigateTo("/users")}>Manage Users</button>
              <button onClick={() => navigateTo("/payments")}>Manage Payments</button>
              <h4>Content Management</h4>
              <button onClick={() => navigateTo("/qotd")}>Manage QOTD</button>
              <button onClick={() => navigateTo("/categories")}>Manage Categories</button>
              <button onClick={() => navigateTo("/trending")}>Manage Trending</button>
              <button onClick={() => navigateTo("/festivals")}>Manage Festivals</button>
              <button onClick={() => navigateTo("/totd")}>Manage TOTD</button>
            </div>
          </div>
        )}

        {/* Quote Moderator Panel */}
        {role === "quote_moderator" && (
          <div className="admin-panel">
            <h3>Content Moderator Panel</h3>
            <div className="button-group">
              <button onClick={() => navigateTo("/qotd")}>Manage QOTD</button>
              <button onClick={() => navigateTo("/categories")}>Manage Categories</button>
              <button onClick={() => navigateTo("/trending")}>Manage Trending</button>
              <button onClick={() => navigateTo("/festivals")}>Manage Festivals</button>
              <button onClick={() => navigateTo("/totd")}>Manage TOTD</button>
            </div>
          </div>
        )}

        {/* User Manager Panel */}
        {role === "user_manager" && (
          <div className="admin-panel">
            <h3>User Manager Panel</h3>
            <div className="button-group">
              <button onClick={() => navigateTo("/users")}>Manage Users</button>
              <button onClick={() => navigateTo("/payments")}>Manage Payments</button>
            </div>
          </div>
        )}

        {/* Regular User */}
        {role === "user" && <p>You are a regular user. No admin access.</p>}
      </div>

      <button onClick={handleLogout} className="logout-button">Logout</button>
    </div>
  );
};

export default Dashboard;