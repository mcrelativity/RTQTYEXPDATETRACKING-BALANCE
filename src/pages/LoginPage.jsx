/**
 * Página de inicio de sesión.
 * Estructura y propósito:
 * - Permite a un usuario autenticarse con email y contraseña.
 * - Muestra mensajes de error si las credenciales son incorrectas o hay problemas de autenticación.
 * - Al iniciar sesión correctamente, redirige al usuario a la página principal (Home).
 *
 * No recibe props. Utiliza hooks de React Router y Firebase Auth.
 *
 * Renderiza:
 * - Un formulario con campos de email y contraseña.
 * - Mensajes de error y feedback.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase/firebaseConfig';


function LoginPage() {
  /**
   * Estados para los campos del formulario y control de errores/carga.
   * email: string - Email ingresado por el usuario.
   * password: string - Contraseña ingresada.
   * error: string - Mensaje de error a mostrar.
   * loading: boolean - Estado de carga del botón.
   */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  /**
   * Hook para navegación programática.
   */
  const navigate = useNavigate();

  /**
   * Maneja el inicio de sesión del usuario.
   * Realiza la autenticación con Firebase y navega a Home si es exitoso.
   * Muestra mensajes de error específicos según el código de error recibido.
   * @param {Event} e Evento de submit del formulario
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/home');
    } catch (error) {
      // Manejo de errores de autenticación
      console.error("Login error:", error.code, error.message);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('Correo electrónico o contraseña incorrectos.');
      } else {
        setError('Error al iniciar sesión. Inténtalo de nuevo.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h2>Iniciar Sesión</h2>
      {/* Formulario de inicio de sesión */}
      <form onSubmit={handleLogin}>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="password">Contraseña:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        {/* Mensaje de error si existe */}
        {error && <p className="error-message">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;