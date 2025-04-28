import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import MainLayout from './layout/MainLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage'; // Vista Admin normal (ver stock)
import StockEntryPage from './pages/StockEntryPage';

// Nuevas páginas SuperAdmin
import SuperAdminPage from './pages/SuperAdmin/SuperAdminPage';
import UserListPage from './pages/SuperAdmin/UserListPage';
import UserCreatePage from './pages/SuperAdmin/UserCreatePage';
import UserEditPage from './pages/SuperAdmin/UserEditPage';


function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div>Verificando sesión...</div>;
  return currentUser ? children : <Navigate to="/login" replace />;
}

function RoleProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userRole, loading } = useAuth();
  if (loading) return <div>Verificando permisos...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  // Asegurarse que allowedRoles sea siempre un array
  const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!rolesToCheck.includes(userRole)) {
    console.warn(`Acceso denegado para rol: ${userRole}. Permitidos: ${rolesToCheck}`);
    return <Navigate to="/home" replace />;
  }
  return children;
}

function App() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2em' }}>Cargando aplicación...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        
        <Route path="/home" element={<ProtectedRoute><MainLayout><HomePage /></MainLayout></ProtectedRoute>} />
        <Route path="/stock-entry" element={<ProtectedRoute><MainLayout><StockEntryPage /></MainLayout></ProtectedRoute>} />
        <Route path="/admin" element={<RoleProtectedRoute allowedRoles={['admin', 'superadmin']}><MainLayout><AdminPage /></MainLayout></RoleProtectedRoute>} />

        
        <Route path="/superadmin" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><SuperAdminPage /></MainLayout></RoleProtectedRoute>} />
        <Route path="/superadmin/users" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><UserListPage /></MainLayout></RoleProtectedRoute>} />
        <Route path="/superadmin/users/create" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><UserCreatePage /></MainLayout></RoleProtectedRoute>} />
        <Route path="/superadmin/users/edit/:userId" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><UserEditPage /></MainLayout></RoleProtectedRoute>} />


        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />

      </Routes>
    </Router>
  );
}

export default App;