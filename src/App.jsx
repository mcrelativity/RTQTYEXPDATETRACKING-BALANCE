import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import MainLayout from './layout/MainLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import StockEntryPage from './pages/StockEntryPage';
import CuadraturasPage from './pages/CuadraturasPage';
import RectificarPage from './pages/RectificarPage';

import SuperAdminPage from './pages/SuperAdmin/SuperAdminPage';
import UserListPage from './pages/SuperAdmin/UserListPage';
import UserCreatePage from './pages/SuperAdmin/UserCreatePage';
import UserEditPage from './pages/SuperAdmin/UserEditPage';

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen">Verificando sesión...</div>;
  return currentUser ? children : <Navigate to="/login" replace />;
}

function RoleProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userRole, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen">Verificando permisos...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!userRole || !rolesToCheck.includes(userRole)) {
    console.warn(`Acceso denegado para rol: ${userRole}. Roles permitidos: ${rolesToCheck.join(', ')}`);
    return <Navigate to="/home" replace />;
  }
  return children;
}

function AppRoutes() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="flex justify-center items-center h-screen text-lg">Cargando aplicación...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/home" element={<ProtectedRoute><MainLayout><HomePage /></MainLayout></ProtectedRoute>} />
      <Route path="/stock-entry" element={<ProtectedRoute><MainLayout><StockEntryPage /></MainLayout></ProtectedRoute>} />
      <Route path="/admin" element={<RoleProtectedRoute allowedRoles={['admin', 'superadmin']}><MainLayout><AdminPage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/cuadraturas" element={<RoleProtectedRoute allowedRoles={['admin', 'superadmin']}><MainLayout><CuadraturasPage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/rectificar/:sessionId" element={<RoleProtectedRoute allowedRoles={['admin', 'superadmin']}><MainLayout><RectificarPage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/superadmin" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><SuperAdminPage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/superadmin/users" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><UserListPage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/superadmin/users/create" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><UserCreatePage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/superadmin/users/edit/:userId" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><UserEditPage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/" element={<NavigateToHomeOrLogin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function NavigateToHomeOrLogin() {
    const { currentUser, loading } = useAuth();
    if (loading) return <div className="flex justify-center items-center h-screen">Cargando...</div>;
    return currentUser ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        
        <div className="bg-purple-500 min-h-screen">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
