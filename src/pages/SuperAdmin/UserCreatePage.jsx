import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, database } from '../../firebase/firebaseConfig';


function UserCreatePage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [storeId, setStoreId] = useState('');
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStores = async () => {
            const storesRef = ref(database, 'stores');
            try {
                const snapshot = await get(storesRef);
                if (snapshot.exists()) {
                    const storesData = snapshot.val();
                    const loadedStores = Object.keys(storesData).map(key => ({
                        id: key,
                        name: storesData[key].name || key
                    }));
                    setStores(loadedStores);
                    if(loadedStores.length > 0 && !storeId) { // Evitar resetear si ya hay uno
                        setStoreId(loadedStores[0].id);
                    }
                } else {
                     setStores([]); // Asegurar array vacío si no hay tiendas
                }
            } catch (err) {
                console.error("Error fetching stores:", err);
                setError("Error al cargar lista de tiendas.");
            }
        };
        fetchStores();
    }, [storeId]); // Añadir storeId como dependencia previene loop si se selecciona tienda inicial

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setError('');
        if (!email || !password || !role || !storeId) {
            setError("Todos los campos son requeridos.");
            return;
        }
        if (password.length < 6) {
             setError("La contraseña debe tener al menos 6 caracteres.");
            return;
        }
        setLoading(true);

        let newUserUid = null; // Para guardar el UID temporalmente

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const newUser = userCredential.user;
            newUserUid = newUser.uid; // Guardar el UID
            console.log("Usuario creado en Auth:", newUserUid);

            const userDbRef = ref(database, `users/${newUserUid}`);
            const userData = {
                email: email,
                role: role,
                storeId: storeId
            };

            console.log("Intentando guardar datos con Rol:", role); // Log de depuración
            await set(userDbRef, userData);
            console.log("Datos guardados en RTDB para:", newUserUid);

            // --- WORKAROUND ---
            alert(`Usuario ${email} creado. La sesión del nuevo usuario se cerrará.`);
            await signOut(auth); // Cerrar sesión del NUEVO usuario auto-logueado
            console.log("Sesión del nuevo usuario cerrada.");
            // --- FIN WORKAROUND ---

            navigate('/superadmin/users'); // Volver a la lista

        } catch (err) {
            console.error("Error creating user or saving data:", err);
            if (err.code === 'auth/email-already-in-use') {
                setError('El correo electrónico ya está registrado.');
            } else if (err.code === 'auth/invalid-email') {
                setError('El formato del correo electrónico no es válido.');
            } else if (err.code === 'auth/weak-password') {
                 setError('La contraseña es demasiado débil (mínimo 6 caracteres).');
            } else {
                 // Mostrar error de permiso si falló el set
                setError(`Error en creación/guardado: ${err.message}`);
            }
            // Considerar borrar usuario de Auth si falló RTDB set (lógica compleja)
            // if (newUserUid && err.message.includes("PERMISSION_DENIED")) { ... delete user ... }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container" style={{ maxWidth: '600px' }}>
            <h2>Crear Nuevo Usuario</h2>
            <form onSubmit={handleCreateUser}>
                <div className="input-group">
                    <label htmlFor="email">Email:</label>
                    <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
                </div>
                <div className="input-group">
                    <label htmlFor="password">Contraseña (mínimo 6 caracteres):</label>
                    <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
                </div>
                <div className="input-group">
                    <label htmlFor="role">Rol:</label>
                    <select id="role" value={role} onChange={e => setRole(e.target.value)} required disabled={loading} style={{width: '100%', padding: '10px', border: '1px solid #bdc3c7', borderRadius: '5px'}}>
                        <option value="user">Usuario</option>
                        <option value="admin">Administrador</option>
                        <option value="superadmin">Superadministrador</option>
                    </select>
                </div>
                 <div className="input-group">
                    <label htmlFor="storeId">Local Asignado:</label>
                    <select id="storeId" value={storeId} onChange={e => setStoreId(e.target.value)} required disabled={loading || stores.length === 0} style={{width: '100%', padding: '10px', border: '1px solid #bdc3c7', borderRadius: '5px'}}>
                        {stores.length === 0 ? (
                             <option value="">Cargando locales...</option>
                        ) : (
                           stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)
                        )}
                    </select>
                </div>

                {error && <p className="error-message">{error}</p>}

                <div className="button-group" style={{ justifyContent: 'flex-start', marginTop: '20px' }}>
                    <button type="submit" disabled={loading} style={{marginRight: '10px'}}>
                        {loading ? 'Creando...' : 'Crear Usuario'}
                    </button>
                    <button type="button" className="secondary" onClick={() => navigate('/superadmin/users')} disabled={loading}>
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
}

export default UserCreatePage;