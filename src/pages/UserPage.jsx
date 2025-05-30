// Página de perfil de usuario. Esta página no esta en uso por ahora!!!1
// Muestra la información básica del usuario autenticado y permite volver a la página principal.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function UserPage() {
  // Obtiene los datos del usuario autenticado desde el contexto global
  const { userData } = useAuth(); 
  // Hook para navegación programática entre páginas
  const navigate = useNavigate();

  return (
    <div className="page-container" style={{marginTop: '20px'}}>
      <h1>Perfil de Usuario</h1>
      {/* Muestra los datos del usuario si están disponibles */}
      {userData ? (
        <>
          <p><strong>Email:</strong> {userData.email}</p>
          <p><strong>Rol:</strong> {userData.role || 'No asignado'}</p>
          <p><strong>Local Asignado:</strong> {userData.storeName || 'No asignado'}</p>
        </>
      ) : (
        <p>No se pudo cargar la información del usuario.</p>
      )}
      {/* Botón para volver a la página principal */}
      <div className="button-group">
        <button className="secondary" onClick={() => navigate('/home')}>Volver a Home</button>
      </div>
    </div>
  );
}

export default UserPage;