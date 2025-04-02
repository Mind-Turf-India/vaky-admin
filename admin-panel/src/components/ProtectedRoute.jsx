import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../firebaseConfig.js";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";

const ProtectedRoute = ({ children, requiredRole }) => {
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setCheckingRole(false);
        return;
      }

      try {
        // Log for debugging
        console.log("Checking role for user:", user.email);
        
        // Try to find user document using their UID
        const userRef = doc(db, "users", user.uid);
        let userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const role = userSnap.data().role;
          console.log("Found role by UID:", role);
          setUserRole(role);
        } else {
          // If not found by UID, try with email format (replacing dots with underscores)
          const emailAsId = user.email.replace(/\./g, "_");
          console.log("Trying with email as ID:", emailAsId);
          
          const emailRef = doc(db, "users", emailAsId);
          userSnap = await getDoc(emailRef);
          
          if (userSnap.exists()) {
            const role = userSnap.data().role;
            console.log("Found role by email ID:", role);
            setUserRole(role);
          } else {
            console.error("User document not found in Firestore for:", user.email);
          }
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setCheckingRole(false);
      }
    };

    if (user) {
      fetchUserRole();
    } else {
      setCheckingRole(false);
    }
  }, [user]);

  // Add debugging for role checks
  useEffect(() => {
    if (!checkingRole) {
      console.log("Current user role:", userRole);
      console.log("Required role for this route:", requiredRole || "none");
    }
  }, [userRole, requiredRole, checkingRole]);

  if (loading || checkingRole) {
    return <p>Loading...</p>;
  }

  // If user is not logged in, redirect to login page
  if (!user) {
    console.log("No user logged in, redirecting to login");
    return <Navigate to="/" />;
  }

  // Check access based on roles
  const hasAccess = 
    // No specific role required - all authenticated users can access
    !requiredRole || 
    // User is super_admin (can access everything)
    userRole === "super_admin" ||
    // User has the specific required role
    userRole === requiredRole ||
    // User_manager can access user management routes
    (userRole === "user_manager" && 
     ["user_manager", "users"].includes(requiredRole)) ||
    // Quote_moderator can access content moderation routes
    (userRole === "quote_moderator" && 
     ["quote_moderator"].includes(requiredRole));

  if (hasAccess) {
    console.log("Access granted");
    return children;
  } else {
    console.log("Access denied, redirecting to dashboard");
    return <Navigate to="/dashboard" />;
  }
};

export default ProtectedRoute;