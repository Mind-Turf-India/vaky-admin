// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/dashboard.jsx";
import Login from "./pages/login.jsx";
import ManageQuotes from "./pages/ManageQuotes.jsx";
import ManageUsers from "./pages/ManageUsers.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx"; // You'll create this later
import ManagePayments from './pages/ManagePayments.jsx';
import ManageAdmins from './pages/ManageAdmins.jsx';
import Signup from './pages/Signup.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/quotes" element={<ProtectedRoute><ManageQuotes /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><ManageUsers /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><ManagePayments /></ProtectedRoute>} />
        <Route path="/admins" element={<ProtectedRoute requiredRole="super_admin"><ManageAdmins /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
