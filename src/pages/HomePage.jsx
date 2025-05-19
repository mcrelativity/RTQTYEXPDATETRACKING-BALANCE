import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function HomePage() {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const isAdminOrSuperAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';

  const calculatedMaxWidth = isAdminOrSuperAdmin ? '600px' : '500px';

  return (
    <div className="page-container" style={{ marginTop: '20px', maxWidth: calculatedMaxWidth }}>
      <h1>Bienvenido</h1>
      <p>Selecciona una acción:</p>

      <div className="button-group">
          <button onClick={() => navigate('/stock-entry')}>Ingresar Stock y Fecha de Vencimiento</button>

          {userData?.role === 'admin' && (
              <button className="secondary" onClick={() => navigate('/admin')}>Inventario</button>
          )}

          {isAdminOrSuperAdmin && (
              <button className="secondary" onClick={() => navigate('/cuadraturas')}>CUADRATURAS</button>
          )}

          {userData?.role === 'superadmin' && (
            <button className="secondary" onClick={() => navigate('/superadmin')}>Panel SuperAdmin</button>
          )}
      </div>
    </div>
  );
}

export default HomePage;
