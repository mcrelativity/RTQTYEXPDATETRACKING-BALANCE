/**
 * Página de perfil de usuario (actualmente no está en uso).
 * Estructura y propósito:
 * - Muestra la información básica del usuario autenticado (email, rol, local asignado).
 * - Permite volver a la página principal mediante un botón.
 * - Utiliza el contexto global de autenticación para obtener los datos del usuario.
 *
 * No recibe props. No realiza llamadas externas ni mutaciones de datos.
 *
 * Renderiza:
 * - Un contenedor principal con el título "Perfil de Usuario".
 * - Si hay datos de usuario, muestra email, rol y local asignado.
 * - Si no hay datos, muestra un mensaje de error.
 * - Un botón para volver a Home.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


function UserPage() {
  /**
   * Obtiene los datos del usuario autenticado desde el contexto global.
   * userData: { email: string, role: string, storeName?: string }
   */
  const { userData } = useAuth(); 
  /**
   * Hook para navegación programática entre páginas.
   */
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