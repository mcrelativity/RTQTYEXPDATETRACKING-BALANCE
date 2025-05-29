// Página de Rectificación de Caja
// ---------------------------------------------
// Este componente permite a los administradores y superadministradores revisar, justificar y rectificar diferencias de caja en sesiones POS.
// Incluye lógica para cargar datos desde Odoo y Firebase, gestionar formularios, justificaciones, gastos, boletas y flujos de aprobación.
// Cada función, hook y bloque relevante está documentado para facilitar el mantenimiento y la comprensión del flujo.
// Documentación detallada en español para cada función y bloque relevante.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase/firebaseConfig';
import { ref, push, serverTimestamp, get, update, set } from "firebase/database";
import './RectificarConfirmAnimation.css';
import './ModernSkeletonLoader.css';
import './RectificarPage.css'; // Import the new CSS file

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
    <div className="modern-skeleton-loader rectificar-page-container"> {/* Added rectificar-page-container for consistent padding */} 
      {/* Header Skeleton */}
      <div className="modern-skeleton-card modern-skeleton-header-card">
        <div className="modern-skeleton-element modern-skeleton-title" style={{ width: '60%', height: '30px', marginBottom: '10px' }} />
        <div className="modern-skeleton-element modern-skeleton-button" style={{ width: '120px', height: '30px', position: 'absolute', top: '20px', right: '20px' }} />
      </div>

      {/* Session Info Skeleton */}
      <div className="modern-skeleton-card">
        <div className="modern-skeleton-element modern-skeleton-subtitle" style={{ width: '30%', height: '20px', marginBottom: '15px' }} />
        <div className="modern-skeleton-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          {[...Array(5)].map((_, i) => (
            <div className="modern-skeleton-element modern-skeleton-text-line" key={i} style={{ height: '16px' }} />
          ))}
        </div>
      </div>

      {/* Desglose de Caja Table Skeleton */}
      <div className="modern-skeleton-card">
        <div className="modern-skeleton-element modern-skeleton-subtitle" style={{ width: '40%', height: '20px', marginBottom: '15px' }} />
        <div className="modern-skeleton-table">
          <div className="modern-skeleton-table-header-row" style={{ display: 'flex', gap: '10px', paddingBottom: '10px' }}>
            {['20%', '20%', '20%', '20%', '10%', '10%'].map((width, i) => (
              <div className="modern-skeleton-element modern-skeleton-table-header-cell" key={i} style={{ flexBasis: width, height: '18px' }} />
            ))}
          </div>
          {[...Array(3)].map((_, i) => (
            <div className="modern-skeleton-table-data-row" key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              {['20%', '20%', '20%', '20%', '10%', '10%'].map((width, j) => (
                <div className="modern-skeleton-element modern-skeleton-table-cell" key={j} style={{ flexBasis: width, height: '16px' }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Gastos and Boletas Skeletons (side-by-side) */}
      <div className="additional-actions-grid-skeleton" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', width: '100%' }}>
        {/* Gastos Skeleton */}
        <div className="modern-skeleton-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div className="modern-skeleton-element modern-skeleton-subtitle" style={{ width: '30%', height: '20px' }} />
            <div className="modern-skeleton-element modern-skeleton-button-small" style={{ width: '100px', height: '28px' }} />
          </div>
          <div className="modern-skeleton-element modern-skeleton-text-line" style={{ height: '16px', marginBottom: '8px' }} />
          <div className="modern-skeleton-element modern-skeleton-text-line" style={{ height: '16px', marginBottom: '15px' }} />
          <div className="modern-skeleton-element modern-skeleton-subtitle" style={{ width: '50%', height: '18px', marginBottom: '10px' }} />
          {[...Array(2)].map((_, i) => (
            <div className="modern-skeleton-table-data-row" key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              {[ '10%', '25%', '40%', '15%'].map((width, j) => (
                <div className="modern-skeleton-element modern-skeleton-table-cell" key={j} style={{ flexBasis: width, height: '14px' }} />
              ))}
            </div>
          ))}
        </div>

        {/* Boletas Skeleton */}
        <div className="modern-skeleton-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div className="modern-skeleton-element modern-skeleton-subtitle" style={{ width: '40%', height: '20px' }} />
            <div className="modern-skeleton-element modern-skeleton-button-small" style={{ width: '100px', height: '28px' }} />
          </div>
          <div className="modern-skeleton-element modern-skeleton-subtitle" style={{ width: '60%', height: '18px', marginBottom: '10px' }} />
          {[...Array(2)].map((_, i) => (
            <div className="modern-skeleton-table-data-row" key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              {['10%', '30%', '25%', '25%'].map((width, j) => (
                <div className="modern-skeleton-element modern-skeleton-table-cell" key={j} style={{ flexBasis: width, height: '14px' }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons Skeleton */}
      <div className="modern-skeleton-card" style={{ textAlign: 'center', paddingTop: '20px', paddingBottom: '20px' }}>
        <div className="modern-skeleton-element modern-skeleton-action-button" style={{ width: '250px', height: '36px', margin: '0 auto' }} />
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
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();
  const { currentUser, userRole } = useAuth();

  // --- Estado maestro atómico ---
  const [formState, setFormState] = useState({
    sessionData: null,
    pageMode: 'view_only',
    paymentDetails: [],
    existingRectification: null,
    mainFormData: {
      nuevoSaldoFinalRealEfectivo: '',
      superAdminMotivoDecision: ''
    },
    itemJustifications: {},
    gastosRendidos: [],
    boletasPendientes: [],
    gastosSistemaAPI: 0
  });

  // --- Estados para la UI: carga, errores y feedback unificado ---
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirmAnim, setShowConfirmAnim] = useState(false);
  const [confirmAnimSuccess, setConfirmAnimSuccess] = useState(true);
  const [confirmAnimMsg, setConfirmAnimMsg] = useState('');
  const [confirmAnimDesc, setConfirmAnimDesc] = useState('');
  const [tempNotification, setTempNotification] = useState({
    show: false,
    type: '',
    message: '',
    duration: 3000
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isItemJustificationModalOpen, setIsItemJustificationModalOpen] = useState(false);
  const [currentItemForJustification, setCurrentItemForJustification] = useState(null);
  const [itemJustificationForm, setItemJustificationForm] = useState({ monto: '', motivo: '', tipo: 'faltante' });
  const [isGastoModalOpen, setIsGastoModalOpen] = useState(false);
  const [gastoForm, setGastoForm] = useState({ monto: '', comprobante: '', motivo: '' });
  const [isBoletaModalOpen, setIsBoletaModalOpen] = useState(false);
  const [boletaForm, setBoletaForm] = useState({ monto: '', numeroBoleta: '', estadoBoleta: 'Pendiente' });
  const [isViewJustificationsModalOpen, setIsViewJustificationsModalOpen] = useState(false);
  const [justificationsToViewInfo, setJustificationsToViewInfo] = useState({ name: '', justifications: [] });
  const [draftState, setDraftState] = useState({
    pending: null,
    lastEditInfo: null,
    isLoading: false,
    hasShownNotification: false
  });
  const [loadingState, setLoadingState] = useState({
    isInitialLoading: true,
    isReadyToShow: false,
    hasError: false,
    isDraftBeingApplied: false
  });
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
      mainFormData: formState.mainFormData,
      itemJustifications: formState.itemJustifications,
      gastosRendidos: formState.gastosRendidos,
      boletasPendientes: formState.boletasPendientes,
      paymentDetails: formState.paymentDetails,
      loadingState: loadingState
    });
  }, [formState, loadingState]);

  // --- Función optimizada para aplicar borrador de forma directa y confiable ---
  // Ahora innecesaria: la carga atómica ya fusiona todo en setFormState
  const applyDraftDataDirectly = useCallback(async (draftData) => {
    // No hacer nada, la lógica de fusión es atómica en setFormState
    return;
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

    // Refactor: Retornar objeto baseData con todos los datos necesarios, sin hacer setState aquí
    let sessionToUse = passedSessionData;
    let modeToUse = passedMode || 'view_only';
    let reqIdToUse = passedReqId;

    // Defensive fallback: always create a minimal session object if missing
    if (!sessionToUse && urlSessionIdParam) {
      sessionToUse = { id: parseInt(urlSessionIdParam, 10), name: `Sesión ${urlSessionIdParam}` };
    }
    if (!sessionToUse || !sessionToUse.id) {
      throw new Error("Datos de sesión no disponibles.");
    }

    let baseData = {
      sessionData: { ...sessionToUse },
      pageMode: modeToUse,
      gastosSistemaAPI: Math.abs(parseFloat(sessionToUse.cash_real_transaction) || 0),
      existingRectification: null,
      itemJustifications: {},
      gastosRendidos: [],
      boletasPendientes: [],
      paymentDetails: [],
      mainFormData: {
        nuevoSaldoFinalRealEfectivo: '',
        superAdminMotivoDecision: ''
      }
    };

    try {
      const odooPayments = await fetchSessionPayments(API_ENDPOINT, sessionToUse.id);
      let loadedExistingRectification = null;
      const initialItemJustifications = {};

      if ((modeToUse === 'review' || modeToUse === 'view_only') && reqIdToUse) {
        const requestRef = ref(database, `rectificationRequests/${reqIdToUse}`);
        const snapshot = await get(requestRef);
        if (snapshot.exists()) {
          loadedExistingRectification = { ...snapshot.val(), requestId: reqIdToUse };
          baseData.existingRectification = loadedExistingRectification;

          const justificacionesPorMetodoLoaded = loadedExistingRectification.rectificationDetails?.justificacionesPorMetodo || {};
          for (const methodName in justificacionesPorMetodoLoaded) {
            if (justificacionesPorMetodoLoaded[methodName] && Array.isArray(justificacionesPorMetodoLoaded[methodName].justificaciones)) {
              initialItemJustifications[methodName] = justificacionesPorMetodoLoaded[methodName].justificaciones;
            } else {
              initialItemJustifications[methodName] = [];
            }
          }
          baseData.itemJustifications = initialItemJustifications;
          baseData.gastosRendidos = loadedExistingRectification.rectificationDetails?.gastosRendidos || [];
          baseData.boletasPendientes = loadedExistingRectification.rectificationDetails?.boletasPendientesRegistradas || [];
        } else {
          if (userRole === 'admin' && sessionToUse.rectificationStatus === 'sin_rectificar') {
            modeToUse = 'create';
            baseData.pageMode = 'create';
          }
        }
      } else if (modeToUse === 'create') {
        // No hay rectificación existente
      }

      // Compose atomic state update for paymentDetails and mainFormData
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
      const efectivoFisicoOdoo = sessionToUse.cash_register_balance_end_real;
      const efectivoFisicoInicialParaForm = (modeToUse !== 'create' && loadedExistingRectification?.rectificationDetails?.ajusteSaldoEfectivo?.montoAjustado !== undefined)
        ? loadedExistingRectification.rectificationDetails.ajusteSaldoEfectivo.montoAjustado.toString()
        : (efectivoFisicoOdoo === null || efectivoFisicoOdoo === undefined ? '' : String(efectivoFisicoOdoo));

      baseData.paymentDetails = initialPaymentDetails;
      baseData.mainFormData = {
        nuevoSaldoFinalRealEfectivo: efectivoFisicoInicialParaForm,
        superAdminMotivoDecision: (modeToUse === 'create' || !loadedExistingRectification) ? '' : (loadedExistingRectification?.rejectionReason || ''),
      };

      return baseData;
    } catch (err) {
      throw new Error('Error al cargar datos detallados.');
    }
  }, [userRole]);
  // Efecto unificado: carga inicial + borrador antes de renderizar UI
  // Maestro effect: cargar datos iniciales y aplicar borrador con retry
  // EFECTO MAESTRO: Carga datos base y aplica borrador de forma secuencial y atómica
  useEffect(() => {
    let cancelled = false;
    async function cargarTodo() {
      setLoadingState(s => ({ ...s, isReadyToShow: false, isDraftBeingApplied: true, isInitialLoading: true }));
      try {
        try {
          // 1. Carga datos base y borrador en variables locales
          let baseData = await loadInitialData(
            location.state?.sessionInitialData,
            location.state?.mode,
            location.state?.existingRequestId,
            sessionId
          );
          if (cancelled) return;
          let draft = null;
          if (sessionId && (userRole === 'admin' || userRole === 'superadmin')) {
            const snap = await get(ref(database, `rectificationDrafts/${sessionId}`));
            if (snap.exists()) draft = snap.val();
          }
          if (cancelled) return;
          // 2. Fusiona base y borrador de forma atómica
          let merged = { ...baseData };
          if (draft) {
            merged = {
              ...merged,
              ...draft,
              mainFormData: {
                ...merged.mainFormData,
                ...draft.mainFormData
              },
              paymentDetails: Array.isArray(draft.paymentDetails) ? draft.paymentDetails.map(p => ({ ...p, fisicoEditable: String(p.fisicoEditable || ''), sistema: Number(p.sistema || 0) })) : merged.paymentDetails,
              itemJustifications: draft.itemJustifications || merged.itemJustifications,
              gastosRendidos: Array.isArray(draft.gastosRendidos) ? [...draft.gastosRendidos] : merged.gastosRendidos,
              boletasPendientes: Array.isArray(draft.boletasPendientes) ? [...draft.boletasPendientes] : merged.boletasPendientes
            };
            setDraftState(ds => ({ ...ds, lastEditInfo: draft.lastEdited || null }));
            showTempNotification('draft_loaded', 'Borrador cargado exitosamente');
          }
          setFormState(merged);
          setLoadingState(s => ({ ...s, isDraftBeingApplied: false, isInitialLoading: false, isReadyToShow: true }));
        } catch (e) {
          setError(e.message || 'Error al inicializar la página.');
          setLoadingState(s => ({ ...s, hasError: true, isInitialLoading: false, isDraftBeingApplied: false }));
        }
      } catch (e) {
        console.error('[RectificarPage] Error durante la carga secuencial:', e);
        setError('Error al inicializar la página: ' + e.message);
        setLoadingState(s => ({ ...s, hasError: true, isInitialLoading: false, isDraftBeingApplied: false }));
      }
    }
    cargarTodo();
    return () => { cancelled = true; };
  }, [sessionId, userRole, loadInitialData, location.state]);

  // Efecto: solo mostrar la UI cuando los datos críticos estén realmente en los estados
  useEffect(() => {
    // Considera que los datos están listos si formState tiene datos válidos
    if (
      !loadingState.isInitialLoading &&
      !loadingState.isDraftBeingApplied &&
      formState && typeof formState === 'object' &&
      formState.mainFormData && typeof formState.mainFormData === 'object' &&
      (formState.mainFormData.nuevoSaldoFinalRealEfectivo !== undefined) &&
      formState.paymentDetails && Array.isArray(formState.paymentDetails)
    ) {
      setLoadingState(s => ({ ...s, isReadyToShow: true }));
    }
  }, [formState, loadingState.isInitialLoading, loadingState.isDraftBeingApplied]);
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
        mainFormData: { ...formState.mainFormData },
        itemJustifications: formState.itemJustifications,
        gastosRendidos: formState.gastosRendidos,
        boletasPendientes: formState.boletasPendientes,
        paymentDetails: formState.paymentDetails,
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
    const saldoEfectivoFormulario = formState.mainFormData.nuevoSaldoFinalRealEfectivo.trim();
    let saldoEfectivoFinalParaGuardar;

    if (saldoEfectivoFormulario === '') {
      setError('El campo de monto físico efectivo es obligatorio.'); setIsSubmitting(false); setShowConfirmModal(false); return;
    } else {
      saldoEfectivoFinalParaGuardar = parseFloat(formState.mainFormData.nuevoSaldoFinalRealEfectivo);
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
        justificaciones: formState.itemJustifications[efectivoConfig.display_name] || []
      };
    }

    formState.paymentDetails.forEach(pd => {
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
        justificaciones: formState.itemJustifications[pd.name] || []
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
        gastosRendidos: formState.gastosRendidos,
        boletasPendientesRegistradas: formState.boletasPendientes,
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
    if (!formState.existingRectification?.requestId || userRole !== 'superadmin') return;
    const decisionComment = formState.mainFormData.superAdminMotivoDecision.trim();
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
        await update(ref(database, `rectificationRequests/${formState.existingRectification.requestId}`), sanitizeForFirebase(updates));
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
  const isFormEditableByAdmin = formState.pageMode === 'create' && userRole === 'admin';
  // Determina si un superadmin puede tomar una decisión sobre una solicitud pendiente.
  const canSuperAdminDecide = formState.pageMode === 'review' && formState.existingRectification?.status === 'pendiente' && userRole === 'superadmin';

  // Calcula el monto de efectivo físico a mostrar, considerando el modo y rol.

  const efectivoOdoo = parseFloat(formState.sessionData?.cash_register_balance_end) || 0;
  let efectivoFisicoParaDisplay;
  if (isFormEditableByAdmin || (userRole === 'superadmin' && !formState.existingRectification && location.state?.adminDraftOwnerId)) {
      const parsedInput = parseFloat(parseInputAmount(formState.mainFormData.nuevoSaldoFinalRealEfectivo));
      if (formState.mainFormData.nuevoSaldoFinalRealEfectivo.trim() === '') {
          efectivoFisicoParaDisplay = parseFloat(formState.sessionData?.cash_register_balance_end_real) || 0;
      } else {
          efectivoFisicoParaDisplay = isNaN(parsedInput) ? (parseFloat(formState.sessionData?.cash_register_balance_end_real) || 0) : parsedInput;
      }
  } else if (formState.existingRectification) {
      // Si hay rectificación existente, usar el saldo ajustado guardado
      efectivoFisicoParaDisplay = parseFloat(formState.existingRectification?.rectificationDetails?.ajusteSaldoEfectivo?.montoAjustado);
  } else { 
      efectivoFisicoParaDisplay = parseFloat(formState.existingRectification?.rectificationDetails?.ajusteSaldoEfectivo?.montoAjustado);
      if (isNaN(efectivoFisicoParaDisplay)) {
          efectivoFisicoParaDisplay = parseFloat(formState.sessionData?.cash_register_balance_end_real) || 0;
      }
  }

  const efectivoConfig = DEFAULT_PAYMENT_METHODS_CONFIG.find(m => m.isCash);
  const justificacionesEfectivo = (efectivoConfig && formState.itemJustifications && typeof formState.itemJustifications === 'object')

    ? (formState.itemJustifications[efectivoConfig.display_name] || [])
    : [];
  const totalJustificadoEfectivo = (justificacionesEfectivo || []).reduce((sum,j) => sum + (parseFloat(j.monto)||0), 0);

  const totalGastosRendidos = (formState.gastosRendidos || []).reduce((sum, g) => sum + g.monto, 0);
  const diferenciaGastos = formState.gastosSistemaAPI - totalGastosRendidos;

  // Lógica de cálculo de diferencias para el efectivo, incluyendo gastos y boletas.
  const diferenciaBrutaSinBoletas = efectivoFisicoParaDisplay - efectivoOdoo - totalGastosRendidos;
  let efectoNetoBoletas = 0;
  (formState.boletasPendientes || []).forEach(b => {
    const montoBoleta = parseFloat(b.monto) || 0;
    if (b.estadoBoleta === 'Rectificacion') { 
        efectoNetoBoletas -= montoBoleta;
    } else { 
        efectoNetoBoletas += montoBoleta;
    }
  });
  const diferenciaBrutaConBoletas = diferenciaBrutaSinBoletas + efectoNetoBoletas; 

  let totalNetoBoletasDisplay = 0; // Para mostrar en la UI el neto de boletas.
  (formState.boletasPendientes || []).forEach(b => {
    totalNetoBoletasDisplay += (b.estadoBoleta === 'Rectificacion' ? -1 : 1) * (parseFloat(b.monto) || 0);
  });

  // Diferencia NETA final para el efectivo, después de todas las justificaciones.
  const diferenciaEfectivoNeta = diferenciaBrutaConBoletas + totalJustificadoEfectivo;

  // Genera el título de la página dinámicamente.
  const getPageTitle = () => {
    const sessionName = formState.sessionData?.name || `ID: ${sessionId}`;
    // Título específico si un superadmin está viendo el borrador de un admin.
    if (userRole === 'superadmin' && !formState.existingRectification && location.state?.adminDraftOwnerId) {
        const adminIdShort = location.state.adminDraftOwnerId.substring(0,6);
        return `Viendo Borrador (Admin: ${adminIdShort}...) para Sesión: ${sessionName}`;
    }
    if (formState.pageMode === 'create') return `Crear Rectificación para Sesión: ${sessionName}`;
    if (formState.pageMode === 'review' && formState.existingRectification) return `Revisar Solicitud (${formState.existingRectification.status.replace(/_/g, ' ')}) - Sesión: ${sessionName}`;
    if (formState.pageMode === 'view_only' && formState.existingRectification) return `Detalle Solicitud (${formState.existingRectification.status.replace(/_/g, ' ')}) - Sesión: ${sessionName}`;
    if (formState.pageMode === 'view_only' && !formState.existingRectification) return `Detalle Sesión (Sin Rectificar): ${sessionName}`;
    return `Rectificación Sesión: ${sessionName}`;
  };
    // Renderizado condicional optimizado
  if (!loadingState.isReadyToShow) return <RectificarSkeletonLoader />;
  if (showConfirmAnim) return <RectificarConfirmAnimation success={confirmAnimSuccess} message={confirmAnimMsg} desc={confirmAnimDesc} />;
  if (error && !formState.sessionData && !isLoading && !draftState.isApplying) return <div className="page-error">Error: {error} <button onClick={() => navigate('/cuadraturas')}>Volver</button></div>;
  if (!formState.sessionData && !isLoading && !draftState.isApplying) return <div className="page-loading">No hay datos de sesión. <button onClick={() => navigate('/cuadraturas')}>Volver</button></div>;
 
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
            <p><strong>Sesión:</strong> {formState.sessionData?.name || 'N/A'}</p>
            <p><strong>Local:</strong> {Array.isArray(formState.sessionData?.crm_team_id) ? formState.sessionData.crm_team_id[1] : 'N/A'}</p>
            <p><strong>Usuario:</strong> {Array.isArray(formState.sessionData?.user_id) ? formState.sessionData.user_id[1] : 'N/A'}</p>
            <p><strong>Inicio:</strong> {formatDateTime(formState.sessionData?.start_at)}</p>
            <p><strong>Termino:</strong> {formatDateTime(formState.sessionData?.stop_at)}</p>
          </div>
        </section>

        <section className="desglose-caja-card">
          <h3>Desglose de Caja y Medios de Pago</h3>
          <table className="excel-style-table">
            <thead><tr><th>Método</th><th>Sistema</th><th>Físico</th><th>Diferencia</th><th>Justificaciones</th><th>Acciones</th></tr></thead>
            <tbody>
              {efectivoConfig && (
                <tr>
                  <td data-label="Método">{efectivoConfig.display_name}</td>
                  <td data-label="Sistema">{formatCurrency(efectivoOdoo)}</td>
                  <td data-label="Físico">{finalIsFormEditable ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      name="nuevoSaldoFinalRealEfectivo"
                      value={typeof formState.mainFormData.nuevoSaldoFinalRealEfectivo === 'string' ? formState.mainFormData.nuevoSaldoFinalRealEfectivo : (formState.mainFormData.nuevoSaldoFinalRealEfectivo || '')}
                      onChange={handleMainFormChange}
                      placeholder="Monto físico actual"
                      disabled={isSubmitting || isSavingDraft}
                      required
                    />
                  ) : formatCurrency(efectivoFisicoParaDisplay)}</td>
                  <td data-label="Diferencia" className={diferenciaEfectivoNeta !== 0 ? (diferenciaEfectivoNeta < 0 ? 'text-red' : 'text-green') : ''}>{formatCurrency(diferenciaEfectivoNeta)}</td>
                  <td data-label="Justificaciones" className="justificaciones-cell">
                    {justificacionesEfectivo.length > 0 ? justificacionesEfectivo.map((j, idx) => <div key={idx} title={j.motivo} className="justification-entry"><span>{j.motivo}:</span> <span>{formatCurrency(j.monto)}</span></div>) : (finalIsFormEditable && puedeJustificarEfectivoCalculated ? <span className="text-muted-italic">Click en lápiz para justificar</span> : ((diferenciaBrutaConBoletas === 0 && diferenciaEfectivoNeta === 0) ? 'OK' : 'N/A'))}
                  </td>
                  <td data-label="Acciones">
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
              {formState.paymentDetails.map((item) => {
                const justsArray = formState.itemJustifications[item.name] || [];
                const totalJustificadoItem = justsArray.reduce((sum, j) => sum + (parseFloat(j.monto)||0), 0);
                
                let fisicoItemParaDisplayValue;
                let fisicoItemNumerico;
                
                if (finalIsFormEditable || (userRole === 'superadmin' && location.state?.viewDraft && !formState.existingRectification)) {
                    // Mostrar el valor del borrador, o 0 si está vacío/no definido
                    fisicoItemParaDisplayValue = (item.fisicoEditable !== undefined && item.fisicoEditable.trim() !== '') ? item.fisicoEditable : '0';
                    const parsedFisicoEditable = parseFloat(parseInputAmount(fisicoItemParaDisplayValue));
                    fisicoItemNumerico = !isNaN(parsedFisicoEditable) ? parsedFisicoEditable : 0;
                } else { 
                    const fisicoGuardado = formState.existingRectification?.rectificationDetails?.justificacionesPorMetodo?.[item.name]?.montoFisicoIngresado;
                    fisicoItemParaDisplayValue = fisicoGuardado !== undefined ? String(fisicoGuardado) : '0';
                    fisicoItemNumerico = parseFloat(parseInputAmount(fisicoItemParaDisplayValue));
                    if(isNaN(fisicoItemNumerico)) fisicoItemNumerico = 0;
                }
                
                const diferenciaItemBruta = fisicoItemNumerico - item.sistema;
                const diferenciaItemNetaConJustificaciones = diferenciaItemBruta > 0 ? diferenciaItemBruta - totalJustificadoItem : diferenciaItemBruta + totalJustificadoItem;
                const puedeJustificarItemCurrent = finalIsFormEditable && diferenciaItemBruta !== 0;

                return (
                  <tr key={item.id}>
                    <td data-label="Método">{item.name}</td><td data-label="Sistema">{formatCurrency(item.sistema)}</td>
                    <td data-label="Físico">{finalIsFormEditable ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={typeof item.fisicoEditable === 'string' ? item.fisicoEditable : (item.fisicoEditable || '')}
                        onChange={(e) => handlePaymentDetailChange(item.name, 'fisicoEditable', e.target.value)}
                        placeholder="Monto físico"
                        disabled={isSubmitting || isSavingDraft}
                        required
                      />
                    ) : formatCurrency(fisicoItemParaDisplayValue)}</td>
                    <td data-label="Diferencia" className={diferenciaItemNetaConJustificaciones !== 0 ? (diferenciaItemNetaConJustificaciones < 0 ? 'text-red' : 'text-green') : ''}>{formatCurrency(diferenciaItemNetaConJustificaciones)}</td>
                    <td data-label="Justificaciones" className="justificaciones-cell">
                      {justsArray.length > 0 ? justsArray.map((j, idx) => <div key={idx} title={j.motivo} className="justification-entry"><span>{j.motivo}:</span> <span>{formatCurrency(j.monto)}</span></div>) : (finalIsFormEditable && puedeJustificarItemCurrent ? <span className="text-muted-italic">Click en lápiz para justificar</span> : (diferenciaItemBruta === 0 ? 'OK' : 'N/A'))}
                    </td>
                    <td data-label="Acciones">
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
                    <tr><td data-label="Concepto">Gastos</td><td data-label="Monto">{formatCurrency(gastosSistemaAPI)}</td></tr>
                    <tr><td data-label="Concepto">Total Gastos Rendidos</td><td data-label="Monto">{formatCurrency(totalGastosRendidos)}</td></tr>
                    <tr><td data-label="Concepto">Diferencia Gastos</td><td data-label="Monto" className={diferenciaGastos !==0 ? (diferenciaGastos > 0 ? 'text-green' : 'text-red') : ''}>{formatCurrency(diferenciaGastos)}</td></tr>
                </tbody></table>
                <h4>Detalle Gastos Rendidos:</h4>
                {formState.gastosRendidos.length > 0 ? (
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
                      {formState.gastosRendidos.map((g, i) => (
                        <tr key={i}>
                          <td data-label="#">{i + 1}</td>
                          <td data-label="Monto">{formatCurrency(g.monto)}</td>
                          <td data-label="Motivo">{g.motivo}</td>
                          <td data-label="Comprobante">{g.comprobante || '-'}</td>
                          {finalIsFormEditable && (
                            <td data-label="Acción">
                              <button
                                className="action-icon-button delete"
                                title="Eliminar Gasto"
                                type="button"
                                disabled={isSubmitting || isSavingDraft}
                                onClick={() => {
                                  setFormState(prev => ({
                                    ...prev,
                                    gastosRendidos: prev.gastosRendidos.filter((_, idx) => idx !== i)
                                  }));
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
                {formState.boletasPendientes.length > 0 ? (
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
                      {formState.boletasPendientes.map((b, i) => (
                        <tr key={i}>
                          <td data-label="#">{i + 1}</td>
                          <td data-label="Nº Boleta">{b.numeroBoleta}</td>
                          <td data-label="Monto" className={b.estadoBoleta === 'Rectificacion' ? 'text-red' : ''}>{formatCurrency(b.monto)}</td>
                          <td data-label="Estado">{b.estadoBoleta}</td>
                          {finalIsFormEditable && (
                            <td data-label="Acción">
                              <button
                                className="action-icon-button delete"
                                title="Eliminar Boleta"
                                type="button"
                                disabled={isSubmitting || isSavingDraft}
                                onClick={() => {
                                  setFormState(prev => ({
                                    ...prev,
                                    boletasPendientes: prev.boletasPendientes.filter((_, idx) => idx !== i)
                                  }));
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

        {(formState.pageMode === 'view_only' || formState.pageMode === 'review') && formState.existingRectification && (
            <section className="solicitud-actual-card">
                <h3>Detalles Solicitud de Rectificación</h3>
                <div className="details-grid">
                    <p><strong>Email Solicitador/a:</strong> {formState.existingRectification.submittedByEmail || 'N/A'}</p>
                    <p><strong>Fecha Solicitud:</strong> {formatDateTime(formState.existingRectification.submittedAt)}</p>
                    <p><strong>Estado:</strong> <span className={`status-chip status-${formState.existingRectification.status}`}>{formState.existingRectification.status.replace(/_/g, ' ')}</span></p>
                    {formState.existingRectification.rectificationDetails?.ajusteSaldoEfectivo?.montoAjustado !== undefined && <p><strong>Saldo Efectivo Ajustado:</strong> {formatCurrency(formState.existingRectification.rectificationDetails.ajusteSaldoEfectivo.montoAjustado)}</p>}
                    {formState.existingRectification.approvedByName && <p><strong>Decidido por:</strong> {formState.existingRectification.approvedByName}</p>}
                    {formState.existingRectification.approvedAt && <p><strong>Fecha Decisión:</strong> {formatDateTime(formState.existingRectification.approvedAt)}</p>}
                    {formState.existingRectification.rejectionReason && <p><strong>Motivo Decisión:</strong> {formState.existingRectification.rejectionReason}</p>}
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
                                    {finalIsFormEditable && <th data-label="Acción">Acción</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {justificationsToViewInfo.justifications.map((j, idx) => (
                                    <tr key={idx}>
                                        <td data-label="N°" className="vj-cell-index">{idx + 1}</td>
                                        <td data-label="Motivo" className="vj-cell-motivo" title={j.motivo}>{j.motivo}</td>
                                        <td data-label="Tipo" className="vj-cell-tipo">{j.tipo === 'sobrante' ? 'Sobrante' : 'Faltante'}</td>
                                        <td data-label="Monto" className="vj-cell-monto">{formatCurrency(j.monto)}</td>
                                        {finalIsFormEditable && (
                                          <td data-label="Acción">
                                            <button
                                              className="action-icon-button delete"
                                              title="Eliminar Justificación"
                                              type="button"
                                              onClick={() => {
                                                updateFormState(prev => ({
                                                  itemJustifications: {
                                                    ...prev.itemJustifications,
                                                    [justificationsToViewInfo.name]: (prev.itemJustifications[justificationsToViewInfo.name] || []).filter((_, i) => i !== idx)
                                                  }
                                                }));
                                                setJustificationsToViewInfo(prevInfo => ({
                                                  ...prevInfo,
                                                  justifications: (prevInfo.justifications || []).filter((_, i) => i !== idx)
                                                }));
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
