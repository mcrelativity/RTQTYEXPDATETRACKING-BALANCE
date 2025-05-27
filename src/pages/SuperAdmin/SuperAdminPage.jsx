// Página principal del panel Superadministrador.
// Permite acceder a la gestión de usuarios y al inventario global.
// Solo accesible para usuarios con rol superadmin.
import React from 'react';
import { Link } from 'react-router-dom';

// Renderiza botones de acceso a las funciones de superadmin
function SuperAdminPage() {
    return (
        <div className="page-container" style={{maxWidth: '600px'}}>
            <h1>Panel Superadministrador</h1>
            <p>Selecciona una opción:</p>
            <div className='button-group' style={{flexDirection: 'column', gap: '10px', alignItems: 'stretch'}}>
                 <Link to="/superadmin/users" style={{ textDecoration: 'none' }}>
                    <button style={{width: '100%', marginTop: 0}}>Gestionar Usuarios</button>
                 </Link>

                 
                 <Link to="/admin" style={{ textDecoration: 'none' }}>
                    <button style={{width: '100%', marginTop: 0}}>Ver Inventario</button>
                 </Link>
                 

                 <Link to="/home" style={{ textDecoration: 'none' }}>
                     <button className="secondary" style={{width: '100%', marginTop: 0}}>Volver a Inicio</button>
                 </Link>
            </div>
        </div>
    );
}

export default SuperAdminPage;