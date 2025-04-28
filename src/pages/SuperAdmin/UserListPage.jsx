import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../firebase/firebaseConfig';
import { ref, get, query, orderByChild } from 'firebase/database';

function UserListPage() {
    const navigate = useNavigate();
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            setError('');
            try {
                const usersRef = ref(database, 'users');
                
                const usersQuery = query(usersRef, orderByChild('email'));
                const snapshot = await get(usersQuery);
                if (snapshot.exists()) {
                    const usersData = snapshot.val();
                    
                    const loadedUsers = Object.keys(usersData).map(key => ({
                        uid: key,
                        ...usersData[key]
                    }));
                    setUsersList(loadedUsers);
                } else {
                    setUsersList([]);
                }
            } catch (err) {
                console.error("Error fetching users:", err);
                setError('Error al cargar la lista de usuarios. Verifica las Reglas de Seguridad.');
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