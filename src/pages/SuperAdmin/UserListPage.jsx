/**
 * @file UserListPage.jsx
 * @description
 * Página para listar y gestionar usuarios (solo superadmin).
 * Muestra la lista de usuarios, permite crear y editar usuarios.
 * Carga los usuarios desde Firebase y los ordena por local y email.
 *
 * Estructura principal:
 * - Carga y ordena usuarios desde Firebase.
 * - Permite navegación a creación y edición de usuarios.
 * - Renderiza tabla con usuarios y estados de carga/error.
 *
 * @author (Documentación) Revisada por GitHub Copilot
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../firebase/firebaseConfig';
import { ref, get, query, orderByChild } from 'firebase/database';


/**
 * Componente de página para listar y gestionar usuarios.
 * Solo accesible para superadministradores.
 * @returns {JSX.Element} Vista de gestión de usuarios.
 */
function UserListPage() {
    // Estados para la lista de usuarios, carga y errores
    const navigate = useNavigate();
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Carga la lista de usuarios al montar el componente
    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            setError('');
            try {
                const usersRef = ref(database, 'users');
                
                const usersQuery = query(usersRef, orderByChild('storeId'));
                const snapshot = await get(usersQuery);

                if (snapshot.exists()) {
                    const usersData = snapshot.val();
                    const loadedUsers = Object.keys(usersData).map(key => ({
                        uid: key,
                        ...usersData[key]
                    }));

                    
                    loadedUsers.sort((a, b) => {
                        const storeA = a.storeId || '';
                        const storeB = b.storeId || '';
                        const emailA = a.email || '';
                        const emailB = b.email || '';

                        if (storeA < storeB) return -1;
                        if (storeA > storeB) return 1;
                        if (emailA < emailB) return -1;
                        if (emailA > emailB) return 1;
                        return 0;
                    });

                    setUsersList(loadedUsers);
                } else {
                    setUsersList([]);
                }
            } catch (err) {
                console.error("Error fetching users:", err);
                 if (err.message && err.message.includes("index")) {
                     setError('Error: Revisa que ".indexOn": ["storeId"] esté definido en las Reglas de Seguridad para /users.');
                 } else {
                    setError('Error al cargar la lista de usuarios. Verifica las Reglas de Seguridad.');
                 }
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []); 

    return (
        
        <div className="page-container" style={{ maxWidth: '950px' }}>
            <h2>Gestión de Usuarios</h2>
            <div className="button-group" style={{ justifyContent: 'flex-end', marginTop: '-20px', marginBottom: '20px' }}>
                <button onClick={() => navigate('/superadmin/users/create')}>+ Crear Usuario</button>
            </div>

            {loading && <p style={{textAlign: 'center'}}>Cargando usuarios...</p>}
            {error && <p className="error-message">{error}</p>}

            {!loading && !error && (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #2c3e50', textAlign: 'left' }}>
                                <th style={{ padding: '8px' }}>Email</th>
                                <th style={{ padding: '8px' }}>Rol</th>
                                <th style={{ padding: '8px' }}>Local</th>
                                <th style={{ padding: '8px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usersList.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No hay usuarios registrados.</td></tr>
                            ) : (
                                
                                usersList.map(user => (
                                    <tr key={user.uid} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '8px' }}>{user.email}</td>
                                        <td style={{ padding: '8px' }}>{user.role}</td>
                                        <td style={{ padding: '8px' }}>{user.storeId || 'N/A'}</td>
                                        <td style={{ padding: '8px' }}>
                                            <button
                                                className="secondary"
                                                style={{ padding: '5px 10px', fontSize: '0.9em', marginTop: 0, marginRight: 0 }}
                                                onClick={() => navigate(`/superadmin/users/edit/${user.uid}`)}
                                            >
                                                Editar
                                            </button>
                                            
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="button-group" style={{marginTop: '30px', justifyContent: 'center'}}>
                <button type="button" className="secondary" onClick={() => navigate('/superadmin')}>Volver</button>
            </div>
        </div>
    );
}

export default UserListPage;