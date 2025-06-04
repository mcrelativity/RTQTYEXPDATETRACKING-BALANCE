/**
 * @file App.jsx
 * @description Componente principal de la aplicación React. Define las rutas, la protección de rutas según autenticación y roles, y el layout general.
 * Documentación Revisada por GitHub Copilot
 */

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

/**
 * Componente de ruta protegida. Solo permite el acceso si el usuario está autenticado.
 * Muestra un mensaje de carga mientras se verifica la sesión.
 * @param {object} props
 * @param {React.ReactNode} props.children - Componentes hijos a renderizar si está autenticado
 */
function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen">Verificando sesión...</div>;
  return currentUser ? children : <Navigate to="/login" replace />;
}

/**
 * Componente de ruta protegida por rol. Permite el acceso solo a usuarios con roles autorizados.
 * Muestra un mensaje de carga mientras se verifica la sesión y los permisos.
 * @param {object} props
 * @param {React.ReactNode} props.children - Componentes hijos a renderizar si el rol es permitido
 * @param {string[]} props.allowedRoles - Lista de roles permitidos
 */
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

/**
 * Componente que define todas las rutas de la aplicación.
 * Incluye protección de rutas por autenticación y por roles.
 */
function AppRoutes() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="flex justify-center items-center h-screen text-lg">Cargando aplicación...</div>;
  }

  return (
    <Routes>
      {/* Ruta de inicio de sesión */}
      <Route path="/login" element={<LoginPage />} />
      {/* Ruta principal protegida */}
      <Route path="/home" element={<ProtectedRoute><MainLayout><HomePage /></MainLayout></ProtectedRoute>} />
      {/* Ruta de ingreso de stock protegida */}
      <Route path="/stock-entry" element={<ProtectedRoute><MainLayout><StockEntryPage /></MainLayout></ProtectedRoute>} />
      {/* Rutas protegidas para administradores y superadministradores */}
      <Route path="/admin" element={<RoleProtectedRoute allowedRoles={['admin', 'superadmin']}><MainLayout><AdminPage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/cuadraturas" element={<RoleProtectedRoute allowedRoles={['admin', 'superadmin']}><MainLayout><CuadraturasPage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/rectificar/:sessionId" element={<RoleProtectedRoute allowedRoles={['admin', 'superadmin']}><MainLayout><RectificarPage /></MainLayout></RoleProtectedRoute>} />
      {/* Rutas exclusivas para superadministrador */}
      <Route path="/superadmin" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><SuperAdminPage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/superadmin/users" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><UserListPage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/superadmin/users/create" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><UserCreatePage /></MainLayout></RoleProtectedRoute>} />
      <Route path="/superadmin/users/edit/:userId" element={<RoleProtectedRoute allowedRoles={['superadmin']}><MainLayout><UserEditPage /></MainLayout></RoleProtectedRoute>} />
      {/* Redirección según estado de autenticación */}
      <Route path="/" element={<NavigateToHomeOrLogin />} />
      {/* Ruta para cualquier otra URL no definida */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * Componente que redirige al usuario a /home si está autenticado o a /login si no lo está.
 * Muestra un mensaje de carga mientras se verifica el estado.
 */
function NavigateToHomeOrLogin() {
    const { currentUser, loading } = useAuth();
    if (loading) return <div className="flex justify-center items-center h-screen">Cargando...</div>;
    return currentUser ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />;
}

/**
 * Componente raíz de la aplicación. Provee el contexto de autenticación y el enrutador principal.
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Fondo general y contenedor principal de la app */}
        <div className="bg-purple-500 min-h-screen">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
