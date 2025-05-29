// Página principal de bienvenida.
// Permite al usuario navegar a las distintas funcionalidades según su rol (usuario, admin, superadmin).
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function HomePage() {
  // Obtiene los datos del usuario autenticado
  const { userData } = useAuth();
  // Hook para navegación programática
  const navigate = useNavigate();

  // Determina si el usuario es admin o superadmin
  const isAdminOrSuperAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';

  // Ajusta el ancho máximo de la página según el rol
  const calculatedMaxWidth = isAdminOrSuperAdmin ? '600px' : '450px';

  return (
    <div className="page-container" style={{ marginTop: '20px', maxWidth: calculatedMaxWidth }}>
      <h1>Bienvenido</h1>
      <p>Selecciona una acción:</p>

      {/* Botones de navegación según el rol del usuario */}
      <div className="button-group">
        <button onClick={() => navigate('/stock-entry')}>Ingresar Stock y Fecha de Vencimiento</button>

        {/* Solo visible para administradores */}
        {userData?.role === 'admin' && (
          <button className="secondary" onClick={() => navigate('/admin')}>Inventario</button>
        )}

        {/* Visible para admin y superadmin */}
        {isAdminOrSuperAdmin && (
          <button className="secondary" onClick={() => navigate('/cuadraturas')}>CUADRATURAS</button>
        )}

        {/* Solo visible para superadmin */}
        {userData?.role === 'superadmin' && (
          <button className="secondary" onClick={() => navigate('/superadmin')}>Panel SuperAdmin</button>
        )}
      </div>
    </div>
  );
}

export default HomePage;
