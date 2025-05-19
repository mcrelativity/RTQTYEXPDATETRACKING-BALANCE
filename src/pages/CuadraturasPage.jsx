import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase/firebaseConfig';
import { ref, get } from "firebase/database";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_ENDPOINT = `${API_BASE_URL}/odoo`;
const BEARER_TOKEN = import.meta.env.VITE_API_BEARER_TOKEN;

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
      } catch (e) { }
      throw new Error(errorMsg);
    }
    return await response.json();
  } catch (error) {
    console.error("Error calling Odoo API:", error);
    throw error;
  }
}

async function fetchPosSessions(apiUrl, startDate, endDate) {
  const requestData = {
    model: "pos.session",
    filters: [[["start_at", ">=", startDate], ["start_at", "<=", endDate]]],
    fields: [
      "id", "name", "user_id", "start_at", "stop_at", "crm_team_id",
      "cash_register_balance_start", "cash_register_balance_end_real",
      "cash_register_difference", "cash_register_balance_end", "cash_real_transaction"
    ],
    method: "search_read",
    limit: 1000,
    order: "start_at DESC"
  };
  return await callOdooApi(apiUrl, requestData);
}

const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    try {
        const date = new Date(dateTimeString);
        return date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) { return dateTimeString; }
};

const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return 'N/A';
    const numAmount = Number(amount);
    if (isNaN(numAmount)) return 'Inválido';
    return numAmount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
};

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function CuadraturasPage() {
  const navigate = useNavigate();
  const { currentUser, userRole } = useAuth();
  const [hierarchicalData, setHierarchicalData] = useState([]);
  const [activeDayKey, setActiveDayKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [openStores, setOpenStores] = useState({});
  const [openMonths, setOpenMonths] = useState({});
  const [filterStatus, setFilterStatus] = useState('');
  const calculatedPageMaxWidth = '1300px';

  const getOptionColor = (statusValue) => {
    switch (statusValue) {
        case 'aprobada': return '#198754';
        case 'rechazada': return '#dc3545';
        case 'pendiente': return '#ffc107';
        case 'sin_rectificar': return '#6c757d';
        case '': 
        default: return '#212529'; 
    }
  };

  const loadAndProcessCuadraturas = useCallback(async (showLoadingIndicator = true) => {
    if(showLoadingIndicator) setIsLoading(true);
    setApiError(null);

    const today = new Date();
    const formatDateForAPI = (date, time) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day} ${time}`;
    };

    const endDateObj = new Date(today);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const startDateObj = new Date(today);
    startDateObj.setDate(startDateObj.getDate() - 30);

    const startDate = formatDateForAPI(startDateObj, "00:00:00");
    const endDate = formatDateForAPI(endDateObj, "03:59:59");

    try {
      const sessionsFromApi = await fetchPosSessions(API_ENDPOINT, startDate, endDate);
      if (!Array.isArray(sessionsFromApi)) throw new Error("La respuesta de sesiones no es un array válido.");

      const rectificationRequestsRef = ref(database, 'rectificationRequests');
      const rectificationSnapshot = await get(rectificationRequestsRef);
      const rectificationData = rectificationSnapshot.exists() ? rectificationSnapshot.val() : {};
      
      const rectificationStatusBySessionId = {};
      Object.entries(rectificationData).forEach(([reqId, req]) => {
        if (req.sessionId) {
            if (!rectificationStatusBySessionId[req.sessionId] || req.submittedAt > (rectificationStatusBySessionId[req.sessionId].submittedAt || 0) ) {
                rectificationStatusBySessionId[req.sessionId] = { status: req.status, submittedAt: req.submittedAt, requestId: reqId, requestData: req };
            }
        }
      });

      const sessionsWithRectificationStatus = sessionsFromApi.map(session => {
        const rectificationInfo = rectificationStatusBySessionId[session.id];
        return {
          ...session,
          rectificationStatus: rectificationInfo ? rectificationInfo.status : 'sin_rectificar',
          rectificationRequestId: rectificationInfo ? rectificationInfo.requestId : null,
          rectificationRequestDetails: rectificationInfo ? rectificationInfo.requestData : null,
        };
      });

      const sessionsByStoreMonthDay = sessionsWithRectificationStatus.reduce((acc, session) => {
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
  }, []);

  useEffect(() => {
    loadAndProcessCuadraturas();
  }, [loadAndProcessCuadraturas]);

  const filteredHierarchicalData = useMemo(() => {
    if (!filterStatus) {
        return hierarchicalData;
    }
    return hierarchicalData.map(storeData => {
        const filteredMonths = storeData.months.map(monthData => {
            const filteredDays = monthData.days.map(dayData => {
                const sessions = dayData.sessions.filter(session => session.rectificationStatus === filterStatus);
                return { ...dayData, sessions };
            }).filter(dayData => dayData.sessions.length > 0);

            return { ...monthData, days: filteredDays };
        }).filter(monthData => monthData.days.length > 0);

        return { ...storeData, months: filteredMonths };
    }).filter(storeData => storeData.months.length > 0);
  }, [hierarchicalData, filterStatus]);

  const handleStoreToggle = (e, storeName) => {
    e.preventDefault();
    setOpenStores(prev => ({ ...prev, [storeName]: !prev[storeName] }));
  };

  const handleMonthToggle = (e, storeName, monthKey) => {
    e.preventDefault();
    const combinedKey = `${storeName}-${monthKey}`;
    setOpenMonths(prev => ({ ...prev, [combinedKey]: !prev[combinedKey] }));
  };

  const handleDayClick = (storeName, monthKey, dayDisplay) => {
    const currentDayKey = `${storeName}-${monthKey}-${dayDisplay}`;
    setActiveDayKey(prevKey => prevKey === currentDayKey ? null : currentDayKey);
  };
  
  const handleRectifySession = (session) => {
    if (!session || session.id === undefined) {
        console.error("No se pudo cargar la información de la sesión para rectificar.");
        setApiError("No se pudo cargar la información de la sesión para rectificar.");
        return;
    }

    let initialMode = 'view_only';
    if (session.rectificationStatus === 'sin_rectificar' && (userRole === 'admin' || userRole === 'superadmin')) {
      initialMode = 'create';
    } else if (session.rectificationStatus === 'pendiente' && userRole === 'superadmin') {
      initialMode = 'review';
    }
    
    const sessionId = session.id;
    navigate(`/rectificar/${sessionId}`, {
      state: {
        sessionInitialData: session,
        mode: initialMode,
        existingRequestId: session.rectificationRequestId || null
      }
    });
  };
  
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

  const canUserInteractWithRectification = (session) => {
    if (!currentUser) return false;
    if (userRole === 'superadmin') return true;
    if (userRole === 'admin' && (session.rectificationStatus === 'sin_rectificar' || 
        (session.rectificationRequestDetails && session.rectificationRequestDetails.submittedByUid === currentUser.uid && session.rectificationStatus === 'pendiente')
       )) return true;
    return false;
  };

  const handleFilterStatusChange = (event) => {
    const newStatus = event.target.value;
    setFilterStatus(newStatus);
  };

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
                <option value="sin_rectificar" style={{ color: getOptionColor('sin_rectificar') }}>○ Sin Rectificar</option>
            </select>
        </div>

        {apiError && <p className="error-message">{apiError}</p>}
        {isLoading && hierarchicalData.length === 0 && <p style={{padding: '20px'}}>Cargando sesiones...</p>}
        
        {!isLoading && !apiError && (
            <>
                {hierarchicalData.length === 0 && (
                    <p style={{padding: '20px'}}>No se encontraron sesiones para el rango de fechas seleccionado.</p>
                )}
                {hierarchicalData.length > 0 && filteredHierarchicalData.length === 0 && filterStatus !== '' && (
                    <p style={{padding: '20px'}}>No hay sesiones con el estado "{filterStatus.replace(/_/g, ' ')}".</p>
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
                          return (
                            <React.Fragment key={dayData.dayDisplay}>
                              <li
                                className={`day-list-item ${isActive ? 'active' : ''}`}
                                onClick={() => handleDayClick(storeData.storeName, monthData.monthKey, dayData.dayDisplay)}
                              >
                                <span>Día {dayData.dayDisplay} ({dayData.sessions.length} ses.)</span>
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
                                            <th>Persona</th>
                                            <th>Apertura</th>
                                            <th>Cierre</th>
                                            <th>Saldo Inicial</th>
                                            <th>Efectivo Contado</th>
                                            <th>Diferencia</th>
                                            <th>Estado Rectificación</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {dayData.sessions.map((session) => (
                                            <tr key={session.id}>
                                              <td>{Array.isArray(session.user_id) ? session.user_id[1] : 'N/A'}</td>
                                              <td>{formatDateTime(session.start_at)}</td>
                                              <td>{formatDateTime(session.stop_at)}</td>
                                              <td className="currency">{formatCurrency(session.cash_register_balance_start)}</td>
                                              <td className="currency">{formatCurrency(session.cash_register_balance_end_real)}</td>
                                              <td
                                                className={`currency difference-cell ${session.rectificationStatus !== 'sin_rectificar' ? `status-${session.rectificationStatus}-text` : ''} ${canUserInteractWithRectification(session) ? 'clickable' : 'not-clickable'}`}
                                                onClick={() => canUserInteractWithRectification(session) && handleRectifySession(session)}
                                                title={canUserInteractWithRectification(session) ? (session.rectificationStatus === 'sin_rectificar' ? "Crear Solicitud de Rectificación" : "Ver/Gestionar Solicitud") : "Rectificación no disponible"}
                                              >
                                                {formatCurrency(session.cash_register_difference)}
                                              </td>
                                              <td className={`status-cell ${canUserInteractWithRectification(session) ? 'clickable' : 'not-clickable'}`}
                                                  onClick={() => canUserInteractWithRectification(session) && handleRectifySession(session)}
                                                  title={canUserInteractWithRectification(session) ? (session.rectificationStatus === 'sin_rectificar' ? "Crear Solicitud de Rectificación" : "Ver/Gestionar Solicitud") : "Rectificación no disponible"}
                                              >
                                                {getStatusIcon(session.rectificationStatus)}
                                                <span className="status-text"> {session.rectificationStatus.replace(/_/g, ' ')}</span>
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