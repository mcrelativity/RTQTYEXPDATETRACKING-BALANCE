/**
 * @file main.jsx
 * @description Punto de entrada principal de la aplicación React. Renderiza el componente raíz y provee el contexto de autenticación global.
 * @author (Documentación revisada) GitHub Copilot
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import './index.css';

// Renderiza la aplicación en el elemento raíz del DOM
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);