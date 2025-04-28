import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layout
import MainLayout from './layout/MainLayout';

// Pages
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
// UserPage ya no se importa
import StockEntryPage from './pages/StockEntryPage';

// Componentes de protección de rutas
function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Verificando sesión...</div>;
  return currentUser ? children : <Navigate to="/login" replace />;
}

function RoleProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userRole, loading } = useAuth();
  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Verificando permisos...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!allowedRoles || !allowedRoles.includes(userRole)) {
    console.warn(`Access denied for role: ${userRole}. Allowed: ${allowedRoles}`);
    return <Navigate to="/home" replace />;
  }
  return children;
}

// Componente principal de la App
function App() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2em' }}>Cargando aplicación...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <MainLayout>
                <HomePage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
         {/* Se eliminó la ruta /profile */}
        <Route
          path="/stock-entry"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StockEntryPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <AdminPage />
              </MainLayout>
            </RoleProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />

      </Routes>
    </Router>
  );
}

export default App;