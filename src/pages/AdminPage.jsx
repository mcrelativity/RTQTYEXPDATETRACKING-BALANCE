// Página de administración de inventario y stock (solo para admin y superadmin).
// Permite ver, filtrar, buscar y exportar el stock de todos los locales.
// Carga datos de productos, locales, stock y ROPs desde Firebase.
// Permite seleccionar mes y año, buscar productos, y exportar a Excel.
// Muestra mensajes de error y control de acceso según el rol.
// Documentación detallada en español para cada función y bloque relevante.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase/firebaseConfig';
import { ref, get } from 'firebase/database';
import * as XLSX from 'xlsx';

function AdminPage() {
    // Obtiene datos del usuario autenticado
    const { userData } = useAuth();
    // Hook para navegación programática
    const navigate = useNavigate();
    // Estados para datos cargados, filtros, errores y selección
    const [allStockData, setAllStockData] = useState(null);
    const [storesData, setStoresData] = useState({});
    const [productsData, setProductsData] = useState(null);
    const [ropsData, setRopsData] = useState(null);
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
    const pageTitle = `Panel Administración - Stock y F.D.V ${displayMonthName} ${selectedYear}`;

    // Formatea un timestamp a fecha legible
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        try { return new Date(timestamp).toLocaleString('es-CL'); }
        catch (e) { return 'Fecha inválida'; }
    };

    // Enfoca el input de búsqueda al montar el componente
    useEffect(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
    }, []);

    // Carga datos de Firebase al montar o cambiar usuario
    useEffect(() => {
        if (!userData || (userData.role !== 'admin' && userData.role !== 'superadmin')) {
            setError('Acceso denegado.'); setLoading(false); return;
        }
        const fetchData = async () => {
            setLoading(true); setError('');
            try {
                const stockRef = ref(database, 'stock');
                const storesRef = ref(database, 'stores');
                const productsRef = ref(database, 'products');
                const ropsRef = ref(database, 'rops');

                const [stockSnapshot, storesSnapshot, productsSnapshot, ropsSnapshot] = await Promise.all([
                    get(stockRef), get(storesRef), get(productsRef), get(ropsRef)
                ]);

                setAllStockData(stockSnapshot.exists() ? stockSnapshot.val() : {});
                setStoresData(storesSnapshot.exists() ? storesSnapshot.val() : {});
                setProductsData(productsSnapshot.exists() ? productsSnapshot.val() : {});
                setRopsData(ropsSnapshot.exists() ? ropsSnapshot.val() : {});

            } catch (err) {
                console.error("Error fetching admin data:", err);
                setError('Error al cargar datos.');
                setAllStockData({}); setStoresData({}); setProductsData({}); setRopsData({});
            } finally { setLoading(false); }
        };
        fetchData();
    }, [userData]);

    const monthlyFilteredEntries = useMemo(() => {
        const entries = [];
        if (!allStockData) return entries;
        Object.entries(allStockData).forEach(([storeId, storeStock]) => {
            Object.entries(storeStock).forEach(([productId, productInfo]) => {
                if (productInfo.entries) {
                    Object.entries(productInfo.entries).forEach(([entryId, entry]) => {
                        const entryTimestamp = Number(entry.timestamp);
                        if (!isNaN(entryTimestamp)) {
                            const entryDate = new Date(entryTimestamp);
                            if (entryDate.getFullYear() === selectedYear && entryDate.getMonth() === selectedMonth) {
                                entries.push({ ...entry, entryId, productId, storeId });
                            }
                        }
                    });
                }
            });
        });
        return entries;
    }, [allStockData, selectedMonth, selectedYear]);

    const searchedEntries = useMemo(() => {
        if (!searchTerm) return monthlyFilteredEntries;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return monthlyFilteredEntries.filter(entry => {
            const entryProductName = entry.productName || '';
            const mainProductName = productsData?.[entry.productId]?.name || entryProductName;
            return entry.productId.toLowerCase().includes(lowerSearchTerm) ||
                   mainProductName.toLowerCase().includes(lowerSearchTerm) ||
                   (entry.userEmail && entry.userEmail.toLowerCase().includes(lowerSearchTerm)) ||
                   (entry.barcodeUsed && entry.barcodeUsed.toLowerCase().includes(lowerSearchTerm)) ||
                   String(entry.quantity).includes(lowerSearchTerm) ||
                   `${String(entry.expiryMonth).padStart(2,'0')}/${entry.expiryYear}`.includes(lowerSearchTerm) ||
                   formatTimestamp(entry.timestamp).toLowerCase().includes(lowerSearchTerm);
        });
    }, [monthlyFilteredEntries, searchTerm, productsData]);

    const consolidatedViewData = useMemo(() => {
        const dataByStore = {};
        searchedEntries.forEach(entry => {
            const storeId = entry.storeId;
            const consolidationKey = `${entry.productId}_${entry.expiryMonth}_${entry.expiryYear}`;
            if (!dataByStore[storeId]) dataByStore[storeId] = {};
            if (!dataByStore[storeId][consolidationKey]) {
                dataByStore[storeId][consolidationKey] = {
                    productId: entry.productId,
                    productName: productsData?.[entry.productId]?.name || entry.productName || 'N/A',
                    expiryMonth: entry.expiryMonth,
                    expiryYear: entry.expiryYear,
                    totalQuantity: 0
                };
            }
            dataByStore[storeId][consolidationKey].totalQuantity += entry.quantity;
        });
        Object.keys(dataByStore).forEach(storeId => {
             dataByStore[storeId] = Object.values(dataByStore[storeId]).sort((a,b) => {
                const nameA = a.productName.toLowerCase(); const nameB = b.productName.toLowerCase();
                 if (nameA < nameB) return -1; if (nameA > nameB) return 1;
                 const dateA = new Date(a.expiryYear, a.expiryMonth - 1); const dateB = new Date(b.expiryYear, b.expiryMonth - 1);
                 return dateA - dateB;
             });
        });
        return dataByStore;
    }, [searchedEntries, productsData]);

    //Preparar para excel la data, se obtiene toda la información de los productos de la BD y se consolida por local
    const prepareConsolidatedDataForStoreSheet = (storeEntries) => {
        const storeConsolidated = {};
        storeEntries.forEach(entry => {
            const key = `${entry.productId}_${entry.expiryMonth}_${entry.expiryYear}`;
            if (!storeConsolidated[key]) {
                const productName = productsData?.[entry.productId]?.name || entry.productName || 'N/A';
                storeConsolidated[key] = {
                    productId: entry.productId, productName: productName,
                    expiryMonth: entry.expiryMonth, expiryYear: entry.expiryYear, totalQuantity: 0
                };
            }
            storeConsolidated[key].totalQuantity += entry.quantity;
        });
        return Object.values(storeConsolidated).map(item => ({
            "Código Ref": item.productId,
            "Nombre": item.productName,
            "Fecha Vencimiento": `${String(item.expiryMonth).padStart(2, '0')}/${item.expiryYear}`,
            "Cantidad": item.totalQuantity
        })).sort((a, b) => a.Nombre.localeCompare(b.Nombre));
    };
    // Función para descargar el excel de vencimientos del mes por local, asigna a cada local una hoja
    // Se procesa la data ya obtenida y se organiza por local, luego se genera un archivo Excel con una hoja por local, ademas se le da formato/tamaño a las celdas
    const downloadExcelPerStore = (entriesToProcess, baseFileName) => {
        if (entriesToProcess.length === 0) { alert("No hay datos visibles para descargar."); return; }
        const dataByStoreId = {};
        entriesToProcess.forEach(entry => {
            const storeId = entry.storeId;
            if (!dataByStoreId[storeId]) dataByStoreId[storeId] = [];
            dataByStoreId[storeId].push(entry);
        });
        try {
            const wb = XLSX.utils.book_new();
            const sortedStoreIds = Object.keys(dataByStoreId).sort();
            sortedStoreIds.forEach(storeId => {
                const storeEntries = dataByStoreId[storeId];
                const storeName = storesData[storeId]?.name || storeId;
                const sheetDataFormatted = prepareConsolidatedDataForStoreSheet(storeEntries);
                if (sheetDataFormatted.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(sheetDataFormatted);
                    const columnWidths = [ { wch: 15 }, { wch: 60 }, { wch: 18 }, { wch: 10 } ]; ws['!cols'] = columnWidths;
                    const range = XLSX.utils.decode_range(ws['!ref']);
                    const qtyColIndex = 3; // Corregido: El índice de la columna "Cantidad" es 3 (D)
                    const expiryColIndex = 2; // Corregido: El índice de "Fecha Vencimiento" es 2 (C)

                    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                        let cellQty = ws[XLSX.utils.encode_cell({ r: R, c: qtyColIndex })];
                        if (cellQty) {
                            if (!cellQty.s) cellQty.s = {};
                            if (!cellQty.s.alignment) cellQty.s.alignment = {};
                            cellQty.s.alignment.horizontal = 'right';
                        }
                        let cellExpiry = ws[XLSX.utils.encode_cell({ r: R, c: expiryColIndex })];
                         if (cellExpiry) {
                            if (!cellExpiry.s) cellExpiry.s = {};
                            if (!cellExpiry.s.alignment) cellExpiry.s.alignment = {};
                            cellExpiry.s.alignment.horizontal = 'right';
                        }
                    }
                    XLSX.utils.book_append_sheet(wb, ws, storeName.substring(0, 31));
                }
            });
             if (wb.SheetNames.length === 0) { alert("No hay datos válidos para generar el Excel."); return; }
             const monthNameUpper = monthNames[selectedMonth].toUpperCase();
             const fileName = `${baseFileName}${monthNameUpper}-${selectedYear}.xlsx`;
             XLSX.writeFile(wb, fileName);
        } catch (exportError) { console.error("Error generating multi-sheet Excel:", exportError); alert("Error al generar el archivo Excel por local."); }
    };
    // Funcion para descargar excel de todo el inventario en general + rops
     const downloadSingleSheetExcel = (data, sheetName, fileName, columnWidths) => {
         if (!data || data.length === 0) { alert("No hay datos para generar el reporte."); return; }
         try {
             const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data);
             if (columnWidths) ws['!cols'] = columnWidths;
             const range = XLSX.utils.decode_range(ws['!ref']); const headers = data[0] ? Object.keys(data[0]) : [];
             const dateColIndex = headers.indexOf("Fecha de Vencimiento");
             const qtyColIndex = headers.indexOf("Cantidad Total");
             const disponibleColIndex = headers.indexOf("Disponible"); // Para alinear texto si es necesario
             const ropColIndices = headers.map((h, i) => h.startsWith("ROP ") ? i : -1).filter(i => i !== -1);

             if (dateColIndex > -1 || qtyColIndex > -1 || ropColIndices.length > 0 || disponibleColIndex > -1) {
                  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                       let cell;
                       if (dateColIndex > -1) { cell = ws[XLSX.utils.encode_cell({ r: R, c: dateColIndex })]; if (cell) { if (!cell.s) cell.s = {}; if (!cell.s.alignment) cell.s.alignment = {}; cell.s.alignment.horizontal = 'right'; }}
                       if (qtyColIndex > -1) { cell = ws[XLSX.utils.encode_cell({ r: R, c: qtyColIndex })]; if (cell) { if (!cell.s) cell.s = {}; if (!cell.s.alignment) cell.s.alignment = {}; cell.s.alignment.horizontal = 'right'; }}
                       // if (disponibleColIndex > -1) { cell = ws[XLSX.utils.encode_cell({ r: R, c: disponibleColIndex })]; if (cell) { if (!cell.s) cell.s = {}; if (!cell.s.alignment) cell.s.alignment = {}; cell.s.alignment.horizontal = 'left'; }} // Ejemplo, usualmente es left por defecto
                       ropColIndices.forEach(ropColIndex => { cell = ws[XLSX.utils.encode_cell({ r: R, c: ropColIndex })]; if (cell) { if (!cell.s) cell.s = {}; if (!cell.s.alignment) cell.s.alignment = {}; cell.s.alignment.horizontal = 'right'; }});
                 }
               }
             XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
             XLSX.writeFile(wb, fileName);
         } catch (exportError) { console.error("Error generating single sheet Excel:", exportError); alert("Error al generar el archivo Excel."); }
     };

    const handleDownloadVisibleByStore = () => downloadExcelPerStore(searchedEntries, `Vencimientos_`);
     
    const handleDownloadConsolidatedTotalAction = () => {
        if (searchedEntries.length === 0) { alert("No hay registros visibles para generar totales."); return; }
        if (!ropsData || !productsData || !storesData) { alert("Datos ROP, de Productos o de Tiendas no disponibles."); return; }

        const globalTotals = {};
        searchedEntries.forEach(entry => {
            const consolidationKey = `${entry.productId}_${entry.expiryMonth}_${entry.expiryYear}`;
            if (!globalTotals[consolidationKey]) {
                const productName = productsData?.[entry.productId]?.name || entry.productName || 'N/A';
                globalTotals[consolidationKey] = {
                    productId: entry.productId,
                    productName: productName,
                    expiryMonth: entry.expiryMonth,
                    expiryYear: entry.expiryYear,
                    totalQuantity: 0,
                    quantitiesByStore: {}
                };
            }
            globalTotals[consolidationKey].totalQuantity += entry.quantity;
            const currentStoreQuantity = globalTotals[consolidationKey].quantitiesByStore[entry.storeId] || 0;
            globalTotals[consolidationKey].quantitiesByStore[entry.storeId] = currentStoreQuantity + entry.quantity;
        });

        const relevantStoreIdsWithRop = new Set();
        Object.values(globalTotals).forEach(item => {
            const productId = item.productId;
            if (ropsData) { Object.keys(ropsData).forEach(storeId => { if (ropsData[storeId]?.[productId] !== undefined) relevantStoreIdsWithRop.add(storeId); }); }
        });
        const sortedRelevantStoreIds = Array.from(relevantStoreIdsWithRop).sort();

        const excelData = Object.values(globalTotals).map(item => {
            const availableInStoresDetails = Object.entries(item.quantitiesByStore)
                .map(([storeId, qty]) => `${storesData[storeId]?.name || storeId}: ${qty} un`)
                .sort()
                .join(', ');
            // Bases del excel y luego debajo se calculan y agregan los rops por local a cada producto
            const baseRow = {
                "Cod Ref": item.productId,
                "Nombre Producto": item.productName,
                "Fecha de Vencimiento": `${String(item.expiryMonth).padStart(2, '0')}/${item.expiryYear}`,
                "Cantidad Total": item.totalQuantity,
                "Disponible": availableInStoresDetails
            };
            const productIdToLookup = item.productId;
            sortedRelevantStoreIds.forEach(storeId => {
                const headerName = `ROP ${storesData[storeId]?.name || storeId}`;
                const ropPercent = ropsData?.[storeId]?.[productIdToLookup];
                if (ropPercent && typeof ropPercent === 'number' && ropPercent > 0) baseRow[headerName] = Math.floor(item.totalQuantity * ropPercent);
                else baseRow[headerName] = '-';
            });
            return baseRow;
        }).sort((a, b) => {
            if (a["Cod Ref"] < b["Cod Ref"]) return -1;
            if (a["Cod Ref"] > b["Cod Ref"]) return 1;
            const dateA = new Date(parseInt(a["Fecha de Vencimiento"].split('/')[1]), parseInt(a["Fecha de Vencimiento"].split('/')[0]) - 1);
            const dateB = new Date(parseInt(b["Fecha de Vencimiento"].split('/')[1]), parseInt(b["Fecha de Vencimiento"].split('/')[0]) - 1);
            return dateA - dateB;
        });

        const monthNameUpper = monthNames[selectedMonth].toUpperCase();
        const fileName = `totalesROP_${monthNameUpper}-${selectedYear}.xlsx`;
        const sheetName = `totalesROP_${monthNameUpper}-${selectedYear}`;

        const columnWidths = [
            { wch: 22 },
            { wch: 60 },
            { wch: 19 },
            { wch: 15 },
            { wch: 80 }, 
            ...sortedRelevantStoreIds.map(() => ({ wch: 15 }))
        ];

        downloadSingleSheetExcel(excelData, sheetName, fileName, columnWidths);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setListKey(prevKey => prevKey + 1);
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    const handleMonthChange = (e) => setSelectedMonth(parseInt(e.target.value, 10));
    const handleYearChange = (e) => setSelectedYear(parseInt(e.target.value, 10));

    if (loading) return <div className="page-container" style={{marginTop: '20px'}}><p>Cargando datos...</p></div>;
    if (error) return <div className="page-container" style={{marginTop: '20px'}}><p className="error-message">{error}</p>{(userData?.role === 'admin' || userData?.role === 'superadmin') && (<div className="button-group" style={{justifyContent: 'center'}}><button className='secondary' onClick={()=>navigate('/home')}>Volver</button></div>)}</div>;

    const hasResultsToDisplay = consolidatedViewData && Object.keys(consolidatedViewData).length > 0;

    return (
        <div className="page-container" style={{marginTop: '20px', maxWidth: '1050px'}}>
            <h1>{pageTitle}</h1>
            <p>Usuario: {userData?.email} (Rol: {userData?.role})</p>
            {userData?.storeName && <p>Local Asignado (para ingresos): {userData.storeName}</p>}

            <div style={{ marginBottom: '10px', marginTop:'15px', textAlign: 'right' }}>
                 <span style={{fontWeight: 'bold', fontSize: '0.9em', marginRight:'5px', color: '#555'}}>Ver Mes:</span>
                 <select id="month-filter" value={selectedMonth} onChange={handleMonthChange} className="compact-select">
                      {monthNames.map((name, index) => ( <option key={index} value={index}>{name}</option> ))}
                 </select>
                 <select id="year-filter" value={selectedYear} onChange={handleYearChange} className="compact-select">
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

              {searchedEntries.length > 0 && (
                  <div className="button-group" style={{ justifyContent: 'flex-end', padding: '10px 0', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', marginBottom: '20px', marginTop:'5px' }}>
                      <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                          <button onClick={handleDownloadVisibleByStore} style={{padding: '6px 12px', fontSize: '0.9em', marginTop: 0, background: '#ffc107', color: '#212529'}} disabled={searchedEntries.length === 0}>Descargar Vencimientos Mes</button>
                          <button onClick={handleDownloadConsolidatedTotalAction} style={{padding: '6px 12px', fontSize: '0.9em', marginTop: 0, background: '#007bff'}} disabled={searchedEntries.length === 0}>Descargar Totales con ROP</button>
                      </div>
                  </div>
              )}

            <hr style={{marginTop: 0, borderTop: 'none', marginBottom: '20px'}}/>

            {!loading && !error && !hasResultsToDisplay && searchTerm && <p>No se encontraron registros en {displayMonthName} {selectedYear} que coincidan con "{searchTerm}".</p>}
            {!loading && !error && !hasResultsToDisplay && !searchTerm && <p>No hay entradas de stock registradas en {displayMonthName} {selectedYear}.</p>}

            <div key={listKey}>
                {hasResultsToDisplay &&
                    Object.entries(consolidatedViewData).map(([storeId, storeConsolidatedItems]) => (
                    <details key={storeId} open={Object.keys(consolidatedViewData).length === 1 || searchTerm !== ''} style={{ marginBottom: '15px', borderBottom: '1px solid #eee' }}>
                        <summary style={{ cursor: 'pointer', padding: '10px 0', fontSize: '1.3em', fontWeight: 'bold' }}>
                         {storesData[storeId]?.name || storeId}
                        </summary>
                        <div style={{ paddingLeft: '5px', paddingTop: '10px', overflowX:'auto' }}>
                            {storeConsolidatedItems.length > 0 ? (
                                <table style={{width: '100%', borderCollapse: 'collapse', minWidth:'500px'}}>
                                    <thead>
                                        <tr style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>
                                            <th style={{padding: '5px 8px'}}>Código Ref</th>
                                            <th style={{padding: '5px 8px'}}>Nombre Producto</th>
                                            <th style={{padding: '5px 8px', textAlign:'right'}}>Cant Total</th>
                                            <th style={{padding: '5px 8px', textAlign:'right'}}>Vencimiento</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {storeConsolidatedItems.map(item => (
                                            <tr key={item.productId + '_' + item.expiryYear + '_' + item.expiryMonth} style={{borderBottom: '1px dotted #eee'}}>
                                                <td style={{padding: '6px 8px'}}>{item.productId}</td>
                                                <td style={{padding: '6px 8px'}}>{item.productName}</td>
                                                <td style={{padding: '6px 8px', textAlign:'right', fontWeight:'bold'}}>{item.totalQuantity}</td>
                                                <td style={{padding: '6px 8px', textAlign:'right'}}>{String(item.expiryMonth).padStart(2, '0')}/{item.expiryYear}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : ( <p style={{ fontStyle: 'italic', color: '#777' }}>Sin productos con entradas este mes/año.</p> )}
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