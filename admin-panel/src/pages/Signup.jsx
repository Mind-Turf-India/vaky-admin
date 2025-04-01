import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async () => {
    try {
      setError("");
      setLoading(true);
      
      // Create the user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Format email for document ID by replacing dots with underscores
      const formattedEmail = email.replace(/\./g, "_");
      
      // Store user role in Firestore using the formatted email as document ID
      await setDoc(doc(db, "users", formattedEmail), { 
        email, 
        role: "user",
        uid: user.uid // Storing UID might be useful for reference
      });

      alert("Signup successful! Please login.");
      navigate("/login");
    } catch (error) {
      console.error("Signup Error:", error.message);
      
      if (error.code === "auth/email-already-in-use") {
        setError("This email is already registered");
      } else if (error.code === "auth/weak-password") {
        setError("Password is too weak");
      } else {
        setError("Signup failed: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Signup</h2>
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
        onClick={handleSignup}
        disabled={loading}
      >
        {loading ? "Signing up..." : "Signup"}
      </button>
    </div>
  );
};

export default Signup;