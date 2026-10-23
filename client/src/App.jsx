import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import AuditLog from './pages/AuditLog.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import Documents from './pages/Documents.jsx';
import Login from './pages/Login.jsx';
import Members from './pages/Members.jsx';
import Register from './pages/Register.jsx';

function GuestOnly() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function ManagerOnly() {
  const { user } = useAuth();
  if (user.role !== 'owner' && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Documents />} />
          <Route path="/documents/:id" element={<DocumentDetail />} />
          <Route element={<ManagerOnly />}>
            <Route path="/members" element={<Members />} />
            <Route path="/audit" element={<AuditLog />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
