import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase/firebaseConfig';
import { ref, get } from 'firebase/database';
import * as XLSX from 'xlsx';

function AdminPage() {
    const { userData } = useAuth();
    const navigate = useNavigate();
    const [allStockData, setAllStockData] = useState(null);
    const [storesData, setStoresData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const searchInputRef = useRef(null);
    const [listKey, setListKey] = useState(0);
    const [selectedEntries, setSelectedEntries] = useState({});

    const currentNow = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentNow.getMonth());
    const [selectedYear, setSelectedYear] = useState(currentNow.getFullYear());

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const currentYearForOptions = currentNow.getFullYear();
    const yearOptions = Array.from({ length: 6 }, (_, i) => currentYearForOptions + i);

    const displayMonthName = monthNames[selectedMonth];
    const pageTitle = `Panel Administración - Stock y F.D.V Ingresados ${displayMonthName} ${selectedYear}`;

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        try { return new Date(timestamp).toLocaleString('es-CL'); }
        catch (e) { return 'Fecha inválida'; }
    };

    useEffect(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
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
        const startOfMonth = new Date(selectedYear, selectedMonth, 1).getTime();
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 1).getTime();
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
                                monthlyEntries[entryId] = { ...entry, entryId: entryId, productId: productId, storeId: storeId };
                                productHasMonthly = true; storeHasMonthly = true;
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

    const allVisibleEntries = useMemo(() => {
        const entries = {};
        if (!filteredData) return entries;
        Object.values(filteredData).forEach(storeStock => {
            Object.values(storeStock).forEach(productInfo => {
                if (productInfo.entries) {
                     Object.values(productInfo.entries).forEach(entry => {
                         entries[entry.entryId] = entry;
                     });
                }
            });
        });
        return entries;
    }, [filteredData]);

    const numVisible = Object.keys(allVisibleEntries).length;
    const numSelected = Object.keys(selectedEntries).length;

    const handleEntrySelectionChange = (entry) => {
        setSelectedEntries(prev => {
            const newSelected = { ...prev };
            if (newSelected[entry.entryId]) delete newSelected[entry.entryId];
            else newSelected[entry.entryId] = entry;
            return newSelected;
        });
    };

    const handleSelectAllVisible = () => setSelectedEntries(allVisibleEntries);
    const handleDeselectAll = () => setSelectedEntries({});

    const prepareDataForExcel = (entriesToExport) => {
        const dataByStore = {};
        Object.values(entriesToExport).forEach(entry => {
            const storeName = storesData[entry.storeId]?.name || entry.storeId;
            if (!dataByStore[storeName]) dataByStore[storeName] = [];
            dataByStore[storeName].push({
                "Código Referencia": entry.productId,
                "Nombre": entry.productName || 'N/A',
                "Cantidad": entry.quantity,
                "Fecha Vencimiento": `                      ${String(entry.expiryMonth).padStart(2, '0')}/${entry.expiryYear}`
            });
        });
        return dataByStore;
    };

    const downloadExcel = (dataByStore, baseFileName) => {
        if (Object.keys(dataByStore).length === 0) { alert("No hay datos para descargar."); return; }
        try {
            const wb = XLSX.utils.book_new();
            Object.entries(dataByStore).forEach(([storeName, sheetData]) => {
                const ws = XLSX.utils.json_to_sheet(sheetData);

                
                const columnWidths = [
                    { wch: 15 }, 
                    { wch: 50 }, 
                    { wch: 10 }, 
                    { wch: 18 }  
                ];
                ws['!cols'] = columnWidths;
                

                XLSX.utils.book_append_sheet(wb, ws, storeName.substring(0, 31));
            });
            const monthNameUpper = monthNames[selectedMonth].toUpperCase();
            const fileName = `${baseFileName}${monthNameUpper}-${selectedYear}.xlsx`;
            XLSX.writeFile(wb, fileName);
        } catch (exportError) {
             console.error("Error generating Excel file:", exportError);
             alert("Error al generar el archivo Excel.");
        }
    };

    const handleDownloadAll = () => {
        const dataToExport = prepareDataForExcel(allVisibleEntries);
        downloadExcel(dataToExport, `vencimientos`);
    };

    const handleDownloadSelected = () => {
        if (numSelected === 0) { alert("No hay registros seleccionados."); return; }
        const dataToExport = prepareDataForExcel(selectedEntries);
        downloadExcel(dataToExport, `vencimientos`);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setListKey(prevKey => prevKey + 1);
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    if (loading) return <div className="page-container" style={{marginTop: '20px'}}><p>Cargando datos...</p></div>;
    if (error) return <div className="page-container" style={{marginTop: '20px'}}><p className="error-message">{error}</p>{(userData?.role === 'admin' || userData?.role === 'superadmin') && (<div className="button-group" style={{justifyContent: 'center'}}><button className='secondary' onClick={()=>navigate('/home')}>Volver</button></div>)}</div>;

    const hasResults = filteredData && numVisible > 0;

    return (
        <div className="page-container" style={{marginTop: '20px', maxWidth: '1050px'}}>
            <h1>{pageTitle}</h1>
            <p>Usuario: {userData?.email} (Rol: {userData?.role})</p>
            {userData?.storeName && <p>Local Asignado (para ingresos): {userData.storeName}</p>}

            <div style={{ marginBottom: '10px', marginTop:'15px', textAlign: 'right' }}>
                 <span style={{fontWeight: 'bold', fontSize: '0.9em', marginRight:'5px', color: '#555'}}>Ver Mes:</span>
                 <select id="month-filter" value={selectedMonth} onChange={(e) => { setSelectedMonth(parseInt(e.target.value, 10)); handleDeselectAll(); }} className="compact-select">
                      {monthNames.map((name, index) => ( <option key={index} value={index}>{name}</option> ))}
                 </select>
                 <select id="year-filter" value={selectedYear} onChange={(e) => { setSelectedYear(parseInt(e.target.value, 10)); handleDeselectAll(); }} className="compact-select">
                      {yearOptions.map(year => ( <option key={year} value={year}>{year}</option> ))}
                 </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 15px 0' }}>
                 <input
                     id="search-input" ref={searchInputRef} autoFocus type="text"
                     placeholder={`Buscar en ${displayMonthName} ${selectedYear}...`}
                     value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                     style={{ flexGrow: 1, padding: '10px' }}
                 />
                 {searchTerm && (
                     <button type="button" onClick={handleClearSearch} title="Limpiar búsqueda"
                         style={{ flexShrink: 0, padding: '6px 12px', fontSize: '0.85em', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '0', textTransform: 'none', letterSpacing: 'normal' }}
                         onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}>
                         Limpiar
                     </button>
                 )}
            </div>

             {(numVisible > 0 || numSelected > 0) && (
                <div className="button-group" style={{ justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', marginBottom: '20px', marginTop:'5px' }}>
                    <div>
                        <button onClick={handleSelectAllVisible} className='secondary' style={{marginRight: '10px', padding: '5px 10px', fontSize: '0.9em', marginTop: 0}} disabled={numVisible === 0}>Seleccionar Todos ({numVisible})</button>
                        <button onClick={handleDeselectAll} className='secondary' style={{padding: '5px 10px', fontSize: '0.9em', marginTop: 0}} disabled={numSelected === 0}>Deseleccionar Todos ({numSelected})</button>
                    </div>
                    <div>
                        <button onClick={handleDownloadAll} style={{marginRight: '10px', padding: '6px 12px', fontSize: '0.9em', marginTop: 0, background: '#17a2b8'}} disabled={numVisible === 0}>Descargar Mes Completo</button>
                        <button onClick={handleDownloadSelected} style={{padding: '6px 12px', fontSize: '0.9em', marginTop: 0}} disabled={numSelected === 0}>Descargar Selección</button>
                    </div>
                </div>
             )}

            <hr style={{marginTop: 0, borderTop: 'none'}}/>

            {!loading && !error && !hasResults && searchTerm && <p>No se encontraron registros en {displayMonthName} {selectedYear} que coincidan con "{searchTerm}".</p>}
            {!loading && !error && !hasResults && !searchTerm && <p>No hay entradas de stock registradas en {displayMonthName} {selectedYear}.</p>}

            <div key={listKey}>
                {hasResults &&
                    Object.entries(filteredData).map(([storeId, storeStock]) => (
                    <details key={storeId} style={{ marginBottom: '15px', borderBottom: '1px solid #eee' }}>
                        <summary style={{ cursor: 'pointer', padding: '10px 0', fontSize: '1.3em', fontWeight: 'bold' }}>
                         {storesData[storeId]?.name || storeId}
                        </summary>
                        <div style={{ paddingLeft: '5px', paddingTop: '10px' }}>
                        {storeStock && Object.keys(storeStock).length > 0 ? (
                            Object.entries(storeStock).map(([productId, productInfo]) => (
                            <div key={productId} style={{ marginBottom: '15px' }}>
                                {productInfo.entries && Object.keys(productInfo.entries).length > 0 ? (
                                <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                                    {Object.entries(productInfo.entries).map(([entryId, entry]) => (
                                    <li key={entryId} style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px dotted #ccc', padding: '8px 0', fontSize: '0.9em', lineHeight: '1.5'}}>
                                        <input
                                            type="checkbox"
                                            checked={!!selectedEntries[entryId]}
                                            onChange={() => handleEntrySelectionChange(entry)}
                                            style={{flexShrink: 0}}
                                            aria-label={`Seleccionar entrada para ${entry.productName || productId}`}
                                        />
                                        <div style={{flexGrow: 1}}>
                                            <strong style={{ display: 'block', marginBottom: '2px', color: '#1a5276', fontSize: 20 }}>
                                                Ref: {productId} - {entry.productName || `ID: ${productId}`}
                                            </strong>
                                            <span style={{ color: '#555', fontSize: 20 }}>
                                                Cant: {entry.quantity} - Vence: {String(entry.expiryMonth).padStart(2, '0')}/{entry.expiryYear}
                                            </span>
                                        </div>
                                    </li>
                                    ))}
                                </ul>
                                ) : ( <p style={{ fontStyle: 'italic', color: '#777', fontSize: '0.9em' }}>Sin entradas.</p> )}
                            </div>
                            ))
                        ) : ( <p style={{ fontStyle: 'italic', color: '#777' }}>Sin productos.</p> )}
                        </div>
                    </details>
                    ))
                }
            </div>

            <div className="button-group" style={{marginTop: '30px', justifyContent: 'center'}}>
                <button className="secondary" onClick={() => navigate('/home')}>Volver a Home</button>
            </div>
        </div>
    );
}

export default AdminPage;