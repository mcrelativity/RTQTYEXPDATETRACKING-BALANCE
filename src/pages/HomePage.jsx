/**
 * Página principal de bienvenida.
 * Estructura y propósito:
 * - Permite al usuario navegar a las distintas funcionalidades según su rol (usuario, admin, superadmin).
 * - Muestra botones de navegación condicionales según el rol del usuario autenticado.
 *
 * No recibe props. Utiliza hooks de React Router y el contexto de autenticación.
 *
 * Renderiza:
 * - Un contenedor principal con el título "Bienvenido".
 * - Botones para navegar a Ingreso de Stock, Inventario, Cuadraturas y Panel SuperAdmin (según rol).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


function HomePage() {
  /**
   * Obtiene los datos del usuario autenticado.
   * userData: { email: string, role: string, storeName?: string }
   */
  const { userData } = useAuth();
  /**
   * Hook para navegación programática.
   */
  const navigate = useNavigate();

  /**
   * Determina si el usuario es admin o superadmin.
   */
  const isAdminOrSuperAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';

  /**
   * Ajusta el ancho máximo de la página según el rol.
   */
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
