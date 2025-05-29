// Página de registro de usuario.
// Permite a un nuevo usuario crear una cuenta con email y contraseña.
// Valida que las contraseñas coincidan y maneja errores comunes de registro.
// Al registrarse exitosamente, guarda el usuario en Firebase y lo redirige al login.
// Documentación detallada en español para cada función y bloque relevante.
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, database } from '../firebase/firebaseConfig';

function SignUpPage() {
  // Estados para los campos del formulario y control de errores/carga
  const [email, setEmail] = useState(''); // Email ingresado por el usuario
  const [password, setPassword] = useState(''); // Contraseña ingresada
  const [confirmPassword, setConfirmPassword] = useState(''); // Confirmación de contraseña
  const [error, setError] = useState(''); // Mensaje de error a mostrar
  const [loading, setLoading] = useState(false); // Estado de carga del botón
  const navigate = useNavigate(); // Hook para navegación programática

  /**
   * Maneja el registro del usuario.
   * Valida que las contraseñas coincidan y crea el usuario en Firebase Auth y Database.
   * Muestra mensajes de error específicos según el código de error recibido.
   * @param {Event} e Evento de submit del formulario
   */
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    // Validación de coincidencia de contraseñas
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      // Crea el usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Guarda información adicional en la base de datos
      await set(ref(database, 'users/' + user.uid), {
        email: user.email,
        role: 'user'
      });

      console.log('Usuario registrado y datos guardados:', user.uid);
      navigate('/login');

    } catch (error) {
      // Manejo de errores de registro
      console.error("Signup error:", error.code, error.message);
      if (error.code === 'auth/email-already-in-use') {
        setError('Este correo electrónico ya está en uso.');
      } else if (error.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else if (error.code === 'auth/invalid-email') {
         setError('El formato del correo electrónico no es válido.');
      } else {
        setError('Error al registrar el usuario. Inténtalo de nuevo.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="page-container"> 
      <h2>Crear Cuenta</h2>
      <form onSubmit={handleSignUp}>
        <div>
          <label htmlFor="signup-email">Email:</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="signup-password">Contraseña:</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="confirm-password">Confirmar Contraseña:</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength="6"
            disabled={loading}
          />
        </div>
        {error && <p className="error-message">{error}</p>} 
        <button type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrarse'}
        </button>
      </form>
      <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
    </div>
  );
}

export default SignUpPage;