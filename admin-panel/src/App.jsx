import './App.css';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import ManageUsers from "./pages/ManageUsers.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ManagePayments from './pages/ManagePayments.jsx';
import ManageAdmins from './pages/ManageAdmins.jsx';
import Signup from './pages/Signup.jsx';
import ManageQotd from './pages/ManageQotd.jsx';
import ManageCategories from './pages/ManageCategories.jsx';
import ManageTrending from './pages/ManageTrending.jsx';
import ManageFestivals from './pages/ManageFestivals.jsx';
import ManageTotd from './pages/ManageTotd.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        
        {/* Admin-only pages - only accessible to super_admin */}
        <Route path="/admins" element={<ProtectedRoute requiredRole="super_admin"><ManageAdmins /></ProtectedRoute>} />
        
        {/* User management pages - accessible to super_admin and user_manager */}
        <Route path="/users" element={<ProtectedRoute requiredRole="user_manager"><ManageUsers /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute requiredRole="user_manager"><ManagePayments /></ProtectedRoute>} />
        
        {/* Content management pages - accessible to super_admin and quote_moderator */}
        <Route path="/qotd" element={<ProtectedRoute requiredRole="quote_moderator"><ManageQotd /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute requiredRole="quote_moderator"><ManageCategories /></ProtectedRoute>} />
        <Route path="/trending" element={<ProtectedRoute requiredRole="quote_moderator"><ManageTrending /></ProtectedRoute>} />
        <Route path="/festivals" element={<ProtectedRoute requiredRole="quote_moderator"><ManageFestivals /></ProtectedRoute>} />
        <Route path="/totd" element={<ProtectedRoute requiredRole="quote_moderator"><ManageTotd /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;