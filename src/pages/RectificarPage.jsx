// Página de Rectificación de Caja
// ---------------------------------------------
// Este componente permite a los administradores y superadministradores revisar, justificar y rectificar diferencias de caja en sesiones POS.
// Incluye lógica para cargar datos desde Odoo y Firebase, gestionar formularios, justificaciones, gastos, boletas y flujos de aprobación.
// Cada función, hook y bloque relevante está documentado para facilitar el mantenimiento y la comprensión del flujo.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase/firebaseConfig';
import { ref, push, serverTimestamp, get, update, set } from "firebase/database";
import './RectificarConfirmAnimation.css';
import './ModernSkeletonLoader.css';

// --- Componentes auxiliares ---

// Animación de confirmación o error tras enviar solicitud
function RectificarConfirmAnimation({ success, message, desc }) {
  return (
    <div className="rectificar-confirm-anim">
      <span className={`icon material-symbols-outlined ${success ? 'success' : 'error'}`}>{success ? 'check_circle' : 'cancel'}</span>
      <div className="message">{message}</div>
      {desc && <div className="desc">{desc}</div>}
    </div>
  );
}

// Modern Skeleton Loader con estructura similar a la página de rectificación
function RectificarSkeletonLoader() {
  return (
    <div className="modern-skeleton-loader">
      <div className="modern-skeleton-header" />
      <div className="modern-skeleton-form">
        {[...Array(2)].map((_, i) => (
          <div className="modern-skeleton-form-row" key={i}>
            <div className="modern-skeleton-form-label" />
            <div className="modern-skeleton-form-input" />
          </div>
        ))}
      </div>
      <div className="modern-skeleton-table">
        <div className="modern-skeleton-table-header">
          <div className="modern-skeleton-table-header-cell" style={{width: '20%'}} />
          <div className="modern-skeleton-table-header-cell" style={{width: '30%'}} />
          <div className="modern-skeleton-table-header-cell" style={{width: '25%'}} />
          <div className="modern-skeleton-table-header-cell" style={{width: '25%'}} />
        </div>
        {[...Array(4)].map((_, i) => (
          <div className="modern-skeleton-table-row" key={i}>
            <div className="modern-skeleton-table-cell" />
            <div className="modern-skeleton-table-cell" />
            <div className="modern-skeleton-table-cell" style={{width: '25%'}} />
            <div className="modern-skeleton-table-cell" style={{width: '25%'}} />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Configuración de la API y métodos de pago por defecto ---
// Estas constantes definen cómo la aplicación interactúa con servicios externos y cómo entiende los métodos de pago.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_ENDPOINT = `${API_BASE_URL}/odoo`;
const BEARER_TOKEN = import.meta.env.VITE_API_BEARER_TOKEN;

const DEFAULT_PAYMENT_METHODS_CONFIG = [
  { id: 'efectivo', odoo_names: ['Efectivo'], display_name: 'Efectivo', isCash: true },
  { id: 'tarjeta_tbk', odoo_names: ['Tarjeta', 'Transbank SOS'], display_name: 'Tarjeta + Transbank SOS' },
  { id: 'klap', odoo_names: ['Klap'], display_name: 'Klap' },
  { id: 'transferencia', odoo_names: ['Transferencia'], display_name: 'Transferencia' },
  { id: 'planilla', odoo_names: ['Planilla'], display_name: 'Planilla'},
];

// --- Función asíncrona para realizar llamadas a la API de Odoo ---
// Maneja la construcción de la petición POST, incluyendo cabeceras y cuerpo.
// También gestiona errores básicos de respuesta de la API.
async function callOdooApi(apiUrl, requestData) {
  const headers = { 'Content-Type': 'application/json', Authorization: `bearer ${BEARER_TOKEN}` };
  const requestOptions = { method: 'POST', headers: headers, body: JSON.stringify(requestData) };
  try {
    const response = await fetch(apiUrl, requestOptions);
    if (!response.ok) {
      let errorMsg = `Error ${response.status}: ${response.statusText}`;
      try { const errorData = await response.json(); errorMsg = errorData.message || errorData.error || errorMsg; } catch (e) {}
      throw new Error(errorMsg);
    }
    return await response.json();
  } catch (error) { console.error("Error calling Odoo API:", error); throw error; }
}

// --- Función para obtener los datos de pagos de una sesión específica desde Odoo ---
// Utiliza callOdooApi para realizar la petición.
async function fetchSessionPayments(apiUrl, sessionId) {
  if (sessionId === null || sessionId === undefined) return []; // Retorna array vacío si no hay sessionId.
  const requestData = {
    model: "pos.payment",
    filters: [[["session_id", "in", [parseInt(String(sessionId), 10)]], ["pos_order_id.state", "in", ["paid", "invoiced", "done"]]]],
    fields: ["amount:sum", "payment_method_id"], method: "read_group", groupby: ["payment_method_id"]
  };
  return await callOdooApi(apiUrl, requestData);
}

// --- Función para formatear una cadena de fecha/hora a un formato legible local (es-CL) ---
const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return 'N/A';
  try { const date = new Date(dateTimeString); return date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch (e) { return dateTimeString; }
};

// --- Función para formatear un número como moneda chilena (CLP) ---
const formatCurrency = (amount) => {
  const numAmount = parseFloat(String(amount).replace(/\./g, '').replace(/,/g, '.'));
  if (isNaN(numAmount)) return 'N/A';
  return numAmount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// --- Función para parsear y limpiar un valor de input de monto, permitiendo un signo negativo al inicio ---
// Elimina puntos y cualquier caracter no numérico (excepto el signo inicial).
const parseInputAmount = (value) => {
  if (value === null || value === undefined) return '';
  let stringValue = String(value).trim();
  let sign = '';
  if (stringValue.startsWith('-')) {
    sign = '-';
    stringValue = stringValue.substring(1);
  }
  const cleanedValue = stringValue.replace(/\./g, '').replace(/[^0-9]/g, ''); 
  if (cleanedValue === '') {
    return sign && sign === '-' ? '-' : ''; 
  }
  const number = parseInt(cleanedValue, 10);
  if (isNaN(number)) {
    return sign && sign === '-' ? '-' : ''; 
  }
  return sign + number.toString(); 
};

// --- Función recursiva para sanitizar un objeto antes de guardarlo en Firebase ---
// Principalmente convierte valores 'undefined' a 'null', ya que Firebase no maneja bien 'undefined'.
function sanitizeForFirebase(dataObject) {
  if (dataObject === null || typeof dataObject !== 'object') { return dataObject === undefined ? null : dataObject; }
  if (Array.isArray(dataObject)) { return dataObject.map(item => sanitizeForFirebase(item)); }
  const sanitized = {};
  for (const key in dataObject) {
    if (dataObject.hasOwnProperty(key)) {
      const value = dataObject[key];
      // Preserva el objeto especial de Firebase para serverTimestamp.
      if (typeof value === 'object' && value !== null && value['.sv'] === 'timestamp') { sanitized[key] = value; }
      else { sanitized[key] = sanitizeForFirebase(value); }
    }
  }
  return sanitized;
}

// --- Componente principal de la página de Rectificación ---
// Gestiona la lógica de visualización, edición, justificación y envío de solicitudes de rectificación de caja.
// Incluye manejo de estados, hooks de ciclo de vida, lógica de negocio y renderizado condicional.
function RectificarPage() {  
  // --- Hooks de React Router y Auth ---
  const navigate = useNavigate(); // Hook para la navegación programática.
  const location = useLocation(); // Hook para acceder al estado pasado en la navegación.
  const { sessionId } = useParams(); // Hook para obtener el 'sessionId' de los parámetros de la URL.
  const { currentUser, userRole } = useAuth(); // Hook para obtener el usuario actual y su rol.

  // --- Estados principales de la página ---
  // Almacenan datos de la sesión, modo de la página, detalles de pagos, rectificaciones existentes y formularios.
  const [sessionData, setSessionData] = useState(null); // Datos de la sesión POS de Odoo.
  const [pageMode, setPageMode] = useState('view_only'); // Controla el modo de la página: 'create', 'review', 'view_only'.
  const [paymentDetails, setPaymentDetails] = useState([]); // Array con detalles de medios de pago (no efectivo) y sus montos físicos.
  const [existingRectification, setExistingRectification] = useState(null); // Almacena una rectificación ya enviada si se está revisando o viendo.
  
  // --- Estados para los datos del formulario principal ---
  const [mainFormData, setMainFormData] = useState({
    nuevoSaldoFinalRealEfectivo: '', // Input para el monto físico de efectivo.
    superAdminMotivoDecision: '' // Input para los comentarios del superadmin.
  });

  // --- Estados para los datos de justificaciones, gastos y boletas ---
  const [itemJustifications, setItemJustifications] = useState({}); // Objeto para almacenar justificaciones por método de pago.
  const [gastosRendidos, setGastosRendidos] = useState([]); // Array de gastos rendidos.
  const [boletasPendientes, setBoletasPendientes] = useState([]); // Array de boletas pendientes/rectificadas.
  const [gastosSistemaAPI, setGastosSistemaAPI] = useState(0); // Gastos de la sesión según Odoo.
  
  // --- Estados para la UI: carga, errores y feedback unificado ---
  const [isLoading, setIsLoading] = useState(true); // Carga inicial de datos base
  const [error, setError] = useState(''); // Mensaje de error general
  const [success, setSuccess] = useState(''); // Mensaje de éxito para envío final
  
  // Estados para animación de confirmación
  const [showConfirmAnim, setShowConfirmAnim] = useState(false);
  const [confirmAnimSuccess, setConfirmAnimSuccess] = useState(true);
  const [confirmAnimMsg, setConfirmAnimMsg] = useState('');
  const [confirmAnimDesc, setConfirmAnimDesc] = useState('');

  // Estados para feedback temporal unificado
  const [tempNotification, setTempNotification] = useState({
    show: false,
    type: '', // 'draft_saved', 'draft_loaded'
    message: '',
    duration: 3000
  });
  
  // --- Estados para controlar acciones de envío y guardado ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // --- Estados para los modales de ingreso de datos (justificaciones, gastos, boletas) ---
  const [isItemJustificationModalOpen, setIsItemJustificationModalOpen] = useState(false);
  const [currentItemForJustification, setCurrentItemForJustification] = useState(null);
  const [itemJustificationForm, setItemJustificationForm] = useState({ monto: '', motivo: '', tipo: 'faltante' });

  const [isGastoModalOpen, setIsGastoModalOpen] = useState(false);
  const [gastoForm, setGastoForm] = useState({ monto: '', comprobante: '', motivo: '' });

  const [isBoletaModalOpen, setIsBoletaModalOpen] = useState(false);
  const [boletaForm, setBoletaForm] = useState({ monto: '', numeroBoleta: '', estadoBoleta: 'Pendiente' });  
  
  const [isViewJustificationsModalOpen, setIsViewJustificationsModalOpen] = useState(false);  
  const [justificationsToViewInfo, setJustificationsToViewInfo] = useState({ name: '', justifications: [] });

  // Estados optimizados para el manejo de borradores
  const [draftState, setDraftState] = useState({
    pending: null,        // Borrador pendiente de aplicar
    lastEditInfo: null,   // Info de última edición
    isLoading: false,     // Solo para la carga desde Firebase
    hasShownNotification: false  // Bandera para controlar notificación única
  });
    // Estado unificado de carga
  const [loadingState, setLoadingState] = useState({
    isInitialLoading: true,    // Carga inicial de datos
    isReadyToShow: false,      // UI principal lista para mostrar
    hasError: false,           // Si hay algún error crítico
    isDraftBeingApplied: false // Flag para indicar que se está aplicando borrador
  });

  // Refs para evitar bucles infinitos
  const hasDraftBeenProcessedRef = useRef(false);
  const sessionIdRef = useRef(null);

  // --- Funciones useCallback ---
  
  // --- Función utilitaria para mostrar notificaciones temporales ---
  const showTempNotification = useCallback((type, message, duration = 3000) => {
    setTempNotification({ show: true, type, message, duration });
    setTimeout(() => {
      setTempNotification(prev => ({ ...prev, show: false }));
    }, duration);  
  }, []);

  // --- Función utilitaria para debugging del estado del formulario ---
  const logCurrentFormState = useCallback((moment) => {
    console.log(`[DEBUG] Estado del formulario ${moment}:`, {
      mainFormData: mainFormData,
      itemJustifications: itemJustifications,
      gastosRendidos: gastosRendidos,
      boletasPendientes: boletasPendientes,
      paymentDetails: paymentDetails,
      loadingState: loadingState
    });
  }, [mainFormData, itemJustifications, gastosRendidos, boletasPendientes, paymentDetails, loadingState]);

  // --- Función optimizada para aplicar borrador de forma directa y confiable ---
  const applyDraftDataDirectly = useCallback(async (draftData) => {
    console.log('[RectificarPage] Aplicando borrador directamente:', draftData);
    console.log('[DEBUG] Estado del formulario ANTES de aplicar borrador');
    try {
      // Preparar nuevos estados
      const updates = {};
      if (draftData.mainFormData?.nuevoSaldoFinalRealEfectivo !== undefined || draftData.mainFormData?.superAdminMotivoDecision !== undefined) {
        updates.mainFormData = {
          ...(draftData.mainFormData.nuevoSaldoFinalRealEfectivo !== undefined && { nuevoSaldoFinalRealEfectivo: String(draftData.mainFormData.nuevoSaldoFinalRealEfectivo) }),
          ...(draftData.mainFormData.superAdminMotivoDecision !== undefined && { superAdminMotivoDecision: String(draftData.mainFormData.superAdminMotivoDecision) })
        };
      }
      if (draftData.itemJustifications && typeof draftData.itemJustifications === 'object') {
        updates.itemJustifications = { ...draftData.itemJustifications };
      }
      if (Array.isArray(draftData.gastosRendidos)) {
        updates.gastosRendidos = [...draftData.gastosRendidos];
      }
      if (Array.isArray(draftData.boletasPendientes)) {
        updates.boletasPendientes = [...draftData.boletasPendientes];
      }
      if (Array.isArray(draftData.paymentDetails)) {
        updates.paymentDetails = draftData.paymentDetails.map(p => ({ ...p, fisicoEditable: String(p.fisicoEditable || ''), sistema: Number(p.sistema || 0) }));
      }
      // Aplicar todos los estados en un solo flushSync para evitar re-renderes intermedios
      flushSync(() => {
        if (updates.mainFormData) setMainFormData(prev => ({ ...prev, ...updates.mainFormData }));
        if (updates.itemJustifications) setItemJustifications(updates.itemJustifications);
        if (updates.gastosRendidos) setGastosRendidos(updates.gastosRendidos);
        if (updates.boletasPendientes) setBoletasPendientes(updates.boletasPendientes);
        if (updates.paymentDetails) setPaymentDetails(updates.paymentDetails);
      });
      console.log('[RectificarPage] Borrador aplicado exitosamente - estados actualizados');
      console.log('[DEBUG] Estado del formulario DESPUÉS de aplicar borrador');
    } catch (error) {
      console.error('[RectificarPage] Error aplicando borrador:', error);
    }
  }, []);

  // Función simplificada para verificar si hay datos de borrador válidos
  const hasDraftData = useCallback((draft) => {
    return draft && (
      draft.mainFormData?.nuevoSaldoFinalRealEfectivo ||
      (draft.itemJustifications && Object.keys(draft.itemJustifications || {}).length > 0) ||
      (Array.isArray(draft.gastosRendidos) && draft.gastosRendidos.length > 0) ||
      (Array.isArray(draft.boletasPendientes) && draft.boletasPendientes.length > 0) ||
      (Array.isArray(draft.paymentDetails) && draft.paymentDetails.length > 0)
    );
  }, []);

  // --- Función memoizada para cargar los datos iniciales de la sesión desde Odoo y Firebase ---
  // Esta función establece los datos base de la sesión, pagos, y cualquier rectificación existente.
  // Es el primer paso en la carga de datos de la página.
  const loadInitialData = useCallback(async (passedSessionData, passedMode, passedReqId, urlSessionIdParam) => {
    setIsLoading(true); setError(''); setSuccess('');

    let sessionToUse = passedSessionData;
    let modeToUse = passedMode || 'view_only';
    let reqIdToUse = passedReqId;
  
    if (urlSessionIdParam && (!sessionToUse || sessionToUse.id.toString() !== urlSessionIdParam)) {
      if (!sessionToUse) {
        sessionToUse = { id: parseInt(urlSessionIdParam, 10), name: `Sesión ${urlSessionIdParam}` };
      }
    }
    if (!sessionToUse) { setError("Datos de sesión no disponibles."); setIsLoading(false); return; }
  
    setSessionData(sessionToUse);
    setPageMode(modeToUse); 
    setGastosSistemaAPI(Math.abs(parseFloat(sessionToUse.cash_real_transaction) || 0));
  
    try {
      const odooPayments = await fetchSessionPayments(API_ENDPOINT, sessionToUse.id);
      let loadedExistingRectification = null;
      const initialItemJustifications = {};
  
      if ((modeToUse === 'review' || modeToUse === 'view_only') && reqIdToUse) {
        const requestRef = ref(database, `rectificationRequests/${reqIdToUse}`);
        const snapshot = await get(requestRef);
        if (snapshot.exists()) {
          loadedExistingRectification = { ...snapshot.val(), requestId: reqIdToUse };
          setExistingRectification(loadedExistingRectification);
  
          const justificacionesPorMetodoLoaded = loadedExistingRectification.rectificationDetails?.justificacionesPorMetodo || {};
          for (const methodName in justificacionesPorMetodoLoaded) {
            if (justificacionesPorMetodoLoaded[methodName] && Array.isArray(justificacionesPorMetodoLoaded[methodName].justificaciones)) {
              initialItemJustifications[methodName] = justificacionesPorMetodoLoaded[methodName].justificaciones;
            } else {
              initialItemJustifications[methodName] = [];
            }
          }
          setItemJustifications(initialItemJustifications);
          setGastosRendidos(loadedExistingRectification.rectificationDetails?.gastosRendidos || []);
          setBoletasPendientes(loadedExistingRectification.rectificationDetails?.boletasPendientesRegistradas || []);
        } else {
          setError('Solicitud de rectificación asociada no encontrada.');
          if (userRole === 'admin' && sessionToUse.rectificationStatus === 'sin_rectificar') {
            setPageMode('create'); 
            modeToUse = 'create'; 
          }
        }
      } else if (modeToUse === 'create') {
        setExistingRectification(null); setItemJustifications({}); setGastosRendidos([]); setBoletasPendientes([]);
      }
  
      const initialPaymentDetails = DEFAULT_PAYMENT_METHODS_CONFIG.map(defaultMethod => {
        if (defaultMethod.isCash) return null;
        let odooAmount = 0;
        defaultMethod.odoo_names.forEach(nameVariant => {
          const foundPayment = odooPayments.find(p => (Array.isArray(p.payment_method_id) ? p.payment_method_id[1] : '') === nameVariant);
          if (foundPayment) odooAmount += (parseFloat(foundPayment.amount ?? 0) || 0);
        });
  
        const existingDetailInRect = loadedExistingRectification?.rectificationDetails?.justificacionesPorMetodo?.[defaultMethod.display_name];
        let fisicoEditable = '';
        if (modeToUse !== 'create' && existingDetailInRect?.montoFisicoIngresado !== undefined) {
            fisicoEditable = existingDetailInRect.montoFisicoIngresado.toString();
        }
  
        return {
          id: defaultMethod.id,
          name: defaultMethod.display_name,
          sistema: odooAmount,
          fisicoEditable: fisicoEditable
        };
      }).filter(p => p !== null);
      setPaymentDetails(initialPaymentDetails);      const efectivoFisicoOdoo = sessionToUse.cash_register_balance_end_real;
      const efectivoFisicoInicialParaForm = (modeToUse !== 'create' && loadedExistingRectification?.rectificationDetails?.ajusteSaldoEfectivo?.montoAjustado !== undefined)
        ? loadedExistingRectification.rectificationDetails.ajusteSaldoEfectivo.montoAjustado.toString()
        : (efectivoFisicoOdoo === null || efectivoFisicoOdoo === undefined ? '' : String(efectivoFisicoOdoo));      // Solo establecer los datos del formulario si NO hay un borrador siendo aplicado
      // Verificar el estado de carga del borrador en lugar de la existencia del borrador
      setMainFormData({
        nuevoSaldoFinalRealEfectivo: efectivoFisicoInicialParaForm,
        superAdminMotivoDecision: (modeToUse === 'create' || !loadedExistingRectification) ? '' : (loadedExistingRectification?.rejectionReason || ''),
      });
      // Eliminar cualquier bucle: no se mantiene el estado anterior, solo se setea una vez.
    } catch (err) { setError('Error al cargar datos detallados.'); }
    finally { setIsLoading(false); }
  }, [userRole]);// --- useEffect para la carga inicial de datos cuando el componente se monta o sessionId/location.state cambian ---
  // Efecto unificado: carga inicial + borrador antes de renderizar UI
  // Maestro effect: cargar datos iniciales y aplicar borrador con retry
  useEffect(() => {
    if (!sessionId || !(userRole === 'admin' || userRole === 'superadmin')) return;
    let cancelled = false;
    (async () => {
      // 1) Ocultar UI y marcar arranque
      setLoadingState(s => ({ ...s, isReadyToShow: false, isDraftBeingApplied: true }));
      try {
        // 2) Carga inicial de datos (Odoo + rectificación existente)
        await loadInitialData(
          location.state?.sessionInitialData,
          location.state?.mode,
          location.state?.existingRequestId,
          sessionId
        );
        if (cancelled) return;
        // 3) Intentar cargar borrador hasta 3 veces si existe
        const draftRef = ref(database, `rectificationDrafts/${sessionId}`);
        for (let attempt = 1; attempt <= 3 && !cancelled; attempt++) {
          const snap = await get(draftRef);
          if (cancelled) return;
          if (snap.exists()) {
            const draft = snap.val();
            console.log(`Borrador encontrado en intento ${attempt}`);
            // guardar info de última edición
            setDraftState(d => ({ ...d, lastEditInfo: draft.lastEdited || null }));
            // aplicar borrador y esperar commit de estado
            await applyDraftDataDirectly(draft);
            // pequeño retraso para asegurar render de nuevos estados
            await new Promise(res => setTimeout(res, 300));
            showTempNotification('draft_loaded', 'Borrador cargado exitosamente');
            break;
          }
          console.warn(`Borrador no hallado, reintentando ${attempt}/3`);
          await new Promise(res => setTimeout(res, 300));
        }
      } catch (e) {
        console.error('Error unificado inicializando rectificar:', e);
        setLoadingState(s => ({ ...s, hasError: true }));
      } finally {
        if (!cancelled) {
          // 4) Mostrar UI definitiva
          setLoadingState(s => ({ ...s, isReadyToShow: true, isDraftBeingApplied: false }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, userRole, loadInitialData]);
  const handleSaveDraft = async () => {
    if (!sessionData || userRole !== 'admin' || pageMode !== 'create') {
      setError("Solo los administradores pueden guardar borradores en modo creación.");
      return;
    }
    
    setIsSavingDraft(true);
    setError('');
    setSuccess('');
    
    try {
      const draftRef = ref(database, `rectificationDrafts/${sessionData.id}`);
      const lastEditedInfo = {
        email: currentUser?.email || 'N/A',
        timestamp: Date.now()
      };
      
      const draftDataToSave = {
        // Guardar todos los campos del formulario principal
        mainFormData: { ...mainFormData },
        itemJustifications,
        gastosRendidos,
        boletasPendientes,
        paymentDetails,
        lastEdited: lastEditedInfo
      };
      
      await set(draftRef, sanitizeForFirebase(draftDataToSave));
      
      // Actualizar estado del borrador
      setDraftState(prev => ({ 
        ...prev, 
        lastEditInfo: lastEditedInfo 
      }));
      
      showTempNotification('draft_saved', 'Borrador guardado exitosamente');
      
    } catch (err) {
      console.error("Error guardando borrador:", err);
      setError('Error al guardar borrador: ' + err.message);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // --- Elimina el borrador colaborativo después de enviar la solicitud ---
  const clearDraftAfterSubmit = async () => {
    if (sessionData?.id) {
      try {
        const draftRef = ref(database, `rectificationDrafts/${sessionData.id}`);
        await set(draftRef, null);
      } catch (err) {
        console.error("Error limpiando borrador:", err);
      }
    }
  };

  const handleAmountInputChange = (setterFunction, fieldName, rawValue) => {
      const parsedValue = parseInputAmount(rawValue);
      setterFunction(prev => ({...prev, [fieldName]: parsedValue }));
  };
  
  const handleMainFormChange = (e) => {
      const {name, value} = e.target;
      if(name === 'nuevoSaldoFinalRealEfectivo'){
          handleAmountInputChange(setMainFormData, name, value);
      } else {
          setMainFormData(prev => ({ ...prev, [name]: value }));
      }
  };

  const handlePaymentDetailChange = (itemName, field, rawValue) => {
    const parsedValue = parseInputAmount(rawValue);
    setPaymentDetails(prevDetails => prevDetails.map(item => item.name === itemName ? { ...item, [field]: parsedValue } : item));
  };
  
  const openItemJustificationModal = (item) => {
    setCurrentItemForJustification(item);
    setItemJustificationForm({ monto: '', motivo: '', tipo: 'faltante' });
    setIsItemJustificationModalOpen(true);
  };
  const handleItemJustificationFormChange = (e) => {
    const {name, value} = e.target;
    if(name === 'monto'){
        const cleaned = value.replace(/[^0-9]/g, '');
        setItemJustificationForm(prev => ({ ...prev, [name]: cleaned }));
    } else {
        setItemJustificationForm(prev => ({ ...prev, [name]: value }));
    }
  };
  // --- Guardar justificación de ítem en el estado correspondiente ---
  const handleSaveItemJustification = (e) => {
    e.preventDefault();
    const monto = parseFloat(itemJustificationForm.monto);
    const tipo = itemJustificationForm.tipo || 'faltante';
    if (isNaN(monto) || monto <=0 || itemJustificationForm.motivo.trim() === '') { 
        alert('Monto (mayor a cero) y motivo son requeridos para la justificación.'); return; 
    }
    if (itemJustificationForm.motivo.trim().length > 100) {
        alert('El motivo no puede exceder los 100 caracteres.'); return;
    }
    const keyToUpdate = currentItemForJustification.id === 'efectivo'
      ? DEFAULT_PAYMENT_METHODS_CONFIG.find(m => m.isCash).display_name
      : currentItemForJustification.name;
    setItemJustifications(prev => {
      const existingJustsArray = prev[keyToUpdate] || [];
      const montoFinal = tipo === 'sobrante' ? -Math.abs(monto) : Math.abs(monto);
      const newJustificationEntry = { monto: montoFinal, motivo: itemJustificationForm.motivo.trim(), tipo, timestamp: Date.now() };
      return { ...prev, [keyToUpdate]: [...existingJustsArray, newJustificationEntry] };
    });
    setIsItemJustificationModalOpen(false);
  };
  
  // --- Abrir modal para agregar un gasto rendido ---
  const openGastoModal = () => { setGastoForm({monto: '', comprobante: '', motivo: ''}); setIsGastoModalOpen(true);};
  // --- Manejo de cambios en el formulario de gasto ---
  const handleGastoFormChange = (e) => {
      const {name, value} = e.target;
      if(name === 'monto'){
          const cleaned = value.replace(/[^0-9]/g, '');
          setGastoForm(prev => ({ ...prev, [name]: cleaned }));
      } else {
          setGastoForm(prev => ({ ...prev, [name]: value }));
      }
  };
  // --- Guardar gasto rendido en el estado correspondiente ---
  const handleSaveGasto = (e) => {
    e.preventDefault();
    const monto = parseFloat(gastoForm.monto);
    if (isNaN(monto) || monto <= 0 || gastoForm.motivo.trim() === '') { alert('Monto válido y motivo son requeridos.'); return; }
    if (!gastoForm.comprobante || gastoForm.comprobante.trim() === '') { alert('El número de comprobante es requerido.'); return; }
    if (gastoForm.motivo.trim().length > 50) { alert('El motivo del gasto no puede exceder los 50 caracteres.'); return; }

    setGastosRendidos(prev => [...prev, { ...gastoForm, monto, timestamp: Date.now() }]);
    setIsGastoModalOpen(false);
  };

  // --- Abrir modal para agregar una boleta pendiente/rectificada ---
  const openBoletaModal = () => { setBoletaForm({monto: '', numeroBoleta: '', estadoBoleta: 'Pendiente'}); setIsBoletaModalOpen(true);};
  // --- Manejo de cambios en el formulario de boleta ---
  const handleBoletaFormChange = (e) => {
    const {name, value} = e.target;
    if(name === 'monto'){
        const cleaned = value.replace(/[^0-9]/g, '');
        setBoletaForm(prev => ({ ...prev, [name]: cleaned }));
    } else {
        setBoletaForm(prev => ({ ...prev, [name]: value }));
    }
  };
  // --- Guardar boleta ingresada en el estado correspondiente ---
  const handleSaveBoleta = (e) => {
    e.preventDefault();
    const monto = parseFloat(boletaForm.monto);
    if (isNaN(monto) || monto <= 0 || boletaForm.numeroBoleta.trim() === '') { alert('Monto válido y número de boleta son requeridos.'); return; }
    setBoletasPendientes(prev => [...prev, { ...boletaForm, monto, timestamp: Date.now() }]);
    setIsBoletaModalOpen(false);
  };

  // --- Iniciar proceso de envío de solicitud de rectificación (abre modal de confirmación) ---
  const handleSubmitRectification = async (e) => {
    if (e) e.preventDefault();
    setShowConfirmModal(true);
  };

  // --- Enviar solicitud de rectificación a Firebase ---
  const doSubmitRectification = async () => {
    if (!sessionData || userRole !== 'admin') {
      setError("Solo los administradores pueden enviar solicitudes de rectificación.");
      setIsSubmitting(false);
      setShowConfirmModal(false);
      return;
    }
    setError(''); setSuccess(''); setIsSubmitting(true);

    const saldoEfectivoFisicoOdooParsed = parseFloat(sessionData.cash_register_balance_end_real);
    const saldoEfectivoFormulario = mainFormData.nuevoSaldoFinalRealEfectivo.trim();
    let saldoEfectivoFinalParaGuardar;

    if (saldoEfectivoFormulario === '') {
      setError('El campo de monto físico efectivo es obligatorio.'); setIsSubmitting(false); setShowConfirmModal(false); return;
    } else {
      saldoEfectivoFinalParaGuardar = parseFloat(mainFormData.nuevoSaldoFinalRealEfectivo);
      if (isNaN(saldoEfectivoFinalParaGuardar)) {
        setError('El saldo de efectivo físico ingresado debe ser un número válido.'); setIsSubmitting(false); setShowConfirmModal(false); return;
      }
    }

    let formErrorMsg = "";
    const justificacionesPorMetodoFinal = {};

    const efectivoConfig = DEFAULT_PAYMENT_METHODS_CONFIG.find(m => m.isCash);
    if (efectivoConfig) {
      justificacionesPorMetodoFinal[efectivoConfig.display_name] = {
        montoFisicoIngresado: saldoEfectivoFinalParaGuardar,
        justificaciones: itemJustifications[efectivoConfig.display_name] || []
      };
    }

    paymentDetails.forEach(pd => {
      const fisicoEditableForm = pd.fisicoEditable.trim();
      let fisicoFinalParaGuardar;
      if (fisicoEditableForm === '') {
        formErrorMsg += ` El campo de monto físico para ${pd.name} es obligatorio.`;
      } else {
        fisicoFinalParaGuardar = parseFloat(pd.fisicoEditable);
        if (isNaN(fisicoFinalParaGuardar)) {
          formErrorMsg += ` El monto físico para ${pd.name} no es un número válido.`;
        }
      }
      justificacionesPorMetodoFinal[pd.name] = {
        montoFisicoIngresado: isNaN(fisicoFinalParaGuardar) ? pd.sistema : fisicoFinalParaGuardar,
        justificaciones: itemJustifications[pd.name] || []
      };
    });

    if (formErrorMsg) { setError(formErrorMsg.trim()); setIsSubmitting(false); setShowConfirmModal(false); return; }

    const rawRectificationRequest = {
      sessionId: sessionData.id, sessionName: sessionData.name,
      originalUserIdArray: sessionData.user_id, originalStartAt: sessionData.start_at, originalStopAt: sessionData.stop_at,
      originalStoreName: Array.isArray(sessionData.crm_team_id) ? sessionData.crm_team_id[1] : 'Desconocido',
      originalStoreId: Array.isArray(sessionData.crm_team_id) ? sessionData.crm_team_id[0] : undefined,
      originalCashRegisterBalanceStart: sessionData.cash_register_balance_start,
      originalCashRegisterBalanceEndReal: sessionData.cash_register_balance_end_real,
      originalTheoreticalCashFromApi: sessionData.cash_register_balance_end,
      originalCashRegisterDifference: sessionData.cash_register_difference,
      originalCashRealTransaction: sessionData.cash_real_transaction,
      rectificationDetails: {
        ajusteSaldoEfectivo: { montoAjustado: saldoEfectivoFinalParaGuardar },
        justificacionesPorMetodo: justificacionesPorMetodoFinal,
        gastosRendidos: gastosRendidos,
        boletasPendientesRegistradas: boletasPendientes,
      },
      submittedByEmail: currentUser?.email, submittedByUid: currentUser?.uid, submittedAt: serverTimestamp(),
      status: "pendiente", storeIdSubmitter: Array.isArray(sessionData.crm_team_id) ? sessionData.crm_team_id[0] : null,
      approvedBy: null, approvedAt: null, rejectionReason: null
    };
    const rectificationRequestToSave = sanitizeForFirebase(rawRectificationRequest);

    try {
      await push(ref(database, 'rectificationRequests'), rectificationRequestToSave);
      await clearDraftAfterSubmit();
      setSuccess('Solicitud de rectificación enviada.');
      setShowConfirmAnim(true);
      setConfirmAnimSuccess(true);
      setConfirmAnimMsg('¡Solicitud enviada con éxito!');
      setConfirmAnimDesc('Serás redirigido automáticamente.');
      setTimeout(() => {
        setShowConfirmAnim(false);
        navigate('/cuadraturas');
      }, 2200);
    } catch (firebaseError) {
      setError('Error al guardar: ' + firebaseError.message);
      setShowConfirmAnim(true);
      setConfirmAnimSuccess(false);
      setConfirmAnimMsg('Ocurrió un error al enviar la solicitud');
      setConfirmAnimDesc(firebaseError.message);
      setTimeout(() => setShowConfirmAnim(false), 2500);
    } finally {
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  // --- Acción de aprobación/rechazo por parte del superadministrador ---
  const handleApprovalAction = async (action) => {
    if (!existingRectification?.requestId || userRole !== 'superadmin') return;
    const decisionComment = mainFormData.superAdminMotivoDecision.trim();
    if (action === 'rechazada' && !decisionComment) {
        setError('Motivo de rechazo es requerido.');
        return;
    }
     if (action === 'rechazada' && decisionComment.length > 100) {
        setError('El motivo de rechazo no puede exceder los 100 caracteres.');
        return;
    }
    setIsSubmitting(true); setError(''); setSuccess('');

    const updates = {
        status: action,
        approvedByUid: currentUser?.uid,
        approvedByName: currentUser?.displayName || currentUser?.email,
        approvedAt: serverTimestamp(),
        rejectionReason: decisionComment || null 
    };

    try {
        await update(ref(database, `rectificationRequests/${existingRectification.requestId}`), sanitizeForFirebase(updates));
        setSuccess(`Solicitud ${action} con éxito.`);
        setExistingRectification(prev => ({
            ...prev,
            status: action,
            approvedByUid: updates.approvedByUid,
            approvedByName: updates.approvedByName,
            approvedAt: updates.approvedAt, 
            rejectionReason: updates.rejectionReason 
        }));
        setPageMode('view_only');
    } catch (err) {
        setError(`Error al ${action}.`);
    } finally {
        setIsSubmitting(false);
    }
  };
  
  // --- Abrir modal para ver justificaciones de un método de pago ---
  const openViewJustificationsModal = (name, justifications) => {
    setJustificationsToViewInfo({ name: name, justifications: justifications || [] });
    setIsViewJustificationsModalOpen(true);
  };

  // Determina si el formulario es editable por un admin (en modo creación).
  const isFormEditableByAdmin = pageMode === 'create' && userRole === 'admin';
  // Determina si un superadmin puede tomar una decisión sobre una solicitud pendiente.
  const canSuperAdminDecide = pageMode === 'review' && existingRectification?.status === 'pendiente' && userRole === 'superadmin';

  // Calcula el monto de efectivo físico a mostrar, considerando el modo y rol.
  const efectivoOdoo = parseFloat(sessionData?.cash_register_balance_end) || 0;
  let efectivoFisicoParaDisplay;
  if (isFormEditableByAdmin || (userRole === 'superadmin' && !existingRectification && location.state?.adminDraftOwnerId)) {
      const parsedInput = parseFloat(parseInputAmount(mainFormData.nuevoSaldoFinalRealEfectivo));
      if (mainFormData.nuevoSaldoFinalRealEfectivo.trim() === '') {
          efectivoFisicoParaDisplay = parseFloat(sessionData?.cash_register_balance_end_real) || 0;
      } else {
          efectivoFisicoParaDisplay = isNaN(parsedInput) ? (parseFloat(sessionData?.cash_register_balance_end_real) || 0) : parsedInput;
      }
  } else { 
      efectivoFisicoParaDisplay = parseFloat(existingRectification?.rectificationDetails?.ajusteSaldoEfectivo?.montoAjustado);
      if (isNaN(efectivoFisicoParaDisplay)) {
          efectivoFisicoParaDisplay = parseFloat(sessionData?.cash_register_balance_end_real) || 0;
      }
  }
  
  const efectivoConfig = DEFAULT_PAYMENT_METHODS_CONFIG.find(m => m.isCash);
  const justificacionesEfectivo = efectivoConfig ? (itemJustifications[efectivoConfig.display_name] || []) : [];
  const totalJustificadoEfectivo = justificacionesEfectivo.reduce((sum,j) => sum + (parseFloat(j.monto)||0), 0);
  
  const totalGastosRendidos = gastosRendidos.reduce((sum, g) => sum + g.monto, 0);
  const diferenciaGastos = gastosSistemaAPI - totalGastosRendidos;

  // Lógica de cálculo de diferencias para el efectivo, incluyendo gastos y boletas.
  const diferenciaBrutaSinBoletas = efectivoFisicoParaDisplay - efectivoOdoo - totalGastosRendidos;
  let efectoNetoBoletas = 0;
  boletasPendientes.forEach(b => {
    const montoBoleta = parseFloat(b.monto) || 0;
    if (b.estadoBoleta === 'Rectificacion') { 
        efectoNetoBoletas -= montoBoleta;
    } else { 
        efectoNetoBoletas += montoBoleta;
    }
  });
  const diferenciaBrutaConBoletas = diferenciaBrutaSinBoletas + efectoNetoBoletas; 
  
  let totalNetoBoletasDisplay = 0; // Para mostrar en la UI el neto de boletas.
   boletasPendientes.forEach(b => {
    totalNetoBoletasDisplay += (b.estadoBoleta === 'Rectificacion' ? -1 : 1) * (parseFloat(b.monto) || 0);
  });

  // Diferencia NETA final para el efectivo, después de todas las justificaciones.
  const diferenciaEfectivoNeta = diferenciaBrutaConBoletas + totalJustificadoEfectivo;

  // Genera el título de la página dinámicamente.
  const getPageTitle = () => {
    const sessionName = sessionData?.name || `ID: ${sessionId}`;
    // Título específico si un superadmin está viendo el borrador de un admin.
    if (userRole === 'superadmin' && !existingRectification && location.state?.adminDraftOwnerId) {
        const adminIdShort = location.state.adminDraftOwnerId.substring(0,6);
        return `Viendo Borrador (Admin: ${adminIdShort}...) para Sesión: ${sessionName}`;
    }
    if (pageMode === 'create') return `Crear Rectificación para Sesión: ${sessionName}`;
    if (pageMode === 'review' && existingRectification) return `Revisar Solicitud (${existingRectification.status.replace(/_/g, ' ')}) - Sesión: ${sessionName}`;
    if (pageMode === 'view_only' && existingRectification) return `Detalle Solicitud (${existingRectification.status.replace(/_/g, ' ')}) - Sesión: ${sessionName}`;
    if (pageMode === 'view_only' && !existingRectification) return `Detalle Sesión (Sin Rectificar): ${sessionName}`;
    return `Rectificación Sesión: ${sessionName}`;
  };
    // Renderizado condicional optimizado
  if (!loadingState.isReadyToShow) return <RectificarSkeletonLoader />;
  if (showConfirmAnim) return <RectificarConfirmAnimation success={confirmAnimSuccess} message={confirmAnimMsg} desc={confirmAnimDesc} />;
  if (error && !sessionData && !isLoading && !draftState.isApplying) return <div className="page-error">Error: {error} <button onClick={() => navigate('/cuadraturas')}>Volver</button></div>;
  if (!sessionData && !isLoading && !draftState.isApplying) return <div className="page-loading">No hay datos de sesión. <button onClick={() => navigate('/cuadraturas')}>Volver</button></div>;
 
  // Variable final para determinar si el formulario debe ser editable.
  // Un admin en modo 'create' puede editar.
  // Un superadmin viendo el borrador de un admin NO puede editar.
  const finalIsFormEditable = isFormEditableByAdmin && !(userRole === 'superadmin' && location.state?.adminDraftOwnerId);
  
  // Condición para mostrar el botón de justificar efectivo.
  const puedeJustificarEfectivoCalculated = finalIsFormEditable && (diferenciaBrutaConBoletas !== 0 || diferenciaEfectivoNeta !== 0);


  // Utilidad para formatear fecha/hora legible
  function formatDateTimeDraft(ts) {
    if (!ts) return '';
    try {
      const date = new Date(ts);
      return date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ts; }
  }
  return (
    <div className="rectificar-page-container">
      {/* Notificación temporal unificada */}
      {tempNotification.show && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 1000,
          background: tempNotification.type === 'draft_saved' ? '#4caf50' : '#2196f3',
          color: 'white',
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {tempNotification.message}
        </div>
      )}
      
      {/* Alerta persistente de última edición de borrador */}
      {loadingState.isReadyToShow && draftState.lastEditInfo && (
        <div style={{
          margin: '10px 0 0 0', 
          padding: '7px 14px', 
          background: '#e3f2fd', 
          color: '#1976d2', 
          borderRadius: 6, 
          fontSize: '0.98em', 
          display: 'inline-block', 
          minWidth: 320
        }}>
          <span style={{fontWeight: 500}}>Última edición de borrador:</span> {draftState.lastEditInfo.email || 'N/A'}
          {draftState.lastEditInfo.timestamp && (
            <span style={{marginLeft: 10, color: '#1565c0'}}>
              ({formatDateTimeDraft(draftState.lastEditInfo.timestamp)})
            </span>
          )}
        </div>
      )}
      <header className="rectificar-page-header">
        <div className="header-content-wrapper">
            <h1>{getPageTitle()}</h1>
            <div className="header-actions">
                {finalIsFormEditable && (
                    <button
                        type="button"
                        onClick={handleSaveDraft}
                        className="draft-button"
                        disabled={isSubmitting || isSavingDraft}
                    >
                        {isSavingDraft ? 'Guardando...' : 'Guardar Borrador'}
                    </button>
                )}
                <button onClick={() => navigate('/cuadraturas')} className="back-button">Volver</button>
            </div>
        </div>
      </header>
      {error && <p className="error-message page-level-error">{error}</p>}      {success && <p className="success-message page-level-success">{success}</p>}

      <div className="rectificar-main-content">
        
        <section className="session-info-card">
          <h3>Detalles de la Sesión</h3>
          <div className="details-grid single-line-details">
            <p><strong>Sesión:</strong> {sessionData.name || 'N/A'}</p>
            <p><strong>Local:</strong> {Array.isArray(sessionData.crm_team_id) ? sessionData.crm_team_id[1] : 'N/A'}</p>
            <p><strong>Usuario:</strong> {Array.isArray(sessionData.user_id) ? sessionData.user_id[1] : 'N/A'}</p>
            <p><strong>Inicio:</strong> {formatDateTime(sessionData.start_at)}</p>
            <p><strong>Termino:</strong> {formatDateTime(sessionData.stop_at)}</p>
          </div>
        </section>

        <section className="desglose-caja-card">
          <h3>Desglose de Caja y Medios de Pago</h3>
          <table className="excel-style-table">
            <thead><tr><th>Método</th><th>Sistema</th><th>Físico</th><th>Diferencia</th><th>Justificaciones</th><th>Acciones</th></tr></thead>
            <tbody>
              {efectivoConfig && (
                <tr>
                  <td>{efectivoConfig.display_name}</td>
                  <td>{formatCurrency(efectivoOdoo)}</td>
                  <td>{finalIsFormEditable ? <input type="text" name="nuevoSaldoFinalRealEfectivo" value={mainFormData.nuevoSaldoFinalRealEfectivo} onChange={handleMainFormChange} placeholder="Monto físico actual" disabled={isSubmitting || isSavingDraft} required/> : formatCurrency(efectivoFisicoParaDisplay)}</td>
                  <td className={diferenciaEfectivoNeta !== 0 ? (diferenciaEfectivoNeta < 0 ? 'text-red' : 'text-green') : ''}>{formatCurrency(diferenciaEfectivoNeta)}</td>
                  <td className="justificaciones-cell">
                    {justificacionesEfectivo.length > 0 ? justificacionesEfectivo.map((j, idx) => <div key={idx} title={j.motivo} className="justification-entry"><span>{j.motivo}:</span> <span>{formatCurrency(j.monto)}</span></div>) : (finalIsFormEditable && puedeJustificarEfectivoCalculated ? <span className="text-muted-italic">Click en lápiz para justificar</span> : ((diferenciaBrutaConBoletas === 0 && diferenciaEfectivoNeta === 0) ? 'OK' : 'N/A'))}
                  </td>
                  <td>
                    {finalIsFormEditable && puedeJustificarEfectivoCalculated && 
                        <button 
                            onClick={() => openItemJustificationModal({ id: efectivoConfig.id, name: efectivoConfig.display_name, sistema: efectivoOdoo, fisicoEditable: mainFormData.nuevoSaldoFinalRealEfectivo })} 
                            className="action-icon-button justify" title="Justificar Efectivo" disabled={isSubmitting || isSavingDraft}>
                            <span className="material-symbols-outlined">edit_note</span>
                        </button>
                    }
                    {justificacionesEfectivo.length > 0 && (
                        <button
                            onClick={() => openViewJustificationsModal(efectivoConfig.display_name, justificacionesEfectivo)}
                            className="action-icon-button view-justs" title="Ver Justificaciones Efectivo"
                            disabled={isSubmitting || isSavingDraft}>
                            <span className="material-symbols-outlined">visibility</span>
                        </button>
                    )}
                    {canSuperAdminDecide && (() => {
                        const hasNetDifferenceForIcon = diferenciaEfectivoNeta !== 0;
                        const hasJustifications = justificacionesEfectivo.length > 0;

                        if (hasJustifications) {
                            return null; 
                        }

                        if (hasNetDifferenceForIcon) {
                            return (
                                <button 
                                    className="action-icon-button attention"
                                    title="Atención: Diferencia sin Justificar (Superadmin)"
                                    disabled={isSubmitting || isSavingDraft}
                                >
                                    <span className="material-symbols-outlined">warning</span>
                                </button>
                            );
                        } else { 
                            return (
                                <button 
                                    className="action-icon-button accept"
                                    title="Revisado OK: Sin Diferencias (Superadmin)"
                                    disabled={isSubmitting || isSavingDraft}
                                >
                                    <span className="material-symbols-outlined">check_circle</span>
                                </button>
                            );
                        }
                    })()}
                  </td>
                </tr>
              )}
              {paymentDetails.map((item) => {
                const justsArray = itemJustifications[item.name] || [];
                const totalJustificadoItem = justsArray.reduce((sum, j) => sum + (parseFloat(j.monto)||0), 0);
                
                let fisicoItemParaDisplayValue;
                let fisicoItemNumerico;
                
                if (finalIsFormEditable || (userRole === 'superadmin' && location.state?.viewDraft && !existingRectification)) {
                    // Mostrar el valor del borrador, o 0 si está vacío/no definido
                    fisicoItemParaDisplayValue = (item.fisicoEditable !== undefined && item.fisicoEditable.trim() !== '') ? item.fisicoEditable : '0';
                    const parsedFisicoEditable = parseFloat(parseInputAmount(fisicoItemParaDisplayValue));
                    fisicoItemNumerico = !isNaN(parsedFisicoEditable) ? parsedFisicoEditable : 0;
                } else { 
                    const fisicoGuardado = existingRectification?.rectificationDetails?.justificacionesPorMetodo?.[item.name]?.montoFisicoIngresado;
                    fisicoItemParaDisplayValue = fisicoGuardado !== undefined ? String(fisicoGuardado) : '0';
                    fisicoItemNumerico = parseFloat(parseInputAmount(fisicoItemParaDisplayValue));
                    if(isNaN(fisicoItemNumerico)) fisicoItemNumerico = 0;
                }
                
                const diferenciaItemBruta = fisicoItemNumerico - item.sistema;
                const diferenciaItemNetaConJustificaciones = diferenciaItemBruta > 0 ? diferenciaItemBruta - totalJustificadoItem : diferenciaItemBruta + totalJustificadoItem;
                const puedeJustificarItemCurrent = finalIsFormEditable && diferenciaItemBruta !== 0;

                return (
                  <tr key={item.id}>
                    <td>{item.name}</td><td>{formatCurrency(item.sistema)}</td>
                    <td>{finalIsFormEditable ? <input type="text" value={item.fisicoEditable || ''} onChange={(e) => handlePaymentDetailChange(item.name, 'fisicoEditable', e.target.value)} placeholder="Monto físico" disabled={isSubmitting || isSavingDraft} required/> : formatCurrency(fisicoItemParaDisplayValue)}</td>
                    <td className={diferenciaItemNetaConJustificaciones !== 0 ? (diferenciaItemNetaConJustificaciones < 0 ? 'text-red' : 'text-green') : ''}>{formatCurrency(diferenciaItemNetaConJustificaciones)}</td>
                    <td className="justificaciones-cell">
                      {justsArray.length > 0 ? justsArray.map((j, idx) => <div key={idx} title={j.motivo} className="justification-entry"><span>{j.motivo}:</span> <span>{formatCurrency(j.monto)}</span></div>) : (finalIsFormEditable && puedeJustificarItemCurrent ? <span className="text-muted-italic">Click en lápiz para justificar</span> : (diferenciaItemBruta === 0 ? 'OK' : 'N/A'))}
                    </td>
                    <td>
                      {finalIsFormEditable && puedeJustificarItemCurrent && 
                        <button onClick={() => openItemJustificationModal(item)} className="action-icon-button justify" title="Justificar ítem" disabled={isSubmitting || isSavingDraft}>
                            <span className="material-symbols-outlined">edit_note</span>
                        </button>
                      }
                      {justsArray.length > 0 && (
                        <button
                            onClick={() => openViewJustificationsModal(item.name, justsArray)}
                            className="action-icon-button view-justs" title={`Ver Justificaciones ${item.name}`}
                            disabled={isSubmitting || isSavingDraft}>
                            <span className="material-symbols-outlined">visibility</span>
                        </button>
                      )}
                      {canSuperAdminDecide && (() => {
                          const hasInitialDifference = diferenciaItemBruta !== 0;
                          const hasJustificationsForItem = justsArray.length > 0;

                          if (hasJustificationsForItem) {
                              return null; 
                          }

                          if (hasInitialDifference) {
                              return (
                                  <button 
                                      className="action-icon-button attention"
                                      title={`Atención: Diferencia sin Justificar en ${item.name} (Superadmin)`}
                                      disabled={isSubmitting || isSavingDraft}
                                  >
                                      <span className="material-symbols-outlined">warning</span>
                                  </button>
                              );
                          } else { 
                              return (
                                  <button 
                                      className="action-icon-button accept"
                                      title={`Revisado OK: Sin Diferencias en ${item.name} (Superadmin)`}
                                      disabled={isSubmitting || isSavingDraft}
                                  >
                                      <span className="material-symbols-outlined">check_circle</span>
                                  </button>
                              );
                          }
                      })()}
                    </td>
                  </tr>
                );})}
            </tbody>
          </table>
        </section>
        
        <div className="additional-actions-grid">
            <section className="gastos-card">
                <div className="card-header-action">
                  <h3>Gastos</h3>
                  {finalIsFormEditable && (
                    <button onClick={openGastoModal} disabled={isSubmitting || isSavingDraft} className="add-item-button">
                      <span className="material-symbols-outlined">add_circle</span> Rendir Gasto
                    </button>
                  )}
                </div>
                <table className="excel-style-table condensed"><tbody>
                    <tr><td>Gastos</td><td>{formatCurrency(gastosSistemaAPI)}</td></tr>
                    <tr><td>Total Gastos Rendidos</td><td>{formatCurrency(totalGastosRendidos)}</td></tr>
                    <tr><td>Diferencia Gastos</td><td className={diferenciaGastos !==0 ? (diferenciaGastos > 0 ? 'text-green' : 'text-red') : ''}>{formatCurrency(diferenciaGastos)}</td></tr>
                </tbody></table>
                <h4>Detalle Gastos Rendidos:</h4>
                {gastosRendidos.length > 0 ? (
                  <table className="excel-style-table mini-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Monto</th>
                        <th>Motivo</th>
                        <th>Comprobante</th>
                        {finalIsFormEditable && <th>Acción</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {gastosRendidos.map((g, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{formatCurrency(g.monto)}</td>
                          <td>{g.motivo}</td>
                          <td>{g.comprobante || '-'}</td>
                          {finalIsFormEditable && (
                            <td>
                              <button
                                className="action-icon-button delete"
                                title="Eliminar Gasto"
                                type="button"
                                disabled={isSubmitting || isSavingDraft}
                                onClick={() => {
                                  setGastosRendidos(prev => prev.filter((_, idx) => idx !== i));
                                }}
                              >
                                <span className="material-symbols-outlined">delete</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted">No hay gastos rendidos.</p>
                )}
            </section>
            <section className="boletas-card">
                <div className="card-header-action">
                  <h3>Boletas (Neto: {formatCurrency(totalNetoBoletasDisplay)})</h3>
                  {finalIsFormEditable && (
                    <button onClick={openBoletaModal} disabled={isSubmitting || isSavingDraft} className="add-item-button">
                      <span className="material-symbols-outlined">add_circle</span> Ingresar Boleta
                    </button>
                  )}
                </div>
                <h4>Detalle Boletas Ingresadas:</h4>
                {boletasPendientes.length > 0 ? (
                  <table className="excel-style-table mini-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Nº Boleta</th>
                        <th>Monto</th>
                        <th>Estado</th>
                        {finalIsFormEditable && <th>Acción</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {boletasPendientes.map((b, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{b.numeroBoleta}</td>
                          <td className={b.estadoBoleta === 'Rectificacion' ? 'text-red' : ''}>{formatCurrency(b.monto)}</td>
                          <td>{b.estadoBoleta}</td>
                          {finalIsFormEditable && (
                            <td>
                              <button
                                className="action-icon-button delete"
                                title="Eliminar Boleta"
                                type="button"
                                disabled={isSubmitting || isSavingDraft}
                                onClick={() => {
                                  setBoletasPendientes(prev => prev.filter((_, idx) => idx !== i));
                                }}
                              >
                                <span className="material-symbols-outlined">delete</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ): <p className="text-muted">No hay boletas ingresadas.</p>}
            </section>
        </div>

        {(pageMode === 'view_only' || pageMode === 'review') && existingRectification && (
            <section className="solicitud-actual-card">
                <h3>Detalles Solicitud de Rectificación</h3>
                <div className="details-grid">
                    <p><strong>Email Solicitador/a:</strong> {existingRectification.submittedByEmail || 'N/A'}</p>
                    <p><strong>Fecha Solicitud:</strong> {formatDateTime(existingRectification.submittedAt)}</p>
                    <p><strong>Estado:</strong> <span className={`status-chip status-${existingRectification.status}`}>{existingRectification.status.replace(/_/g, ' ')}</span></p>
                    {existingRectification.rectificationDetails?.ajusteSaldoEfectivo?.montoAjustado !== undefined && <p><strong>Saldo Efectivo Ajustado:</strong> {formatCurrency(existingRectification.rectificationDetails.ajusteSaldoEfectivo.montoAjustado)}</p>}
                    {existingRectification.approvedByName && <p><strong>Decidido por:</strong> {existingRectification.approvedByName}</p>}
                    {existingRectification.approvedAt && <p><strong>Fecha Decisión:</strong> {formatDateTime(existingRectification.approvedAt)}</p>}
                    {existingRectification.rejectionReason && <p><strong>Motivo Decisión:</strong> {existingRectification.rejectionReason}</p>}
                </div>
            </section>
        )}

        {finalIsFormEditable && (
          <div className="form-actions">
            <button
              onClick={handleSubmitRectification}
              className="submit-rectification-button"
              disabled={isSubmitting || isSavingDraft || !!success}
            >
              {isSubmitting ? 'Enviando Solicitud...' : 'Enviar Solicitud de Rectificación Global'}
            </button>
          </div>
        )}
        {showConfirmModal && (
          <div className="modal-overlay open confirm-modal" onClick={() => setShowConfirmModal(false)}>
            <div className="modal-content confirm-modal-content" onClick={e => e.stopPropagation()}>
              <button type="button" className="modal-close-button confirm" onClick={() => setShowConfirmModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="confirm-modal-body">
                <h3>¿Está seguro de enviar la solicitud?</h3>
                <p className="confirm-warning">Una vez enviada, <strong>no podrá realizar más cambios</strong> sobre esta rectificación.</p>
                <div className="confirm-modal-actions">
                  <button
                    className="submit-rectification-button confirm"
                    onClick={doSubmitRectification}
                    disabled={isSubmitting}
                  >
                    Sí, enviar y finalizar
                  </button>
                  <button
                    className="cancel-button confirm"
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {canSuperAdminDecide && (
          <div className="review-actions-form">
            <h3>Decisión Superadministrador</h3>
            <div className="form-group"><label htmlFor="superAdminMotivoDecision">Comentarios Adicionales (requerido para rechazar, 100 caracteres max.):</label><textarea id="superAdminMotivoDecision" maxLength={100} name="superAdminMotivoDecision" value={mainFormData.superAdminMotivoDecision} onChange={handleMainFormChange} rows="3" disabled={isSubmitting || !!success}/></div>
            <div className="action-buttons">
              <button onClick={() => handleApprovalAction('aprobada')} className="approve-button" disabled={isSubmitting || !!success}>Aprobar Solicitud</button>
              <button onClick={() => handleApprovalAction('rechazada')} className="reject-button" disabled={isSubmitting || !!success || !mainFormData.superAdminMotivoDecision.trim()}>Rechazar Solicitud</button>
            </div>
          </div>
        )}
      </div>

      {isItemJustificationModalOpen && currentItemForJustification && (
        <div className="modal-overlay open" onClick={() => setIsItemJustificationModalOpen(false) }>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-button" onClick={() => setIsItemJustificationModalOpen(false)}><span className="material-symbols-outlined">close</span></button>
            <h3>Justificar: {currentItemForJustification.name}</h3>
            <form onSubmit={handleSaveItemJustification} className="modal-form">
              <p>Monto Sistema: {formatCurrency(currentItemForJustification.sistema)}</p>
              <p>Monto Físico Ingresado (actual): {formatCurrency(parseFloat(parseInputAmount(currentItemForJustification.fisicoEditable)) || currentItemForJustification.sistema)}</p>
              <div className="form-group">
                <label htmlFor="itemJustTipo">Tipo de Justificación:</label>
                <select
                  id="itemJustTipo"
                 
                  name="tipo"
                  value={itemJustificationForm.tipo || 'faltante'}
                  onChange={e => setItemJustificationForm(prev => ({ ...prev, tipo: e.target.value }))}
                  required                >
                  <option value="faltante">Faltante</option>
                  <option value="sobrante">Sobrante</option>
                </select>
              </div>
              <div className="form-group"><label htmlFor="itemJustMonto">Monto de la Justificación:</label><input type="text" id="itemJustMonto" name="monto" value={itemJustificationForm.monto} onChange={handleItemJustificationFormChange} placeholder="Ej: 5000" required /></div>
              <div className="form-group"><label htmlFor="itemJustMotivo">Motivo de Justificación (Obligatorio, 100 caracteres max.):</label><textarea id="itemJustMotivo" maxLength={100} name="motivo" value={itemJustificationForm.motivo} onChange={handleItemJustificationFormChange} rows="3" required /></div>
              <button type="submit" className="modal-submit-button" disabled={isSubmitting || isSavingDraft}>Guardar Justificación</button>
            </form>
          </div>
        </div>
      )}
      {isGastoModalOpen && (
        <div className="modal-overlay open" onClick={() => setIsGastoModalOpen(false) }>
           <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                       <button type="button" className="modal-close-button" onClick={() => setIsGastoModalOpen(false)}><span className="material-symbols-outlined">close</span></button>
            <h3>Rendir Gasto</h3>
            <form onSubmit={handleSaveGasto} className="modal-form">
                <div className="form-group"><label htmlFor="gastoMonto">Monto:</label><input type="text" id="gastoMonto" name="monto" value={gastoForm.monto} onChange={handleGastoFormChange} required /></div>
                <div className="form-group"><label htmlFor="gastoComprobante">Nº Comprobante/Referencia:</label><input type="text" id="gastoComprobante" name="comprobante" value={gastoForm.comprobante} onChange={handleGastoFormChange} required/></div>
                <div className="form-group"><label htmlFor="gastoMotivo">Motivo/Descripción del Gasto:</label><textarea id="gastoMotivo" maxLength={50} name="motivo" value={gastoForm.motivo} onChange={handleGastoFormChange} rows="3" required /></div>
                <button type="submit" className="modal-submit-button" disabled={isSubmitting || isSavingDraft}>Guardar Gasto</button>
            </form>
           </div>
        </div>
      )}
      {isBoletaModalOpen && (
         <div className="modal-overlay open" onClick={() => setIsBoletaModalOpen(false) }>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>                <button type="button" className="modal-close-button" onClick={() => setIsBoletaModalOpen(false)}><span className="material-symbols-outlined">close</span></button>                <h3>Ingresar Boleta</h3>
                <form onSubmit={handleSaveBoleta} className="modal-form">
                    <div className="form-group"><label htmlFor="boletaMonto">Monto Boleta:</label><input type="text" id="boletaMonto" name="monto" value={boletaForm.monto} onChange={handleBoletaFormChange} required /></div>
                    <div className="form-group"><label htmlFor="boletaNumero">Nº Boleta:</label><input type="text" id="boletaNumero" name="numeroBoleta" value={boletaForm.numeroBoleta} onChange={handleBoletaFormChange} required /></div>
                    <div className="form-group">
                        <label htmlFor="boletaEstadoBoleta">
                            Estado Boleta:
                            { (diferenciaBrutaSinBoletas + efectoNetoBoletas) !== 0 /*&& 
                                <span style={{fontSize: '0.85em', display: 'block', color: '#666'}}>
                                    Diferencia actual (previo a esta boleta): {formatCurrency(diferenciaBrutaSinBoletas + efectoNetoBoletas)}
                                </span>*/
                            }
                        </label>
                        <select id="boletaEstadoBoleta" name="estadoBoleta" value={boletaForm.estadoBoleta} onChange={handleBoletaFormChange}>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Rectificacion">Rectificación</option>
                        </select>
                    </div>
                    <button type="submit" className="modal-submit-button" disabled={isSubmitting || isSavingDraft}>Guardar Boleta</button>
                </form>
            </div>
         </div>
      )}
      {isViewJustificationsModalOpen && (
        <div className="view-justifications-modal-overlay" onClick={() => setIsViewJustificationsModalOpen(false)}>
            <div className="view-justifications-modal-content" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="view-justifications-modal-close-button" onClick={() => setIsViewJustificationsModalOpen(false)}>
                    <span className="material-symbols-outlined">close</span>
                </button>
                <h3 className="view-justifications-modal-title">
                    Justificaciones para: {justificationsToViewInfo.name}
                </h3>
                {justificationsToViewInfo.justifications.length > 0 ? (
                    <div className="view-justifications-table-container">
                        <table className="view-justifications-table">
                            <thead>
                                <tr>
                                    <th style={{width: '50px'}}>N°</th>
                                    <th>Motivo</th>
                                    <th style={{width: '100px'}}>Tipo</th>
                                    <th style={{width: '130px'}}>Monto</th>
                                    {finalIsFormEditable && <th>Acción</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {justificationsToViewInfo.justifications.map((j, idx) => (
                                    <tr key={idx}>
                                        <td className="vj-cell-index">{idx + 1}</td>
                                        <td className="vj-cell-motivo" title={j.motivo}>{j.motivo}</td>
                                        <td className="vj-cell-tipo">{j.tipo === 'sobrante' ? 'Sobrante' : 'Faltante'}</td>
                                        <td className="vj-cell-monto">{formatCurrency(j.monto)}</td>
                                        {finalIsFormEditable && (
                                          <td>
                                            <button
                                              className="action-icon-button delete"
                                              title="Eliminar Justificación"
                                              type="button"
                                              onClick={() => {
                                                setItemJustifications(prev => {
                                                  const name = justificationsToViewInfo.name;
                                                  const arr = prev[name] || [];
                                                  const newArr = arr.filter((_, i) => i !== idx);
                                                  setJustificationsToViewInfo(prevInfo => ({ 
                                                    ...prevInfo,
                                                    justifications: newArr
                                                  }));
                                                  return { ...prev, [name]: newArr };
                                                });
                                              }}
                                              disabled={isSubmitting || isSavingDraft}
                                            >
                                              <span className="material-symbols-outlined">delete</span>
                                            </button>
                                          </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="view-justifications-no-data">
                        No hay justificaciones registradas para este método de pago.
                    </p>
                )}
            </div>
        </div>      )}
    </div>
  );
}
export default RectificarPage;
