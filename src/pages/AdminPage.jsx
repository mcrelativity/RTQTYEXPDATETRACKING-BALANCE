import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    const searchInputRef = useRef(null);

    const currentNow = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentNow.getMonth());
    const [selectedYear, setSelectedYear] = useState(currentNow.getFullYear());

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const currentYearForOptions = currentNow.getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYearForOptions - i);

    const displayMonthName = monthNames[selectedMonth];
    const pageTitle = `Panel de Administración - Stock Ingresado ${displayMonthName} ${selectedYear}`;

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            return new Date(timestamp).toLocaleString('es-CL');
        } catch (e) {
            return 'Fecha inválida';
        }
    };

    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    useEffect(() => {
        if (!userData || (userData.role !== 'admin' && userData.role !== 'superadmin')) {
            setError('Acceso denegado.'); setLoading(false); return;
        }
        const fetchData = async () => {
            setLoading(true); setError('');
            try {
                const stockRef = ref(database, 'stock');
                const stockSnapshot = await get(stockRef);
                setAllStockData(stockSnapshot.exists() ? stockSnapshot.val() : {});
                const storesRef = ref(database, 'stores');
                const storesSnapshot = await get(storesRef);
                setStoresData(storesSnapshot.exists() ? storesSnapshot.val() : {});
            } catch (err) {
                console.error("Error fetching admin data:", err);
                setError('Error al cargar datos.'); setAllStockData({});
            } finally { setLoading(false); }
        };
        fetchData();
    }, [userData]);

    const filteredData = useMemo(() => {
        

        if (!allStockData) return {};

        
        const monthlyData = {};
        Object.entries(allStockData).forEach(([storeId, storeStock]) => {
            const storeWithMonthlyEntries = {}; let storeHasMonthly = false;
            Object.entries(storeStock).forEach(([productId, productInfo]) => {
                const monthlyEntries = {}; let productHasMonthly = false;
                if (productInfo.entries) {
                    Object.entries(productInfo.entries).forEach(([entryId, entry]) => {
                        const entryTimestamp = Number(entry.timestamp);
                        if (!isNaN(entryTimestamp)) {
                            const entryDate = new Date(entryTimestamp); 
                            
                            if (entryDate.getFullYear() === selectedYear && entryDate.getMonth() === selectedMonth) {
                                monthlyEntries[entryId] = entry;
                                productHasMonthly = true;
                                storeHasMonthly = true;
                            }
                        }
                    });
                }
                if (productHasMonthly) storeWithMonthlyEntries[productId] = { ...productInfo, entries: monthlyEntries };
            });
            if (storeHasMonthly) monthlyData[storeId] = storeWithMonthlyEntries;
        });

        
        if (!searchTerm) return monthlyData;

        const lowerSearchTerm = searchTerm.toLowerCase();
        const finalFiltered = {};
        Object.entries(monthlyData).forEach(([storeId, storeStock]) => {
            const storeMatchesSearch = {}; let storeHasSearchResults = false;
            Object.entries(storeStock).forEach(([productId, productInfo]) => {
                const searchMatchingEntries = {}; let productHasSearchResults = false;
                if (productInfo.entries) {
                    Object.entries(productInfo.entries).forEach(([entryId, entry]) => {
                        const entryProductName = entry.productName || '';
                        const matches = productId.toLowerCase().includes(lowerSearchTerm) ||
                                      entryProductName.toLowerCase().includes(lowerSearchTerm) ||
                                      (entry.userEmail && entry.userEmail.toLowerCase().includes(lowerSearchTerm)) ||
                                      (entry.barcodeUsed && entry.barcodeUsed.toLowerCase().includes(lowerSearchTerm)) ||
                                      String(entry.quantity).includes(lowerSearchTerm) ||
                                      String(entry.expiryMonth).padStart(2,'0').includes(lowerSearchTerm) ||
                                      String(entry.expiryYear).includes(lowerSearchTerm) ||
                                      formatTimestamp(entry.timestamp).toLowerCase().includes(lowerSearchTerm);
                        if (matches) {
                            searchMatchingEntries[entryId] = entry; productHasSearchResults = true; storeHasSearchResults = true;
                        }
                    });
                }
                if (productHasSearchResults) storeMatchesSearch[productId] = { ...productInfo, entries: searchMatchingEntries };
            });
            if (storeHasSearchResults) finalFiltered[storeId] = storeMatchesSearch;
        });
        return finalFiltered;

    }, [allStockData, searchTerm, selectedMonth, selectedYear]);


    if (loading) return <div className="page-container" style={{marginTop: '20px'}}><p>Cargando datos...</p></div>;
    if (error) return <div className="page-container" style={{marginTop: '20px'}}><p className="error-message">{error}</p>{(userData?.role === 'admin' || userData?.role === 'superadmin') && (<div className="button-group" style={{justifyContent: 'center'}}><button className='secondary' onClick={()=>navigate('/home')}>Volver</button></div>)}</div>;

    const hasResults = filteredData && Object.keys(filteredData).length > 0;

    return (
        <div className="page-container" style={{marginTop: '20px', maxWidth: '950px'}}>
            <h1>{pageTitle}</h1>
            <p>Usuario: {userData?.email} (Rol: {userData?.role})</p>
            {userData?.storeName && <p>Local Asignado (para ingresos): {userData.storeName}</p>}

            
            <div style={{ marginBottom: '10px', marginTop:'15px', textAlign: 'right' }}>
                 <span style={{fontWeight: 'bold', fontSize: '0.9em', marginRight:'5px', color: '#555'}}>Ver Mes:</span>
                 <select
                      id="month-filter"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                      className="compact-select"
                  >
                      {monthNames.map((name, index) => (
                          <option key={index} value={index}>{name}</option>
                      ))}
                  </select>
                  <select
                      id="year-filter"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                      className="compact-select"
                   >
                      {yearOptions.map(year => (
                          <option key={year} value={year}>{year}</option>
                      ))}
                  </select>
            </div>
            

            
            <div style={{ margin: '0 0 20px 0' }}>
                 <input
                     id="search-input"
                     ref={searchInputRef}
                     autoFocus
                     type="text"
                     placeholder={`Buscar en ${displayMonthName} ${selectedYear}...`}
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     style={{ width: '100%', padding: '10px' }}
                 />
            </div>
            

            <hr style={{marginTop: 0}}/>

            {!hasResults && searchTerm && <p>No se encontraron registros en {displayMonthName} {selectedYear} que coincidan con "{searchTerm}".</p>}
            {!hasResults && !searchTerm && <p>No hay entradas de stock registradas en {displayMonthName} {selectedYear}.</p>}

            
            {hasResults &&
                Object.entries(filteredData).map(([storeId, storeStock]) => (
                  <details key={storeId} style={{ marginBottom: '15px', borderBottom: '1px solid #eee' }} open={!!searchTerm}>
                    <summary style={{ cursor: 'pointer', padding: '10px 0', fontSize: '1.3em', fontWeight: 'bold' }}>
                      {storesData[storeId]?.name || storeId}
                    </summary>
                    <div style={{ paddingLeft: '25px', paddingTop: '10px' }}>
                      {storeStock && Object.keys(storeStock).length > 0 ? (
                        Object.entries(storeStock).map(([productId, productInfo]) => (
                          <div key={productId} style={{ marginBottom: '15px' }}>
                            {productInfo.entries && Object.keys(productInfo.entries).length > 0 ? (
                              <ul style={{ listStyle: 'none', paddingLeft: '15px', margin: 0 }}>
                                {Object.entries(productInfo.entries).map(([entryId, entry]) => (
                                  <li key={entryId} style={{borderBottom: '1px dotted #ccc', padding: '8px 0', fontSize: '0.9em', lineHeight: '1.5'}}>
                                      <strong style={{ display: 'block', marginBottom: '4px', color: '#1a5276', fontSize: 20 }}>
                                          Ref: {productId} - {entry.productName || `Producto ID: ${productId}`}
                                      </strong>
                                      <span style={{ color: '#555', fontSize: 20 }}>
                                          Cant: {entry.quantity} -
                                          Vence: {String(entry.expiryMonth).padStart(2, '0')}/{entry.expiryYear}
                                      </span>
                                  </li>
                                ))}
                              </ul>
                            ) : ( <p style={{ fontStyle: 'italic', color: '#777', marginLeft: '15px', fontSize: '0.9em' }}>Sin entradas este mes/año.</p> )}
                          </div>
                        ))
                      ) : ( <p style={{ fontStyle: 'italic', color: '#777' }}>Sin productos con entradas este mes/año.</p> )}
                    </div>
                  </details>
                ))
            }

            <div className="button-group" style={{marginTop: '30px', justifyContent: 'center'}}>
                <button className="secondary" onClick={() => navigate('/home')}>Volver a Home</button>
            </div>
        </div>
    );
}

export default AdminPage;