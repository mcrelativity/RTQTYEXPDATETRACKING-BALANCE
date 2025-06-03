/**
 * @file CuadraturasPage.jsx
 * @description
 * Página de Cuadraturas por Local. Permite a administradores y superadministradores visualizar, filtrar y navegar a la rectificación de sesiones POS agrupadas jerárquicamente por local, mes y día.
 * Incluye lógica para cargar datos desde Odoo y Firebase, filtrar por estado, y gestionar la navegación a la página de rectificación.
 * Cada función, hook, estado y estructura de datos está documentada en español para facilitar el mantenimiento y la comprensión del flujo.
 *
 * Estructura principal:
 * - Carga y procesamiento de sesiones POS desde Odoo y solicitudes/borradores de rectificación desde Firebase.
 * - Agrupación jerárquica de sesiones por local, mes y día.
 * - Filtros por estado de rectificación (aprobada, rechazada, pendiente, borrador, sin rectificar).
 * - Navegación a la página de rectificación según el estado y rol del usuario.
 * - Renderizado visual con animaciones de carga y manejo de errores.
 *
 * @author (Documentación) Revisada por GitHub Copilot
 */
import './CuadraturasSkeletonLoader.css';
/**
 * Skeleton Loader para la tabla de cuadraturas.
 * Componente visual que muestra una animación de carga mientras se obtienen los datos de cuadraturas.
 * No recibe props.
 * @returns {JSX.Element} Estructura visual de carga.
 */
function CuadraturasSkeletonLoader() {
  return (
    <div className="skeleton-loader">
      <div className="skeleton-bar short" />
      <div className="skeleton-bar medium" />
      <div className="skeleton-bar" />
      {[...Array(4)].map((_, i) => (
        <div className="skeleton-table-row" key={i}>
          <div className="skeleton-table-cell" />
          <div className="skeleton-table-cell" />
          <div className="skeleton-table-cell" />
          <div className="skeleton-table-cell" />
          <div className="skeleton-table-cell" />
        </div>
      ))}
    </div>
  );
}


// Importaciones principales de React y librerías necesarias
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // Para navegación entre páginas
import { useAuth } from '../context/AuthContext'; // Contexto de autenticación de usuario
import { database } from '../firebase/firebaseConfig'; // Configuración de Firebase
import { ref, get } from "firebase/database"; // Métodos de Firebase para obtener datos

/**
 * URL base y endpoint de la API de Odoo, y token de autenticación.
 * Se obtienen desde variables de entorno definidas en Vite.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_ENDPOINT = `${API_BASE_URL}/odoo`;
const BEARER_TOKEN = import.meta.env.VITE_API_BEARER_TOKEN;

/**
 * Realiza una llamada POST a la API de Odoo con autenticación Bearer.
 * @param {string} apiUrl - URL del endpoint de la API.
 * @param {object} requestData - Objeto con los datos de la petición (modelo, campos, método, etc).
 * @returns {Promise<object>} Respuesta JSON de la API.
 * @throws {Error} Si la respuesta no es exitosa o hay error de red.
 */
async function callOdooApi(apiUrl, requestData) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `bearer ${BEARER_TOKEN}`
  };
  const requestOptions = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestData),
  };
  try {
    const response = await fetch(apiUrl, requestOptions);
    if (!response.ok) {
      let errorMsg = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorData.error || errorMsg;
      } catch (e) { /* Ignora error de parseo JSON */ }
      throw new Error(errorMsg);
    }
    return await response.json();
  } catch (error) {
    console.error("Error calling Odoo API:", error);
    throw error;
  }
}

/**
 * Obtiene las sesiones de punto de venta (POS) desde Odoo.
 * No filtra por fecha, trae todas las sesiones permitidas por la API.
 * @param {string} apiUrl - URL del endpoint de la API.
 * @returns {Promise<Array>} Array de sesiones POS.
 */
async function fetchPosSessions(apiUrl) {
  const requestData = {
    model: "pos.session",
    fields: [
      "id", "name", "user_id", "start_at", "stop_at", "crm_team_id",
      "cash_register_balance_start", "cash_register_balance_end_real",
      "cash_register_difference", "cash_register_balance_end", "cash_real_transaction"
    ],
    method: "search_read",
    limit: 10000, // Puedes ajustar este límite si la API lo permite
    order: "start_at DESC"
  };
  return await callOdooApi(apiUrl, requestData);
}

/**
 * Formatea una cadena de fecha/hora a formato legible en español (Chile).
 * @param {string} dateTimeString - Fecha/hora en formato ISO.
 * @returns {string} Fecha/hora formateada o 'N/A'.
 */
const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    try {
        const date = new Date(dateTimeString);
        return date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) { return dateTimeString; }
};

/**
 * Formatea un monto numérico a moneda chilena (CLP).
 * @param {number|string} amount - Monto a formatear.
 * @returns {string} Monto formateado o 'N/A'.
 */
const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return 'N/A';
    const numAmount = Number(amount);
    if (isNaN(numAmount)) return 'Inválido';
    return numAmount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
};

/**
 * Nombres de los meses en español para mostrar en la agrupación jerárquica.
 * @type {string[]}
 */
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/**
 * Formatea el texto del estado de rectificación para mostrarlo con mayúsculas y sin guiones bajos.
 * @param {string} status - Estado de rectificación (ej: 'sin_rectificar').
 * @returns {string} Estado formateado para visualización.
 */
const formatStatusText = (status) => {
  if (!status) return '';
  return status
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Componente principal de la página de Cuadraturas.
 * Gestiona la carga, agrupación, filtrado y visualización de sesiones POS por local, mes y día.
 * Permite navegar a la página de rectificación según el estado y rol del usuario.
 *
 * Hooks de estado:
 * - hierarchicalData: Array jerárquico de locales, meses, días y sesiones.
 * - activeDayKey: Día actualmente expandido en la vista.
 * - isLoading: Bandera de carga de datos.
 * - apiError: Mensaje de error de API.
 * - openStores: Estado de expansión de locales.
 * - openMonths: Estado de expansión de meses.
 * - filterStatus: Estado seleccionado en el filtro.
 *
 * @returns {JSX.Element} Página de cuadraturas con filtros y vista jerárquica.
 */
function CuadraturasPage() {
  const navigate = useNavigate();
  const { currentUser, userRole } = useAuth();
  
  /**
   * Estado principal de la página:
   * @type {Array} hierarchicalData - Datos jerárquicos agrupados por local, mes y día.
   * @type {string|null} activeDayKey - Día actualmente expandido.
   * @type {boolean} isLoading - Bandera de carga de datos.
   * @type {string|null} apiError - Mensaje de error de API.
   * @type {Object} openStores - Estado de expansión de locales.
   * @type {Object} openMonths - Estado de expansión de meses.
   * @type {string} filterStatus - Estado seleccionado en el filtro.
   */
  const [hierarchicalData, setHierarchicalData] = useState([]);
  const [activeDayKey, setActiveDayKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [openStores, setOpenStores] = useState({});
  const [openMonths, setOpenMonths] = useState({});
  const [filterStatus, setFilterStatus] = useState('');
  
  const calculatedPageMaxWidth = '1300px';

  /**
   * Devuelve el color para las opciones del filtro de estado.
   * @param {string} statusValue - Estado de rectificación.
   * @returns {string} Color hexadecimal.
   */
  const getOptionColor = (statusValue) => {
    switch (statusValue) {
        case 'aprobada': return '#198754';
        case 'rechazada': return '#dc3545';
        case 'pendiente': return '#ffc107';
        case 'sin_rectificar': return '#6c757d';
        case 'borrador': return '#0d6efd'; 
        case '': default: return '#212529';
    }
  };

  /**
   * Carga y procesa los datos de cuadraturas desde Odoo y Firebase.
   * Agrupa las sesiones por local, mes y día, y enriquece con estado de rectificación y borradores.
   * @param {boolean} showLoadingIndicator - Si se debe mostrar el indicador de carga.
   */
  const loadAndProcessCuadraturas = useCallback(async (showLoadingIndicator = true) => {
    if(showLoadingIndicator) setIsLoading(true);
    setApiError(null);

    try {
      const sessionsFromApi = await fetchPosSessions(API_ENDPOINT);
      if (!Array.isArray(sessionsFromApi)) throw new Error("La respuesta de sesiones no es un array válido.");

      const rectificationRequestsRef = ref(database, 'rectificationRequests');
      const rectificationSnapshot = await get(rectificationRequestsRef);
      const rectificationData = rectificationSnapshot.exists() ? rectificationSnapshot.val() : {};
      
      // Para el modelo de borradores por usuario, no cargamos todos los borradores aquí para el admin.
      // Solo el superadmin podría hacerlo si tuviera una vista global de borradores (no implementado actualmente).
      // Cada admin verificará su propio borrador por sesión.
      
      const rectificationStatusBySessionId = {};
      Object.entries(rectificationData).forEach(([reqId, req]) => {
        if (req.sessionId) {
            if (!rectificationStatusBySessionId[req.sessionId] || req.submittedAt > (rectificationStatusBySessionId[req.sessionId].submittedAt || 0) ) {
                rectificationStatusBySessionId[req.sessionId] = { status: req.status, submittedAt: req.submittedAt, requestId: reqId, requestData: req };
            }
        }
      });

      /**
       * sessionsWithFullStatus: Array de sesiones POS enriquecidas con:
       * - rectificationStatus: Estado de rectificación ('aprobada', 'pendiente', etc).
       * - rectificationRequestId: ID de la solicitud de rectificación (si existe).
       * - rectificationRequestDetails: Detalles de la solicitud (si existe).
       * - hasDraft: Si existe un borrador colaborativo para la sesión.
       */
      const sessionsWithFullStatusPromises = sessionsFromApi.map(async (session) => {
        const rectificationInfo = rectificationStatusBySessionId[session.id];
        let hasDraft = false; // Flag: ¿Existe un borrador colaborativo para esta sesión?

        // Si la sesión no tiene rectificación formal enviada, verifica si existe un borrador colaborativo para ESTA sesión.
        if (!rectificationInfo || rectificationInfo.status === 'sin_rectificar') {
          try {
            // Ruta al borrador colaborativo de la sesión (sin importar usuario).
            const draftRef = ref(database, `rectificationDrafts/${session.id}`);
            const draftSnap = await get(draftRef);
            if (draftSnap.exists()) {
              hasDraft = true;
            }
          } catch (e) {
            console.warn(`No se pudo verificar el borrador colaborativo para sesión ${session.id}:`, e.message);
          }
        }

        return {
          ...session,
          rectificationStatus: rectificationInfo ? rectificationInfo.status : 'sin_rectificar',
          rectificationRequestId: rectificationInfo ? rectificationInfo.requestId : null,
          rectificationRequestDetails: rectificationInfo ? rectificationInfo.requestData : null,
          // 'hasDraft' ahora indica si existe un borrador colaborativo para la sesión.
          hasDraft,
        };
      });

      const sessionsWithFullStatus = await Promise.all(sessionsWithFullStatusPromises);
      
      /**
       * Agrupa las sesiones por local, mes y día para la vista jerárquica.
       * Estructura resultante:
       * {
       *   [storeName]: {
       *     [monthKey]: {
       *       monthDisplay: string,
       *       days: {
       *         [dayKey]: [Array de sesiones]
       *       }
       *     }
       *   }
       * }
       */
      const sessionsByStoreMonthDay = sessionsWithFullStatus.reduce((acc, session) => {
        const storeName = Array.isArray(session.crm_team_id) && session.crm_team_id.length > 1
                            ? session.crm_team_id[1]
                            : 'Local Desconocido';
        if (!session.start_at) return acc;
        const sessionStartDate = new Date(session.start_at);
        const year = sessionStartDate.getFullYear();
        const monthNum = sessionStartDate.getMonth();
        const day = String(sessionStartDate.getDate()).padStart(2, '0');
        const monthKey = `${year}-${String(monthNum + 1).padStart(2, '0')}`;
        const dayKey = `${day}`;
        
        if (!acc[storeName]) acc[storeName] = {};
        if (!acc[storeName][monthKey]) acc[storeName][monthKey] = { monthDisplay: `${monthNames[monthNum]} ${year}`, days: {} };
        if (!acc[storeName][monthKey].days[dayKey]) acc[storeName][monthKey].days[dayKey] = [];
        acc[storeName][monthKey].days[dayKey].push(session);
        return acc;
      }, {});

      /**
       * Convierte el objeto agrupado en un array jerárquico ordenado para el renderizado.
       * Estructura final:
       * [
       *   {
       *     storeName,
       *     months: [
       *       {
       *         monthDisplay,
       *         monthKey,
       *         days: [
       *           { dayDisplay, sessions: [...] }
       *         ]
       *       }
       *     ]
       *   }
       * ]
       */
      const finalGroupedData = Object.keys(sessionsByStoreMonthDay)
        .sort()
        .map(storeName => {
          const monthsData = sessionsByStoreMonthDay[storeName];
          return {
            storeName,
            months: Object.keys(monthsData)
              .sort((a, b) => b.localeCompare(a))
              .map(monthKey => {
                const monthInfo = monthsData[monthKey];
                return {
                  monthDisplay: monthInfo.monthDisplay,
                  monthKey,
                  days: Object.keys(monthInfo.days)
                    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
                    .map(dayKey => ({
                      dayDisplay: dayKey,
                      sessions: monthInfo.days[dayKey]
                    }))
                };
              })
          };
        });
      setHierarchicalData(finalGroupedData);
    } catch (error) {
      console.error("Error processing cuadraturas data:", error);
      setApiError(error.message || 'Error al obtener o procesar los datos.');
    } finally {
      if(showLoadingIndicator) setIsLoading(false);
    }
  }, [currentUser, userRole]); 

  /**
   * useEffect para cargar los datos al montar el componente.
   */
  useEffect(() => {
    loadAndProcessCuadraturas();
  }, [loadAndProcessCuadraturas]);

  /**
   * Memoiza los datos jerárquicos filtrados según el estado seleccionado en el filtro.
   * Si el filtro es 'borrador', muestra solo sesiones sin rectificar con borrador.
   * @type {Array}
   */
  const filteredHierarchicalData = useMemo(() => {
    if (!filterStatus) { 
        return hierarchicalData;
    }
    return hierarchicalData.map(storeData => {
        const filteredMonths = storeData.months.map(monthData => {
            const filteredDays = monthData.days.map(dayData => {
                let sessions;
                if (filterStatus === 'borrador') {
                    // Para el filtro "Borrador", se muestran sesiones 'sin_rectificar'
                    // donde existe un borrador colaborativo (session.hasDraft es true).
                    sessions = dayData.sessions.filter(session => 
                        session.rectificationStatus === 'sin_rectificar' && session.hasDraft
                    );
                } else {
                    sessions = dayData.sessions.filter(session => session.rectificationStatus === filterStatus);
                }
                return { ...dayData, sessions };
            }).filter(dayData => dayData.sessions.length > 0); 

            return { ...monthData, days: filteredDays };
        }).filter(monthData => monthData.days.length > 0); 

        return { ...storeData, months: filteredMonths };
    }).filter(storeData => storeData.months.length > 0); 
  }, [hierarchicalData, filterStatus]);

  /**
   * Maneja la apertura/cierre de la vista de un local.
   * @param {Event} e - Evento de click.
   * @param {string} storeName - Nombre del local.
   */
  const handleStoreToggle = (e, storeName) => {
    e.preventDefault();
    setOpenStores(prev => ({ ...prev, [storeName]: !prev[storeName] }));
  };

  /**
   * Maneja la apertura/cierre de la vista de un mes dentro de un local.
   * @param {Event} e - Evento de click.
   * @param {string} storeName - Nombre del local.
   * @param {string} monthKey - Clave del mes.
   */
  const handleMonthToggle = (e, storeName, monthKey) => {
    e.preventDefault();
    const combinedKey = `${storeName}-${monthKey}`;
    setOpenMonths(prev => ({ ...prev, [combinedKey]: !prev[combinedKey] }));
  };

  /**
   * Maneja la selección de un día específico para mostrar sus sesiones.
   * @param {string} storeName - Nombre del local.
   * @param {string} monthKey - Clave del mes.
   * @param {string} dayDisplay - Día seleccionado.
   */
  const handleDayClick = (storeName, monthKey, dayDisplay) => {
    const currentDayKey = `${storeName}-${monthKey}-${dayDisplay}`;
    setActiveDayKey(prevKey => prevKey === currentDayKey ? null : currentDayKey);
  };
  
  /**
   * Navega a la página de Rectificación para la sesión seleccionada.
   * Determina el modo inicial según el estado y rol del usuario.
   * @param {object} session - Sesión POS seleccionada.
   */
  const handleRectifySession = (session) => {
    if (!session || session.id === undefined) {
      console.error("No se pudo cargar la información de la sesión para rectificar.");
      setApiError("No se pudo cargar la información de la sesión para rectificar.");
      return;
    }

    let initialMode = 'view_only';
    let viewDraft = false;

    if (session.rectificationStatus === 'sin_rectificar') {
      if (userRole === 'admin') {
        initialMode = 'create';
      } else if (userRole === 'superadmin') {
        // Si hay borrador, el superadmin puede ver el borrador colaborativo
        if (session.hasDraft) {
          viewDraft = true;
        }
        initialMode = 'view_only';
      }
    } else if (session.rectificationStatus === 'pendiente' && userRole === 'superadmin') {
      initialMode = 'review';
    }

    navigate(`/rectificar/${session.id}`, {
      state: {
        sessionInitialData: session,
        mode: initialMode,
        existingRequestId: session.rectificationRequestId || null,
        viewDraft: viewDraft
      }
    });
  };
  
  /**
   * Devuelve el ícono visual para el estado de rectificación de la sesión.
   * @param {string} status - Estado de rectificación.
   * @returns {JSX.Element} Ícono correspondiente.
   */
  const getStatusIcon = (status) => {
    switch (status) {
      case 'aprobada':
        return <span className="material-symbols-outlined status-icon accepted">check_circle</span>;
      case 'pendiente':
        return <span className="material-symbols-outlined status-icon pending">hourglass_empty</span>;
      case 'rechazada':
        return <span className="material-symbols-outlined status-icon rejected">cancel</span>;
      case 'sin_rectificar':
      default:
        return <span className="material-symbols-outlined status-icon not-rectified">radio_button_unchecked</span>;
    }
  };

  /**
   * Determina si el usuario puede interactuar con la rectificación de una sesión.
   * @param {object} session - Sesión POS.
   * @returns {boolean} True si el usuario puede interactuar.
   */
  const canUserInteractWithRectification = (session) => {
    if (!currentUser) return false;
    // Superadmin puede interactuar con solicitudes enviadas o ver sesiones sin rectificar.
    if (userRole === 'superadmin') {
        return session.rectificationStatus !== 'sin_rectificar' || !session.hasDraft; // Pueden ver sin_rectificar si no hay borrador, o los estados enviados.
    }
    
    if (userRole === 'admin') {
      // Admin puede interactuar si la sesión está 'sin_rectificar' (para crear o continuar su borrador).
      if (session.rectificationStatus === 'sin_rectificar') {
        return true;
      }
      // Admin puede visualizar cualquier solicitud existente (pendiente, aprobada o rechazada)
      if (['pendiente', 'aprobada', 'rechazada'].includes(session.rectificationStatus)) {
        return true;
      }
    }
    return false;
  };

  /**
   * Maneja el cambio de filtro de estado en la barra de filtros.
   * @param {Event} event - Evento de cambio del select.
   */
  const handleFilterStatusChange = (event) => {
    const newStatus = event.target.value;
    setFilterStatus(newStatus);
  };

  // --- Renderizado principal de la página de cuadraturas ---
  /**
   * Render principal de la página, incluye:
   * - Barra de filtros por estado.
   * - Vista jerárquica de locales, meses y días.
   * - Tabla de sesiones con acciones según estado y rol.
   * - Manejo de carga y errores.
   */
  return (
    <div className="page-container" style={{ maxWidth: calculatedPageMaxWidth }}>
      <div className="cuadraturas-header-container">
        <button onClick={() => navigate('/home')} title="Ir a Inicio" aria-label="Ir a Inicio" className="cuadraturas-home-icon-button">
          <span className="material-symbols-outlined">home</span>
        </button>
        <h2 className="cuadraturas-header-title">Cuadraturas por Local</h2>
        <button onClick={() => loadAndProcessCuadraturas(true)} disabled={isLoading} title="Recargar Datos" aria-label="Recargar Datos" className="cuadraturas-header-icon-button cuadraturas-refresh-icon-button-header">
          <span className="material-symbols-outlined">{isLoading && hierarchicalData.length > 0 ? 'sync' : 'refresh'}</span>
        </button>
      </div>

      <div className="cuadraturas-content-area">
        <div className="cuadraturas-filter-bar" style={{ marginBottom: '20px', padding: '12px 15px', backgroundColor: '#f8f9fa', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #dee2e6' }}>
            <label htmlFor="statusFilter" style={{ fontWeight: '500', color: '#212529', fontSize: '0.95rem', marginRight: '5px' }}>Filtrar por estado:</label>
            <select
                id="statusFilter"
                value={filterStatus}
                onChange={handleFilterStatusChange}
                style={{ 
                    padding: '8px 12px', 
                    borderRadius: '4px', 
                    border: '1px solid #ced4da', 
                    fontSize: '0.9rem', 
                    minWidth: '240px', 
                    backgroundColor: 'white',
                    color: getOptionColor(filterStatus)
                }}
            >
                <option value="" style={{ color: getOptionColor('') }}>☰ Todas</option>
                <option value="aprobada" style={{ color: getOptionColor('aprobada') }}>✓ Aprobadas</option>
                <option value="rechazada" style={{ color: getOptionColor('rechazada') }}>⊗ Rechazadas</option>
                <option value="pendiente" style={{ color: getOptionColor('pendiente') }}>… Pendientes</option>
                <option value="borrador" style={{ color: getOptionColor('borrador') }}>✎ Borradores</option> 
                <option value="sin_rectificar" style={{ color: getOptionColor('sin_rectificar') }}>○ Sin Rectificar</option>
            </select>
        </div>

        {apiError && <p className="error-message">{apiError}</p>}
        {isLoading && hierarchicalData.length === 0 && <CuadraturasSkeletonLoader />}
        
        {!isLoading && !apiError && (
            <>
                {hierarchicalData.length === 0 && (
                    <p style={{padding: '20px'}}>No se encontraron sesiones para el rango de fechas seleccionado.</p>
                )}
                {hierarchicalData.length > 0 && filteredHierarchicalData.length === 0 && filterStatus !== '' && (
                    <p style={{padding: '20px'}}>
                        {filterStatus === 'borrador' 
                            ? "No hay borradores guardados para sesiones sin rectificar." 
                            : `No hay sesiones con el estado "${formatStatusText(filterStatus)}".`
                        }
                    </p>
                )}
            </>
        )}

        <div className="cuadraturas-hierarchical-view">
          {filteredHierarchicalData.map(storeData => (
            <details key={storeData.storeName} className="store-details-group" open={openStores[storeData.storeName] || false}>
              <summary className="store-summary" onClick={(e) => handleStoreToggle(e, storeData.storeName)}>{storeData.storeName}</summary>
              {(openStores[storeData.storeName] || false) && storeData.months.map(monthData => {
                const monthUniqueKey = `${storeData.storeName}-${monthData.monthKey}`;
                return (
                  <details key={monthData.monthKey} className="month-details-group" open={openMonths[monthUniqueKey] || false}>
                    <summary className="month-summary" onClick={(e) => handleMonthToggle(e, storeData.storeName, monthData.monthKey)}>{monthData.monthDisplay}</summary>
                    {(openMonths[monthUniqueKey] || false) && (
                      <ul className="day-list">
                        {monthData.days.map(dayData => {
                          const currentDayKey = `${storeData.storeName}-${monthData.monthKey}-${dayData.dayDisplay}`;
                          const isActive = activeDayKey === currentDayKey;
                          
                          const dayTextSuffixParts = [];
                          if (dayData.sessions.length > 0) {
                            dayTextSuffixParts.push(`${dayData.sessions.length} ses.`);
                            // Para el modelo por usuario, hasDraft ahora indica si el admin actual tiene un borrador.
                          const draftsInDayCount = dayData.sessions.filter(s => s.hasDraft && s.rectificationStatus === 'sin_rectificar').length;
                          if (draftsInDayCount > 0) {
                            dayTextSuffixParts.push(`${draftsInDayCount} con borrador`);
                          }
                          }
                          const dayTextSuffix = dayTextSuffixParts.length > 0 ? ` (${dayTextSuffixParts.join(', ')})` : '';

                          return (
                            <React.Fragment key={dayData.dayDisplay}>
                              <li
                                className={`day-list-item ${isActive ? 'active' : ''}`}
                                onClick={() => handleDayClick(storeData.storeName, monthData.monthKey, dayData.dayDisplay)}
                              >
                                <span>Día {dayData.dayDisplay}{dayTextSuffix}</span>
                                <span className="day-item-indicator material-symbols-outlined">
                                  {isActive ? 'expand_less' : 'expand_more'}
                                </span>
                              </li>
                              {isActive && (
                                <li className="day-table-wrapper">
                                  <div className="active-day-sessions-container">
                                    <div className="sessions-table-container">
                                      <table className="sessions-table">
                                        <thead>
                                          <tr>
                                            <th>Usuario</th>
                                            <th>Apertura</th>
                                            <th>Cierre</th>
                                            <th>Saldo Inicial</th>
                                            <th>Efectivo Contado</th>
                                            <th>Estado Rectificación</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {dayData.sessions.map((session) => (
                                            <tr key={session.id}>
                                              <td>{Array.isArray(session.user_id) ? session.user_id[1] : 'N/A'}</td>
                                              <td>{formatDateTime(session.start_at)}</td>
                                              <td>{formatDateTime(session.stop_at)}</td>
                                              <td className="currency" style={{color: '#000000'}}>{formatCurrency(session.cash_register_balance_start)}</td>
                                              <td className="currency" style={{color: '#000000'}}>{formatCurrency(session.cash_register_balance_end_real)}</td>
                                              <td
                                                className={`status-cell ${
                                                  (canUserInteractWithRectification(session) || (userRole === 'superadmin' && session.rectificationStatus === 'sin_rectificar' && session.hasDraft))
                                                    ? 'clickable'
                                                    : 'not-clickable'
                                                }`}
                                                onClick={() => {
                                                  if (canUserInteractWithRectification(session) || (userRole === 'superadmin' && session.rectificationStatus === 'sin_rectificar' && session.hasDraft)) {
                                                    handleRectifySession(session);
                                                  }
                                                }}
                                                title={
                                                  canUserInteractWithRectification(session)
                                                    ? (session.rectificationStatus === 'sin_rectificar'
                                                        ? (session.hasDraft && userRole === 'admin'
                                                            ? 'Continuar Borrador'
                                                            : (session.hasDraft && userRole === 'superadmin'
                                                                ? 'Ver Borrador'
                                                                : 'Crear Solicitud de Rectificación'))
                                                        : 'Ver/Gestionar Solicitud')
                                                    : (userRole === 'superadmin' && session.rectificationStatus === 'sin_rectificar' && session.hasDraft
                                                        ? 'Ver Borrador'
                                                        : 'Rectificación no disponible')
                                                }
                                              >
                                                {getStatusIcon(session.rectificationStatus)}
                                                <span className="status-text"> {formatStatusText(session.rectificationStatus)}
                                                  {session.rectificationStatus === 'sin_rectificar' && session.hasDraft && ' (B)'}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </li>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </ul>
                    )}
                  </details>
                );
              })}
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CuadraturasPage;
