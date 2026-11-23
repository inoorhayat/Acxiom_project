import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import Leads from './pages/Leads.jsx';
import Opportunities from './pages/Opportunities.jsx';
import FollowUps from './pages/FollowUps.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import Audit from './pages/Audit.jsx';

// Route guard: anonymous users go to login; role mismatches go to the dashboard
function Protected({ roles, children }) {
  const { isAuthenticated, hasRole } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="leads" element={<Leads />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="followups" element={<FollowUps />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Protected roles={['Admin']}><Users /></Protected>} />
        <Route path="audit" element={<Protected roles={['Admin']}><Audit /></Protected>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
