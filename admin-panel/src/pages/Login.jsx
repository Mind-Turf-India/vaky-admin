import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      setError("");
      setLoading(true);
      
      // First authenticate the user
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Format email for document ID by replacing dots with underscores
      const formattedEmail = user.email.replace(/\./g, "_");
      
      // Fetch user role from Firestore using the email-based document ID
      const userRef = doc(db, "users", formattedEmail);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const role = userData.role;
        
        // Redirect based on role
        navigate("/dashboard", { state: { role } });
      } else {
        // No document found with that ID
        setError("User data not found. Please contact support.");
      }
    } catch (error) {
      console.error("Login Error:", error.message);
      setError("Login failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <input 
        type="email" 
        placeholder="Email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
      />
      <input 
        type="password" 
        placeholder="Password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
      />
      <button 
        onClick={handleLogin}
        disabled={loading}
      >
        {loading ? "Logging in..." : "Login"}
      </button>
    </div>
  );
};

export default Login;