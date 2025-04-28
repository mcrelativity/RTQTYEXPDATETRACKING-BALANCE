import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function UserPage() {
  const { userData } = useAuth(); // Usamos el objeto userData completo
  const navigate = useNavigate();

  return (
    <div className="page-container" style={{marginTop: '20px'}}>
      <h1>Perfil de Usuario</h1>
      {userData ? (
        <>
          <p><strong>Email:</strong> {userData.email}</p>
          <p><strong>Rol:</strong> {userData.role || 'No asignado'}</p>
          <p><strong>Local Asignado:</strong> {userData.storeName || 'No asignado'}</p>
          {/* Podrías añadir opción para cambiar contraseña aquí */}
        </>
      ) : (
        <p>No se pudo cargar la información del usuario.</p>
      )}
       <div className="button-group">
          <button className="secondary" onClick={() => navigate('/home')}>Volver a Home</button>
      </div>
    </div>
  );
}

export default UserPage;