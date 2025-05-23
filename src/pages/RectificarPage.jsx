import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase/firebaseConfig';
import { ref, push, serverTimestamp, get, update, set } from "firebase/database";

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

async function fetchSessionPayments(apiUrl, sessionId) {
  if (sessionId === null || sessionId === undefined) return [];
  const requestData = {
    model: "pos.payment",
    filters: [[["session_id", "in", [parseInt(String(sessionId), 10)]], ["pos_order_id.state", "in", ["paid", "invoiced", "done"]]]],
    fields: ["amount:sum", "payment_method_id"], method: "read_group", groupby: ["payment_method_id"]
  };
  return await callOdooApi(apiUrl, requestData);
}

const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return 'N/A';
  try { const date = new Date(dateTimeString); return date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch (e) { return dateTimeString; }
};

const formatCurrency = (amount) => {
  const numAmount = parseFloat(String(amount).replace(/\./g, '').replace(/,/g, '.'));
  if (isNaN(numAmount)) return 'N/A';
  return numAmount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

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

function sanitizeForFirebase(dataObject) {
  if (dataObject === null || typeof dataObject !== 'object') { return dataObject === undefined ? null : dataObject; }
  if (Array.isArray(dataObject)) { return dataObject.map(item => sanitizeForFirebase(item)); }
  const sanitized = {};
  for (const key in dataObject) {
    if (dataObject.hasOwnProperty(key)) {
      const value = dataObject[key];
      if (typeof value === 'object' && value !== null && value['.sv'] === 'timestamp') { sanitized[key] = value; }
      else { sanitized[key] = sanitizeForFirebase(value); }
    }
  }
  return sanitized;
}

function RectificarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();
  const { currentUser, userRole } = useAuth();

  const [sessionData, setSessionData] = useState(null);
  const [pageMode, setPageMode] = useState('view_only');
  const [paymentDetails, setPaymentDetails] = useState([]);
  const [existingRectification, setExistingRectification] = useState(null);
  
  const [mainFormData, setMainFormData] = useState({
    nuevoSaldoFinalRealEfectivo: '',
    superAdminMotivoDecision: ''
  });

  const [itemJustifications, setItemJustifications] = useState({});
  const [gastosRendidos, setGastosRendidos] = useState([]);
  const [boletasPendientes, setBoletasPendientes] = useState([]);
  const [gastosSistemaAPI, setGastosSistemaAPI] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSavedSuccess, setDraftSavedSuccess] = useState(false);
  const [draftLoadedSuccess, setDraftLoadedSuccess] = useState(false);
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

  const loadInitialData = useCallback(async (passedSessionData, passedMode, passedReqId, urlSessionIdParam) => {
    setIsLoading(true); setError(''); setSuccess('');
    setDraftLoadedSuccess(false); 
    setDraftSavedSuccess(false);

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
      setPaymentDetails(initialPaymentDetails);
  
      const efectivoFisicoOdoo = sessionToUse.cash_register_balance_end_real;
      const efectivoFisicoInicialParaForm = (modeToUse !== 'create' && loadedExistingRectification?.rectificationDetails?.ajusteSaldoEfectivo?.montoAjustado !== undefined)
        ? loadedExistingRectification.rectificationDetails.ajusteSaldoEfectivo.montoAjustado.toString()
        : (efectivoFisicoOdoo === null || efectivoFisicoOdoo === undefined ? '' : String(efectivoFisicoOdoo));
  
      setMainFormData({
        nuevoSaldoFinalRealEfectivo: efectivoFisicoInicialParaForm,
        superAdminMotivoDecision: (modeToUse === 'create' || !loadedExistingRectification) ? '' : (loadedExistingRectification?.rejectionReason || ''),
      });
  
    } catch (err) { setError('Error al cargar datos detallados.'); }
    finally { setIsLoading(false); }
  }, [userRole]);
  
  useEffect(() => {
    const stateFromNavigation = location.state;
    const performInitialLoad = async () => {
      await loadInitialData(
        stateFromNavigation?.sessionInitialData,
        stateFromNavigation?.mode,
        stateFromNavigation?.existingRequestId,
        sessionId 
      );
    };
    if (sessionId) {
      performInitialLoad();
    } else {
      setError("ID de sesión no encontrado.");
      setIsLoading(false);
    }
  }, [sessionId, location.state, loadInitialData]);
  
  useEffect(() => {
    const tryLoadDraft = async () => {
      if (userRole === 'admin' && pageMode === 'create' && !existingRectification && sessionData?.id && currentUser?.uid) {
        try {
          const draftRef = ref(database, `rectificationDrafts/${sessionData.id}/${currentUser.uid}`);
          const snap = await get(draftRef);
          if (snap.exists()) {
            const loadedDraft = snap.val();
            setMainFormData(prevMain => ({
              ...prevMain,
              nuevoSaldoFinalRealEfectivo: loadedDraft.mainFormData?.nuevoSaldoFinalRealEfectivo ?? prevMain.nuevoSaldoFinalRealEfectivo,
            }));
            setItemJustifications(loadedDraft.itemJustifications || {});
            setGastosRendidos(loadedDraft.gastosRendidos || []);
            setBoletasPendientes(loadedDraft.boletasPendientes || []);
            
            setPaymentDetails(prevDetails => {
              const draftPaymentDetails = loadedDraft.paymentDetails || [];
              if (draftPaymentDetails.length > 0 && prevDetails.length > 0) {
                  return prevDetails.map(pd => {
                      const draftDetail = draftPaymentDetails.find(dpd => dpd.id === pd.id);
                      return draftDetail ? { ...pd, fisicoEditable: draftDetail.fisicoEditable !== undefined ? draftDetail.fisicoEditable : pd.fisicoEditable } : pd;
                  });
              }
              return draftPaymentDetails.length > 0 ? draftPaymentDetails : prevDetails; 
            });
  
            setDraftLoadedSuccess(true); 
            setTimeout(() => setDraftLoadedSuccess(false), 3000);
          }
        } catch (draftError) {
          console.error("Error cargando borrador:", draftError);
        }
      }
    };
  
    if (!isLoading && sessionData && currentUser) { 
      tryLoadDraft();
    }
  }, [isLoading, pageMode, existingRectification, sessionData, currentUser, userRole]);

  const handleSaveDraft = async () => {
    if (!sessionData || userRole !== 'admin' || pageMode !== 'create') {
      setError("Solo los administradores pueden guardar borradores en modo creación.");
      return;
    }
    setIsSavingDraft(true);
    setError('');
    setSuccess(''); 
    setDraftSavedSuccess(false);
    setDraftLoadedSuccess(false);
    try {
      const draftRef = ref(database, `rectificationDrafts/${sessionData.id}/${currentUser?.uid}`);
      const draftDataToSave = {
        mainFormData: {
            nuevoSaldoFinalRealEfectivo: mainFormData.nuevoSaldoFinalRealEfectivo
        },
        itemJustifications,
        gastosRendidos,
        boletasPendientes,
        paymentDetails 
      };
      await set(draftRef, sanitizeForFirebase(draftDataToSave));
      setDraftSavedSuccess(true);
      setTimeout(() => {
        setDraftSavedSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Error guardando borrador:", err);
      setError('Error al guardar borrador: ' + err.message);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const clearDraftAfterSubmit = async () => {
    if (sessionData?.id && currentUser?.uid) {
        try {
            const draftRef = ref(database, `rectificationDrafts/${sessionData.id}/${currentUser.uid}`);
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
    const keyToUpdate = currentItemForJustification.id === 'efectivo' ? DEFAULT_PAYMENT_METHODS_CONFIG.find(m => m.isCash).display_name : currentItemForJustification.name;
    setItemJustifications(prev => {
      const existingJustsArray = prev[keyToUpdate] || [];
      const montoFinal = tipo === 'sobrante' ? -Math.abs(monto) : Math.abs(monto);
      const newJustificationEntry = { monto: montoFinal, motivo: itemJustificationForm.motivo.trim(), tipo, timestamp: Date.now() };
      return { ...prev, [keyToUpdate]: [...existingJustsArray, newJustificationEntry] };
    });
    setIsItemJustificationModalOpen(false);
  };
  
  const openGastoModal = () => { setGastoForm({monto: '', comprobante: '', motivo: ''}); setIsGastoModalOpen(true);};
  const handleGastoFormChange = (e) => {
      const {name, value} = e.target;
      if(name === 'monto'){
          const cleaned = value.replace(/[^0-9]/g, '');
          setGastoForm(prev => ({ ...prev, [name]: cleaned }));
      } else {
          setGastoForm(prev => ({ ...prev, [name]: value }));
      }
  };
  const handleSaveGasto = (e) => {
    e.preventDefault();
    const monto = parseFloat(gastoForm.monto);
    if (isNaN(monto) || monto <= 0 || gastoForm.motivo.trim() === '') { alert('Monto válido y motivo son requeridos.'); return; }
    if (!gastoForm.comprobante || gastoForm.comprobante.trim() === '') { alert('El número de comprobante es requerido.'); return; }
    if (gastoForm.motivo.trim().length > 50) { alert('El motivo del gasto no puede exceder los 50 caracteres.'); return; }

    setGastosRendidos(prev => [...prev, { ...gastoForm, monto, timestamp: Date.now() }]);
    setIsGastoModalOpen(false);
  };

  const openBoletaModal = () => { setBoletaForm({monto: '', numeroBoleta: '', estadoBoleta: 'Pendiente'}); setIsBoletaModalOpen(true);};
  const handleBoletaFormChange = (e) => {
    const {name, value} = e.target;
    if(name === 'monto'){
        const cleaned = value.replace(/[^0-9]/g, '');
        setBoletaForm(prev => ({ ...prev, [name]: cleaned }));
    } else {
        setBoletaForm(prev => ({ ...prev, [name]: value }));
    }
  };
  const handleSaveBoleta = (e) => {
    e.preventDefault();
    const monto = parseFloat(boletaForm.monto);
    if (isNaN(monto) || monto <= 0 || boletaForm.numeroBoleta.trim() === '') { alert('Monto válido y número de boleta son requeridos.'); return; }
    setBoletasPendientes(prev => [...prev, { ...boletaForm, monto, timestamp: Date.now() }]);
    setIsBoletaModalOpen(false);
  };

  const handleSubmitRectification = async (e) => {
    if (e) e.preventDefault();
    setShowConfirmModal(true);
  };

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
      setSuccess('Solicitud de rectificación enviada.'); setTimeout(() => navigate('/cuadraturas'), 2500);
    } catch (firebaseError) { setError('Error al guardar: ' + firebaseError.message);
    } finally { setIsSubmitting(false); setShowConfirmModal(false); }
  };

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
  
  const openViewJustificationsModal = (name, justifications) => {
    setJustificationsToViewInfo({ name: name, justifications: justifications || [] });
    setIsViewJustificationsModalOpen(true);
  };

  const isFormEditableByAdmin = pageMode === 'create' && userRole === 'admin';
  const canSuperAdminDecide = pageMode === 'review' && existingRectification?.status === 'pendiente' && userRole === 'superadmin';

  const efectivoOdoo = parseFloat(sessionData?.cash_register_balance_end) || 0;
  let efectivoFisicoParaDisplay;
  if (isFormEditableByAdmin) {
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
  const diferenciaGastos = totalGastosRendidos - gastosSistemaAPI;

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
  
  let totalNetoBoletasDisplay = 0;
   boletasPendientes.forEach(b => {
    totalNetoBoletasDisplay += (b.estadoBoleta === 'Rectificacion' ? -1 : 1) * (parseFloat(b.monto) || 0);
  });

  const diferenciaEfectivoNeta = diferenciaBrutaConBoletas + totalJustificadoEfectivo;

  const getPageTitle = () => {
    const sessionName = sessionData?.name || `ID: ${sessionId}`;
    if (pageMode === 'create') return `Crear Rectificación Para Sesión: ${sessionName}`;
    if (pageMode === 'review' && existingRectification) return `Revisar Solicitud (${existingRectification.status.replace(/_/g, ' ')}) - Sesión: ${sessionName}`;
    if (pageMode === 'view_only' && existingRectification) return `Detalle Solicitud (${existingRectification.status.replace(/_/g, ' ')}) - Sesión: ${sessionName}`;
    if (pageMode === 'view_only' && !existingRectification) return `Detalle Sesión (Sin Rectificar): ${sessionName}`;
    return `Rectificación Sesión: ${sessionName}`;
  };
  
  if (isLoading) return <div className="page-loading">Cargando datos de rectificación...</div>;
  if (error && !sessionData && !isLoading) return <div className="page-error">Error: {error} <button onClick={() => navigate('/cuadraturas')}>Volver</button></div>;
  if (!sessionData && !isLoading) return <div className="page-loading">No hay datos de sesión. <button onClick={() => navigate('/cuadraturas')}>Volver</button></div>;
 
  const puedeJustificarEfectivoCalculated = isFormEditableByAdmin && (diferenciaBrutaConBoletas !== 0 || diferenciaEfectivoNeta !== 0);

  return (
    <div className="rectificar-page-container">
      <header className="rectificar-page-header">
        <div className="header-content-wrapper">
            <h1>{getPageTitle()}</h1>
            <div className="header-actions">
                {isFormEditableByAdmin && (
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
      {error && <p className="error-message page-level-error">{error}</p>}
      {success && <p className="success-message page-level-success">{success}</p>}
      
      {isFormEditableByAdmin && draftSavedSuccess && !isSavingDraft &&
        <p className="draft-feedback-message page-level-draft-success">¡Borrador guardado exitosamente!</p>
      }
      {isFormEditableByAdmin && draftLoadedSuccess && !isLoading &&
        <p className="draft-feedback-message page-level-draft-loaded">Borrador anterior cargado.</p>
      }

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
                  <td>{isFormEditableByAdmin ? <input type="text" name="nuevoSaldoFinalRealEfectivo" value={mainFormData.nuevoSaldoFinalRealEfectivo} onChange={handleMainFormChange} placeholder="Monto físico" disabled={isSubmitting || isSavingDraft} required/> : formatCurrency(efectivoFisicoParaDisplay)}</td>
                  <td className={diferenciaEfectivoNeta !== 0 ? (diferenciaEfectivoNeta < 0 ? 'text-red' : 'text-green') : ''}>{formatCurrency(diferenciaEfectivoNeta)}</td>
                  <td className="justificaciones-cell">
                    {justificacionesEfectivo.length > 0 ? justificacionesEfectivo.map((j, idx) => <div key={idx} title={j.motivo} className="justification-entry"><span>{j.motivo}:</span> <span>{formatCurrency(j.monto)}</span></div>) : (isFormEditableByAdmin && puedeJustificarEfectivoCalculated ? <span className="text-muted-italic">Click en lápiz para justificar</span> : ((diferenciaBrutaConBoletas === 0 && diferenciaEfectivoNeta === 0) ? 'OK' : 'N/A'))}
                  </td>
                  <td>
                    {isFormEditableByAdmin && puedeJustificarEfectivoCalculated && 
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
                                    title="Atención: Diferencia sin Justificar"
                                    disabled={isSubmitting || isSavingDraft}
                                >
                                    <span className="material-symbols-outlined">warning</span>
                                </button>
                            );
                        } else { 
                            return (
                                <button 
                                    className="action-icon-button accept"
                                    title="Revisado OK: Sin Diferencias"
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
                
                let fisicoItemParaDisplay;
                let fisicoItemNumerico;
                
                if (isFormEditableByAdmin) {
                    fisicoItemParaDisplay = item.fisicoEditable; 
                    const parsedFisicoEditable = parseFloat(parseInputAmount(item.fisicoEditable));
                    fisicoItemNumerico = item.fisicoEditable.trim() === '' ? item.sistema : (isNaN(parsedFisicoEditable) ? item.sistema : parsedFisicoEditable);
                } else { 
                    const fisicoGuardado = existingRectification?.rectificationDetails?.justificacionesPorMetodo?.[item.name]?.montoFisicoIngresado;
                    fisicoItemParaDisplay = fisicoGuardado !== undefined ? fisicoGuardado : item.sistema;
                    fisicoItemNumerico = parseFloat(fisicoItemParaDisplay);
                    if(isNaN(fisicoItemNumerico)) fisicoItemNumerico = item.sistema;
                }
                
                const diferenciaItemBruta = fisicoItemNumerico - item.sistema;
                const diferenciaItemNetaConJustificaciones = diferenciaItemBruta > 0 ? diferenciaItemBruta - totalJustificadoItem : diferenciaItemBruta + totalJustificadoItem;
                const puedeJustificarItemCurrent = isFormEditableByAdmin && diferenciaItemBruta !== 0;

                return (
                  <tr key={item.id}>
                    <td>{item.name}</td><td>{formatCurrency(item.sistema)}</td>
                    <td>{isFormEditableByAdmin ? <input type="text" value={item.fisicoEditable} onChange={(e) => handlePaymentDetailChange(item.name, 'fisicoEditable', e.target.value)} placeholder="Monto físico" disabled={isSubmitting || isSavingDraft} required/> : formatCurrency(fisicoItemParaDisplay)}</td>
                    <td className={diferenciaItemNetaConJustificaciones !== 0 ? (diferenciaItemNetaConJustificaciones < 0 ? 'text-red' : 'text-green') : ''}>{formatCurrency(diferenciaItemNetaConJustificaciones)}</td>
                    <td className="justificaciones-cell">
                      {justsArray.length > 0 ? justsArray.map((j, idx) => <div key={idx} title={j.motivo} className="justification-entry"><span>{j.motivo}:</span> <span>{formatCurrency(j.monto)}</span></div>) : (isFormEditableByAdmin && puedeJustificarItemCurrent ? <span className="text-muted-italic">Click en lápiz para justificar</span> : (diferenciaItemBruta === 0 ? 'OK' : 'N/A'))}
                    </td>
                    <td>
                      {isFormEditableByAdmin && puedeJustificarItemCurrent && 
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
                                      title={`Atención: Diferencia sin Justificar en ${item.name}`}
                                      disabled={isSubmitting || isSavingDraft}
                                  >
                                      <span className="material-symbols-outlined">warning</span>
                                  </button>
                              );
                          } else { 
                              return (
                                  <button 
                                      className="action-icon-button accept"
                                      title={`Revisado OK: Sin Diferencias en ${item.name}`}
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
                  {isFormEditableByAdmin && (
                    <button onClick={openGastoModal} disabled={isSubmitting || isSavingDraft} className="add-item-button">
                      <span className="material-symbols-outlined">add_circle</span> Rendir Gasto
                    </button>
                  )}
                </div>
                <table className="excel-style-table condensed"><tbody>
                    <tr><td>Gastos</td><td>{formatCurrency(gastosSistemaAPI)}</td></tr>
                    <tr><td>Gastos Rendidos</td><td>{formatCurrency(totalGastosRendidos)}</td></tr>
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
                        {isFormEditableByAdmin && <th>Acción</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {gastosRendidos.map((g, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{formatCurrency(g.monto)}</td>
                          <td>{g.motivo}</td>
                          <td>{g.comprobante || '-'}</td>
                          {isFormEditableByAdmin && (
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
                  {isFormEditableByAdmin && (
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
                        {isFormEditableByAdmin && <th>Acción</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {boletasPendientes.map((b, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{b.numeroBoleta}</td>
                          <td className={b.estadoBoleta === 'Rectificacion' ? 'text-red' : ''}>{formatCurrency(b.monto)}</td>
                          <td>{b.estadoBoleta}</td>
                          {isFormEditableByAdmin && (
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

        {isFormEditableByAdmin && (
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
            <div className="form-group"><label htmlFor="superAdminMotivoDecision">Comentarios Adicionales (requerido para rechazar, 100 caracteres máx.):</label><textarea id="superAdminMotivoDecision" maxLength={100} name="superAdminMotivoDecision" value={mainFormData.superAdminMotivoDecision} onChange={handleMainFormChange} rows="3" disabled={isSubmitting || !!success}/></div>
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
              <p>Monto Físico Ingresado (actual): {formatCurrency( parseFloat(parseInputAmount(currentItemForJustification.fisicoEditable)) || currentItemForJustification.sistema )}</p>
              <div className="form-group">
                <label htmlFor="itemJustTipo">Tipo de Justificación:</label>
                <select
                  id="itemJustTipo"
                  name="tipo"
                  value={itemJustificationForm.tipo || 'faltante'}
                  onChange={e => setItemJustificationForm(prev => ({ ...prev, tipo: e.target.value }))}
                  required
                >
                  <option value="faltante">Faltante</option>
                  <option value="sobrante">Sobrante</option>
                </select>
              </div>
              <div className="form-group"><label htmlFor="itemJustMonto">Monto de la Justificación:</label><input type="text" id="itemJustMonto" name="monto" value={itemJustificationForm.monto} onChange={handleItemJustificationFormChange} placeholder="Ej: 5000" required /></div>
              <div className="form-group"><label htmlFor="itemJustMotivo">Motivo de Justificación (Obligatorio, 100 caracteres máx.):</label><textarea id="itemJustMotivo" maxLength={100} name="motivo" value={itemJustificationForm.motivo} onChange={handleItemJustificationFormChange} rows="3" required /></div>
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
                <div className="form-group"><label htmlFor="gastoMotivo">Motivo/Descripción del Gasto (máx. 100 caracteres):</label><textarea id="gastoMotivo" maxLength={50} name="motivo" value={gastoForm.motivo} onChange={handleGastoFormChange} rows="3" required /></div>
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
                            { (diferenciaBrutaSinBoletas + efectoNetoBoletas) !== 0  
                                /*<span style={{fontSize: '0.85em', display: 'block', color: '#666'}}>
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
                                    {isFormEditableByAdmin && <th>Acción</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {justificationsToViewInfo.justifications.map((j, idx) => (
                                    <tr key={idx}>
                                        <td className="vj-cell-index">{idx + 1}</td>
                                        <td className="vj-cell-motivo" title={j.motivo}>{j.motivo}</td>
                                        <td className="vj-cell-tipo">{j.tipo === 'sobrante' ? 'Sobrante' : 'Faltante'}</td>
                                        <td className="vj-cell-monto">{formatCurrency(j.monto)}</td>
                                        {isFormEditableByAdmin && (
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
        </div>
      )}
    </div>
  );
}
export default RectificarPage;