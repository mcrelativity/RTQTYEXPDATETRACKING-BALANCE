import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase/firebaseConfig';
import { ref, get, push, serverTimestamp } from 'firebase/database';

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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  useEffect(() => {
    setProductData(null);
    setProductId(null);
    setError('');
    setSuccessMessage('');
    setQuantity('');
    setExpiryMonth('');
    setExpiryYear('');
  }, [barcodeInput]);

  const handleBarcodeSearch = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) {
      setError('Por favor ingresa un código de barras.');
      return;
    }
    setIsLoadingProduct(true);
    setError('');
    setSuccessMessage('');
    setProductData(null);
    setProductId(null);

    try {
      const barcodeToSearch = barcodeInput.trim();
      const barcodeRefPath = `product_barcodes/${barcodeToSearch}`;
      const barcodeRef = ref(database, barcodeRefPath);
      const barcodeSnapshot = await get(barcodeRef);

      if (!barcodeSnapshot.exists()) {
        throw new Error(`Código de barras "${barcodeToSearch}" no encontrado.`);
      }

      const foundProductId = barcodeSnapshot.val();
      setProductId(foundProductId);

      const productRef = ref(database, `products/${foundProductId}`);
      const productSnapshot = await get(productRef);

      if (!productSnapshot.exists()) {
        throw new Error(`Producto con ID "${foundProductId}" no encontrado.`);
      }
      setProductData(productSnapshot.val());

    } catch (err) {
      console.error("Error searching barcode:", err);
      setError(err.message || 'Error al buscar el producto.');
      setProductData(null);
       setProductId(null);
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleSubmitEntry = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!productData || !productId) {
      setError('Primero debes buscar y encontrar un producto válido.');
      return;
    }
    if (!quantity || parseInt(quantity, 10) <= 0) {
      setError('La cantidad debe ser un número mayor a cero.');
      return;
    }
    if (!expiryMonth || !expiryYear) {
      setError('Debes seleccionar mes y año de vencimiento.');
      return;
    }
     if (!userStoreId) {
         setError('No se pudo determinar la tienda del usuario. Contacta al administrador.');
         console.error("User storeId is missing in context.");
         return;
     }
     if (!currentUser?.email) {
        setError('No se pudo obtener el email del usuario.');
        console.error("currentUser email is missing.");
        return;
     }
     // Añadir la validación del nombre también aquí
     if (!productData.name) {
        setError('Error: Falta el nombre del producto encontrado.');
        console.error("productData.name is missing.");
        return;
     }


    setIsSubmitting(true);

    // --- Objeto entryData con productName añadido ---
    const entryData = {
      quantity: parseInt(quantity, 10),
      expiryMonth: parseInt(expiryMonth, 10),
      expiryYear: parseInt(expiryYear, 10),
      barcodeUsed: barcodeInput.trim(),
      userEmail: currentUser.email,
      productName: productData.name, // <--- ¡LÍNEA AÑADIDA AQUÍ!
      timestamp: serverTimestamp()
    };
    // --- Fin objeto entryData ---

    try {
      const stockEntriesRef = ref(database, `stock/${userStoreId}/${productId}/entries`);
      await push(stockEntriesRef, entryData);

      setSuccessMessage(`¡${quantity} unidad(es) de ${productData.name} ingresadas correctamente!`);
      setBarcodeInput('');
      setProductData(null);
      setProductId(null);
      setQuantity('');
      setExpiryMonth('');
      setExpiryYear('');

    } catch (err) {
      console.error("Error submitting stock entry:", err);
      setError('Error al guardar la entrada de stock. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="page-container">
      <h2>Ingreso de Stock por Código de Barras</h2>

      <form onSubmit={handleBarcodeSearch}>
        <label htmlFor="barcode">Código de Barras:</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            id="barcode"
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Ingresa o escanea el código"
            required
            style={{ flexGrow: 1 }}
          />
          <button type="submit" disabled={isLoadingProduct || !barcodeInput.trim()}>
            {isLoadingProduct ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {error && <p className="error-message">{error}</p>}
      {successMessage && <p style={{color: 'green', textAlign:'center', fontWeight:'bold'}}>{successMessage}</p>}


      {productData && (
        <form onSubmit={handleSubmitEntry} style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '30px' }}>
          <h3>Producto Encontrado:</h3>

          {/* --- Bloque de detalles del producto con <dl> --- */}
          <div className="product-details-list">
            <dl>
              <dt>Código Ref:</dt>
              <dd>{productId}</dd>

              <dt>Nombre:</dt>
              <dd>{productData.name}</dd>

              <dt>Laboratorio:</dt>
              <dd>{productData.laboratory}</dd>
            </dl>
          </div>
          {/* --- Fin del bloque de detalles --- */}


          <div className="quantity-input-container">
            <label htmlFor="quantity">Cantidad:</label>
            <input
              id="quantity"
              type="number"
              className="quantity-input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              required
              disabled={isSubmitting}
            />
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="expiryMonth">Mes Venc.:</label>
              <select
                id="expiryMonth"
                value={expiryMonth}
                onChange={(e) => setExpiryMonth(e.target.value)}
                required
                disabled={isSubmitting}
                style={{width: '100%', padding: '10px',
                border: '1px solid #bdc3c7', borderRadius: '5px'}}
              >
                <option value="">Mes</option>
                {months.map(m => <option key={m} value={m}>{m < 10 ? '0'+m : m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="expiryYear">Año Venc.:</label>
              <select
                id="expiryYear"
                value={expiryYear}
                onChange={(e) => setExpiryYear(e.target.value)}
                required
                disabled={isSubmitting}
                 style={{width: '100%', padding: '10px',
                 border: '1px solid #bdc3c7', borderRadius: '5px'}}
              >
                <option value="">Año</option>
                 {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

           <div className="button-group" style={{marginTop: '25px'}}>
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Ingresando...' : 'Ingresar Stock'}
              </button>
              <button type="button" className="secondary" onClick={() => navigate('/home')} disabled={isSubmitting}>
                 Volver
               </button>
           </div>

        </form>
      )}

       {!productData && (
           <div className="button-group" style={{marginTop: '25px'}}>
                <button type="button" className="secondary" onClick={() => navigate('/home')}>
                    Volver a Inicio
                </button>
           </div>
       )}

    </div>
  );
}

export default StockEntryPage;