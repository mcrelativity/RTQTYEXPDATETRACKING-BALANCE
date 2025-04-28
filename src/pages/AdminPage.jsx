import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase/firebaseConfig';
import { ref, get } from 'firebase/database';

function AdminPage() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [allStockData, setAllStockData] = useState(null);
  const [storesData, setStoresData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  useEffect(() => {
    if (userData?.role !== 'admin') {
      setError('Acceso denegado. Se requiere rol de administrador.');
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const stockRef = ref(database, 'stock');
        const stockSnapshot = await get(stockRef);
        setAllStockData(stockSnapshot.exists() ? stockSnapshot.val() : {});

        const storesRef = ref(database, 'stores');
        const storesSnapshot = await get(storesRef);
        setStoresData(storesSnapshot.exists() ? storesSnapshot.val() : {});
      } catch (err) {
        console.error("Error fetching admin data:", err);
        setError('Error al cargar los datos de stock. Revisa las reglas de seguridad.');
        setAllStockData({});
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userData?.role]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return allStockData;
    if (!allStockData) return {};

    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = {};

    Object.entries(allStockData).forEach(([storeId, storeStock]) => {
      const storeMatches = {};
      let storeHasMatches = false;
      Object.entries(storeStock).forEach(([productId, productInfo]) => {
        const matchingEntries = {};
        let productHasMatches = false;
        if (productInfo.entries) {
          Object.entries(productInfo.entries).forEach(([entryId, entry]) => {
            const entryProductName = entry.productName || '';
            const matches =
              productId.toLowerCase().includes(lowerSearchTerm) ||
              entryProductName.toLowerCase().includes(lowerSearchTerm) ||
              (entry.userEmail && entry.userEmail.toLowerCase().includes(lowerSearchTerm)) ||
              (entry.barcodeUsed && entry.barcodeUsed.toLowerCase().includes(lowerSearchTerm)) ||
              String(entry.quantity).includes(lowerSearchTerm) ||
              String(entry.expiryMonth).padStart(2,'0').includes(lowerSearchTerm) ||
              String(entry.expiryYear).includes(lowerSearchTerm) ||
              formatTimestamp(entry.timestamp).toLowerCase().includes(lowerSearchTerm);

            if (matches) {
              matchingEntries[entryId] = entry;
              productHasMatches = true;
              storeHasMatches = true;
            }
          });
        }
        if (productHasMatches) {
           storeMatches[productId] = { ...productInfo, entries: matchingEntries };
        }
      });
      if (storeHasMatches) {
          filtered[storeId] = storeMatches;
      }
    });
    return filtered;
  }, [allStockData, searchTerm]);


  if (loading) {
    return <div className="page-container" style={{marginTop: '20px'}}><p>Cargando datos de administrador...</p></div>;
  }

  if (error) {
     return <div className="page-container" style={{marginTop: '20px'}}><p className="error-message">{error}</p></div>;
  }

  const hasResults = filteredData && Object.keys(filteredData).length > 0;

  return (
    <div className="page-container" style={{marginTop: '20px', maxWidth: '950px'}}>
      <h1>Panel de Administración - Vista General Stock</h1>
      <p>Usuario: {userData?.email} (Rol: {userData?.role})</p>
      {userData?.storeName && <p>Local Asignado (para ingresos): {userData.storeName}</p>}
       <div style={{ margin: '20px 0' }}>
            <input
                type="text"
                placeholder="Buscar por ID/Nombre Producto, Email, Cód. Barras, Cantidad, Fecha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
            />
       </div>
      <hr/>

      {!hasResults && searchTerm && <p>No se encontraron registros que coincidan con "{searchTerm}".</p>}
      {!hasResults && !searchTerm && <p>No hay datos de stock registrados en ningún local.</p>}

      {hasResults &&
        Object.entries(filteredData).map(([storeId, storeStock]) => (
          <details key={storeId} style={{ marginBottom: '15px', borderBottom: '1px solid #eee' }}>
            <summary style={{ cursor: 'pointer', padding: '10px 0', fontSize: '1.3em', fontWeight: 'bold' }}>
              {storesData[storeId]?.name || storeId}
            </summary>
            <div style={{ paddingLeft: '25px', paddingTop: '10px' }}>
              {storeStock && Object.keys(storeStock).length > 0 ? (
                Object.entries(storeStock).map(([productId, productInfo]) => (
                  <div key={productId} style={{ marginBottom: '15px' }}>
                    {/* Ya no mostramos el ID aquí, va dentro del li */}
                    {productInfo.entries && Object.keys(productInfo.entries).length > 0 ? (
                      <ul style={{ listStyle: 'none', paddingLeft: '15px', margin: 0 }}>
                        {Object.entries(productInfo.entries).map(([entryId, entry]) => (
                          // --- LI Modificado ---
                          <li key={entryId} style={{
                              borderBottom: '1px dotted #ccc',
                              padding: '8px 0', // Más padding vertical
                              fontSize: '0.9em',
                              lineHeight: '1.5' // Mejorar espacio entre líneas
                          }}>
                              <strong style={{ display: 'block', marginBottom: '4px', color: '#1a5276' }}>
                                  {entry.productName || `Producto ID: ${productId}`} {/* Nombre o ID si falta */}
                              </strong>
                              <span style={{ color: '#555' }}>
                                  Cant: {entry.quantity} |
                                  Vence: {String(entry.expiryMonth).padStart(2, '0')}/{entry.expiryYear} |
                                  User: {entry.userEmail} |
                                  Fecha: {formatTimestamp(entry.timestamp)} |
                                  Cód. Barra: {entry.barcodeUsed} |
                                  Ref: {productId} {/* ID/Ref al final */}
                              </span>
                          </li>
                          // --- Fin LI Modificado ---
                        ))}
                      </ul>
                    ) : (
                      <p style={{ fontStyle: 'italic', color: '#777', marginLeft: '15px', fontSize: '0.9em' }}>Sin entradas.</p>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ fontStyle: 'italic', color: '#777' }}>Sin productos.</p>
              )}
            </div>
          </details>
        ))
      }

      <div className="button-group" style={{marginTop: '30px'}}>
        <button className="secondary" onClick={() => navigate('/home')}>Volver a Home</button>
      </div>
    </div>
  );
}

export default AdminPage;