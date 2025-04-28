import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from "firebase/auth";
import { auth } from '../firebase/firebaseConfig';

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 25px',
  backgroundColor: '#2c3e50',
  color: 'white',
  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
};

const leftSectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  fontSize: '0.9em',
};

const storeNameStyle = {
  fontWeight: 'bold',
  fontSize: '1.1em',
  marginBottom: '3px',
};

const userRoleStyle = {
    opacity: 0.8,
};

const logoutButtonStyle = {
  padding: '8px 15px',
  backgroundColor: '#e74c3c',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  fontSize: '0.9em',
  cursor: 'pointer',
  transition: 'background-color 0.3s ease',
};

function MainLayout({ children }) {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Logout error:", error);
      alert("Error al cerrar sesión.");
    }
  };

  return (
    <div>
      <header style={headerStyle}>
        <div style={leftSectionStyle}>
          <div style={storeNameStyle}>
            {userData?.storeName ? `Local: ${userData.storeName}` : 'Farmacias Galeno'}
          </div>
          <div style={userRoleStyle}>
            {userData?.email} ({userData?.role || 'Usuario'})
          </div>
        </div>
        <button style={logoutButtonStyle} onClick={handleLogout}>
          Cerrar Sesión
        </button>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
}

export default MainLayout;