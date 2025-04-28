import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase/firebaseConfig';
import { ref, get, push, serverTimestamp } from 'firebase/database';

const DEBOUNCE_DELAY = 500;

function StockEntryPage() {
    const { currentUser, userStoreId } = useAuth();
    const navigate = useNavigate();
    const [barcodeInput, setBarcodeInput] = useState('');
    const [isLoadingProduct, setIsLoadingProduct] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [productData, setProductData] = useState(null);
    const [productId, setProductId] = useState(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [quantity, setQuantity] = useState('');
    const [expiryMonth, setExpiryMonth] = useState('');
    const [expiryYear, setExpiryYear] = useState('');
    const barcodeInputRef = useRef(null);
    const debounceTimeoutRef = useRef(null);

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear + i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const performSearch = useCallback(async (barcodeToSearch) => {
        if (!barcodeToSearch) return;
        setProductData(null); setProductId(null); setError(''); setSuccessMessage('');
        setQuantity(''); setExpiryMonth(''); setExpiryYear('');
        setIsLoadingProduct(true);
        try {
            const barcodeRefPath = `product_barcodes/${barcodeToSearch}`;
            const barcodeRef = ref(database, barcodeRefPath);
            const barcodeSnapshot = await get(barcodeRef);
            if (!barcodeSnapshot.exists()) throw new Error(`Código de barras "${barcodeToSearch}" no encontrado.`);
            const foundProductId = barcodeSnapshot.val();
            setProductId(foundProductId);
            const productRef = ref(database, `products/${foundProductId}`);
            const productSnapshot = await get(productRef);
            if (!productSnapshot.exists()) throw new Error(`Producto con ID "${foundProductId}" no encontrado.`);
            setProductData(productSnapshot.val());
            setError('');
        } catch (err) {
            console.error("Error searching barcode:", err);
            setError(err.message || 'Error al buscar el producto.');
            setProductData(null); setProductId(null);
        } finally {
            setIsLoadingProduct(false);
        }
    }, [database]);

    useEffect(() => {
        const trimmedBarcode = barcodeInput.trim();
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        if (trimmedBarcode) {
            debounceTimeoutRef.current = setTimeout(() => performSearch(trimmedBarcode), DEBOUNCE_DELAY);
        } else {
            setProductData(null); setProductId(null); setError('');
        }
        return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };
    }, [barcodeInput, performSearch]);

    useEffect(() => {
        if (barcodeInputRef.current && !productData) barcodeInputRef.current.focus();
    }, [productData]);

    useEffect(() => {
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    }, []);

    const handleClearForm = () => {
        setBarcodeInput(''); setProductData(null); setProductId(null); setError('');
        setSuccessMessage(''); setQuantity(''); setExpiryMonth(''); setExpiryYear('');
        if (barcodeInputRef.current) setTimeout(() => barcodeInputRef.current.focus(), 0);
    };

    const handleSubmitEntry = async (e) => {
        e.preventDefault();
        setError(''); setSuccessMessage('');
        if (!productData || !productId) { setError('Busca un producto válido.'); return; }
        if (!quantity || parseInt(quantity, 10) <= 0) { setError('Cantidad inválida.'); return; }
        if (!expiryMonth || !expiryYear) { setError('Selecciona mes/año de vencimiento.'); return; }
        if (!userStoreId) { setError('Tienda de usuario no encontrada.'); return; }
        if (!currentUser?.email) { setError('Email de usuario no encontrado.'); return; }
        if (!productData.name) { setError('Nombre de producto no encontrado.'); return;}
        setIsSubmitting(true);
        const entryData = {
            quantity: parseInt(quantity, 10), expiryMonth: parseInt(expiryMonth, 10),
            expiryYear: parseInt(expiryYear, 10), barcodeUsed: barcodeInput.trim(),
            userEmail: currentUser.email, productName: productData.name,
            timestamp: serverTimestamp()
        };
        try {
            const stockEntriesRef = ref(database, `stock/${userStoreId}/${productId}/entries`);
            await push(stockEntriesRef, entryData);
            setSuccessMessage(`¡${quantity} u. de ${productData.name} ingresadas!`);
            handleClearForm();
        } catch (err) {
            console.error("Error submitting stock entry:", err);
            setError('Error al guardar la entrada. Inténtalo de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="page-container stock-entry-layout">

            
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative', marginBottom: '15px' }}>
                 <button
                     onClick={() => navigate('/home')}
                     className="icon-button"
                     title="Ir a Inicio"
                     aria-label="Ir a Inicio"
                     
                     style={{ flexShrink: 0 }} 
                 >
                    <span className="material-symbols-outlined">home</span>
                 </button>
                 <h2 style={{ flexGrow: 1, textAlign: 'center', margin: 0, padding: '0 5px' }}>
                    Ingreso de Stock y Fecha de Vencimiento
                 </h2>
                 {/* Placeholder invisible para balancear el botón home y centrar el título */}
                 {/* Ajusta el width/padding para que coincida visualmente con el botón home */}
                 <div style={{ width: '2.5em', visibility: 'hidden', flexShrink: 0 }}></div>
            </div>
            {/* --- Fin Contenedor Título --- */}


            {/* --- Renderizado Condicional --- */}
            {!productData ? (
                // --- VISTA INICIAL (SIN PRODUCTO ENCONTRADO) ---
                <>
                    {/* Div extra para centrar y limitar ancho del input inicial */}
                    <div className="input-group" style={{ maxWidth: '480px', margin: '40px auto 20px auto' }}>
                        <label htmlFor="barcode">Código de Barras:</label>
                        <input
                            id="barcode"
                            ref={barcodeInputRef}
                            type="text"
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value)}
                            placeholder="Ingresa o escanea el código..."
                            style={{ width: '100%', padding: '10px' }} // Tamaño normal/reducido
                            disabled={isLoadingProduct || isSubmitting }
                        />
                    </div>
                    {isLoadingProduct && <p style={{textAlign: 'center', marginTop: '10px'}}>Buscando...</p>}
                    {error && <p className="error-message">{error}</p>}
                    {successMessage && <p style={{color: 'green', textAlign:'center', fontWeight:'bold'}}>{successMessage}</p>}
                    {!isLoadingProduct && !successMessage && (
                       <div className="button-group" style={{marginTop: '25px', justifyContent: 'center'}}>
                            <button type="button" className="secondary" onClick={() => navigate('/home')}>
                                Volver a Inicio
                            </button>
                       </div>
                     )}
                </>
            ) : (
                // --- VISTA POST-BÚSQUEDA (CON PRODUCTO ENCONTRADO - 2 COLUMNAS) ---
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', paddingTop: '10px', borderTop: '1px solid #eee', marginTop:'20px' }}>

                    {/* --- Columna Izquierda: Búsqueda + Detalles --- */}
                    <div style={{ flex: '1', minWidth: '300px', padding: '0 10px' }}>
                        <div className="input-group" style={{ marginBottom: '20px' }}>
                            <label htmlFor="barcode-search-again" style={{fontSize: '0.9em'}}>Código de Barras:</label>
                            <input
                                id="barcode-search-again"
                                ref={barcodeInputRef}
                                type="text"
                                value={barcodeInput}
                                onChange={(e) => setBarcodeInput(e.target.value)}
                                placeholder="Buscar otro código..."
                                style={{ width: '100%', padding: '8px', marginTop: '3px', fontSize:'0.95em' }}
                                disabled={isSubmitting || isLoadingProduct}
                            />
                             {isLoadingProduct && <p style={{fontSize: '0.9em', textAlign: 'center', marginTop: '5px'}}>Buscando...</p>}
                        </div>

                        <h3 style={{marginTop: 0, marginBottom: '10px'}}>Producto Encontrado:</h3>
                        <div className="product-details-list" style={{marginTop: 0, marginBottom: 0, padding: '10px'}}>
                           <dl>
                               <dt>Código Ref:</dt><dd>{productId}</dd>
                               <dt>Nombre:</dt><dd>{productData.name}</dd>
                               <dt>Laboratorio:</dt><dd>{productData.laboratory}</dd>
                           </dl>
                        </div>
                    </div>

                    {/* --- Columna Derecha: Formulario Ingreso + Acciones --- */}
                    <div style={{ flex: '1', minWidth: '300px', padding: '0 10px' }}>
                        <form onSubmit={handleSubmitEntry}>
                            <div className="input-group">
                               <label htmlFor="quantity">Cantidad:</label>
                               <input id="quantity" type="number" className="quantity-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" required disabled={isSubmitting}/>
                            </div>
                            <div style={{ display: 'flex', gap: '15px' }} className="input-group"> {/* Agrupar selects */}
                               <div style={{ flex: 1 }}>
                                   <label htmlFor="expiryMonth">Mes Venc.:</label>
                                   <select id="expiryMonth" value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value)} required disabled={isSubmitting} style={{width: '100%', padding: '10px', border: '1px solid #bdc3c7', borderRadius: '5px'}}>
                                      <option value="">Mes</option>
                                      {months.map(m => <option key={m} value={m}>{m < 10 ? '0'+m : m}</option>)}
                                   </select>
                               </div>
                               <div style={{ flex: 1 }}>
                                   <label htmlFor="expiryYear">Año Venc.:</label>
                                   <select id="expiryYear" value={expiryYear} onChange={(e) => setExpiryYear(e.target.value)} required disabled={isSubmitting} style={{width: '100%', padding: '10px', border: '1px solid #bdc3c7', borderRadius: '5px'}}>
                                       <option value="">Año</option>
                                       {years.map(y => <option key={y} value={y}>{y}</option>)}
                                   </select>
                               </div>
                            </div>
                            {/* Botones con margen superior reducido */}
                            <div className="button-group" style={{marginTop: '20px', justifyContent: 'flex-start', flexWrap: 'wrap'}}>
                                <button type="submit" disabled={isSubmitting} style={{marginRight: '10px', marginBottom: '10px'}}>
                                   {isSubmitting ? 'Ingresando...' : 'Ingresar Stock'}
                                </button>
                                 <button type="button" className="secondary" onClick={handleClearForm} disabled={isSubmitting} style={{marginRight: '10px', marginBottom: '10px'}}>
                                    Limpiar
                                 </button>
                                
                            </div>
                             
                             {error && !isLoadingProduct && <p className="error-message" style={{marginTop: '15px'}}>{error}</p>}
                             {successMessage && <p style={{color: 'green', textAlign:'center', fontWeight:'bold', marginTop: '15px'}}>{successMessage}</p>}
                        </form>
                    </div>
                </div>
            )}
             

        </div>
    );
}

export default StockEntryPage;