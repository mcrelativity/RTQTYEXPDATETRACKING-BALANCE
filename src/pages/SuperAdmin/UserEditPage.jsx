import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ref, get, update } from 'firebase/database';
import { database } from '../../firebase/firebaseConfig';
// Podrías importar funciones de Auth para reset pass, etc.
// import { auth, sendPasswordResetEmail } from '../../firebase/firebaseConfig';

function UserEditPage() {
    const { userId } = useParams(); // Obtener el UID de la URL
    const navigate = useNavigate();

    const [userData, setUserData] = useState(null); // Datos actuales del usuario
    const [role, setRole] = useState('');
    const [storeId, setStoreId] = useState('');
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError('');
            try {
                
                const userRef = ref(database, `users/${userId}`);
                const userSnapshot = await get(userRef);
                if (!userSnapshot.exists()) {
                    throw new Error("Usuario no encontrado.");
                }
                const fetchedUserData = userSnapshot.val();
                setUserData(fetchedUserData);
                setRole(fetchedUserData.role || 'user');
                setStoreId(fetchedUserData.storeId || '');

                // Cargar tiendas
                const storesRef = ref(database, 'stores');
                const storesSnapshot = await get(storesRef);
                 if (storesSnapshot.exists()) {
                    const storesData = storesSnapshot.val();
                    const loadedStores = Object.keys(storesData).map(key => ({
                        id: key,
                        name: storesData[key].name || key
                    }));
                    setStores(loadedStores);
                     
                     if(!storeId && fetchedUserData.storeId) {
                        setStoreId(fetchedUserData.storeId);
                     } else if (!storeId && loadedStores.length > 0 && !fetchedUserData.storeId) {
                         
                         setStoreId(loadedStores[0].id);
                     }
                 } else {
                     setStores([]); 
                     setError("No se encontraron tiendas para asignar.")
                 }

            } catch (err) {
                console.error("Error fetching data for edit:", err);
                setError(err.message || "Error al cargar datos para edición.");
                setUserData(null); 
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userId]); 

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        if (!role || !storeId) {
            setError("Rol y Local Asignado son requeridos.");
            return;
        }
        setSaving(true);

        try {
            const userRef = ref(database, `users/${userId}`);
            const updates = {
                role: role,
                storeId: storeId
                
            };
            await update(userRef, updates);
            setSuccessMessage("¡Datos del usuario actualizados exitosamente!");
            
            setTimeout(() => {
                 navigate('/superadmin/users');
            }, 1500);

        } catch (err) {
            console.error("Error updating user data:", err);
            setError("Error al guardar los cambios.");
        } finally {
            setSaving(false);
        }
    };

     // Función ejemplo para resetear contraseña (requiere importar 'auth')
     // const handleResetPassword = () => {
     //    if(userData?.email) {
     //        sendPasswordResetEmail(auth, userData.email)
     //           .then(() => alert(`Email de reseteo enviado a ${userData.email}`))
     //           .catch(err => setError(`Error al enviar email: ${err.message}`));
     //    } else {
     //        setError("No se puede enviar reseteo, falta email del usuario.");
     //    }
     // };

    if (loading) return <div className="page-container"><p>Cargando datos del usuario...</p></div>;
    if (error && !userData) return <div className="page-container"><p className="error-message">{error}</p></div>; // Error fatal si no cargó nada
    if (!userData) return <div className="page-container"><p>Usuario no encontrado.</p></div>; // Si no hay datos después de cargar

    return (
        <div className="page-container" style={{ maxWidth: '600px' }}>
            <h2>Editar Usuario: {userData.email}</h2>
             {error && <p className="error-message">{error}</p>}
             {successMessage && <p style={{color: 'green', textAlign: 'center', fontWeight:'bold'}}>{successMessage}</p>}

            <form onSubmit={handleSaveChanges}>
                <div className="input-group">
                    <label>Email (No editable aquí):</label>
                    <input type="email" value={userData.email} disabled style={{ background: '#eee' }}/>
                </div>
                <div className="input-group">
                    <label htmlFor="role">Rol:</label>
                     <select id="role" value={role} onChange={e => setRole(e.target.value)} required disabled={saving} style={{width: '100%', padding: '10px', border: '1px solid #bdc3c7', borderRadius: '5px'}}>
                        <option value="user">Usuario</option>
                        <option value="admin">Administrador</option>
                        <option value="superadmin">Superadministrador</option>
                    </select>
                </div>
                 <div className="input-group">
                    <label htmlFor="storeId">Local Asignado:</label>
                     <select id="storeId" value={storeId} onChange={e => setStoreId(e.target.value)} required disabled={saving || stores.length === 0} style={{width: '100%', padding: '10px', border: '1px solid #bdc3c7', borderRadius: '5px'}}>
                        {stores.length === 0 ? (
                             <option value="">Cargando locales...</option>
                        ) : (
                           stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)
                        )}
                    </select>
                </div>

                 <div className="button-group" style={{ justifyContent: 'flex-start', marginTop: '25px' }}>
                    <button type="submit" disabled={saving} style={{marginRight: '10px'}}>
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                    {/* <button type="button" className="secondary" onClick={handleResetPassword} disabled={saving} style={{marginRight: '10px'}}>
                        Resetear Contraseña
                    </button> */}
                    <button type="button" className="secondary" onClick={() => navigate('/superadmin/users')} disabled={saving}>
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
}

export default UserEditPage;