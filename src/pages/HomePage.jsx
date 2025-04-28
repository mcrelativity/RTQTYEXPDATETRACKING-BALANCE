import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function HomePage() {
  const { userData } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="page-container" style={{marginTop: '20px'}}>
      <h1>Bienvenido</h1>
      <p>Selecciona una acción:</p>

      <div className="button-group">
          <button onClick={() => navigate('/stock-entry')}>Ingresar Stock y Fecha de Vencimiento</button>

          {/* Botón solo para Admin */}
          {userData?.role === 'admin' && (
              <button className="secondary" onClick={() => navigate('/admin')}>Panel Admin</button>
          )}
          {/* Se eliminó el botón Ver Perfil */}
      </div>
       {/* El botón de Logout está en MainLayout */}
       {/* La info de usuario/rol está en MainLayout */}
    </div>
  );
}

export default HomePage;