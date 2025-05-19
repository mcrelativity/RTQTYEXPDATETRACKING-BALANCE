# Rastreador de Stock y Vencimientos + Sistema de Cuadraturas

Aplicación web interna integral desarrollada con React y Firebase. Originalmente diseñada para el seguimiento de stock y vencimientos de productos farmacéuticos, se ha expandido para incluir un robusto módulo de cuadraturas y rectificación de cierres de caja. Permite la gestión de inventario, la visualización y filtro de sesiones de caja (integrado con Odoo), y un flujo detallado para la solicitud, justificación y aprobación/rechazo de rectificaciones de caja. Incluye gestión de usuarios por roles (user, admin y superadmin) con asignación a locales y permisos específicos por módulo.

## Características Principales ✨

### Gestión de Stock y Vencimientos
* Login de usuarios a través de Firebase Authentication.
* Roles de usuario (User, Admin, SuperAdmin) con asignación a locales específicos almacenados en Realtime Database.
* Búsqueda de productos por código de barras (soporta múltiples códigos por producto) usando un índice en Realtime Database.
* Exportación a Excel de información de Stock, Vencimientos, ROP, Información del Producto, Etc.
* Formulario de ingreso de stock: Cantidad y Fecha de Vencimiento (Mes/Año).
* Almacenamiento detallado de cada entrada de stock por local (`/stock/{storeId}/{productId}/entries`).
* Registro de usuario (email) y timestamp del servidor en cada entrada de stock.
* Vista de Administrador para visualizar todas las entradas de stock de todos los locales, con funcionalidad de búsqueda y secciones colapsables por local.

### Módulo de Cuadraturas de Caja
* Visualización de sesiones de caja obtenidas de una API externa (Odoo), agrupadas jerárquicamente por local, mes y día.
* Integración con Firebase para mostrar el estado de las solicitudes de rectificación asociadas a cada sesión (pendiente, aprobada, rechazada, sin rectificar).
* Filtro interactivo en la vista de cuadraturas para visualizar sesiones según el estado de su rectificación (con indicadores visuales en las opciones del filtro).
* Navegación contextual a la pantalla de detalle para rectificar o revisar una sesión de caja específica.

### Módulo de Rectificación de Cierres de Caja
* Interfaz dedicada para la creación (rol Admin) y revisión/aprobación (rol Superadmin) de solicitudes de rectificación de cierres de caja.
* Comparación detallada de saldos de sistema (API Odoo) versus saldos físicos para efectivo y múltiples medios de pago.
* Funcionalidad para ingresar múltiples justificaciones (monto y motivo) para cada medio de pago que presente diferencias.
* Modal para la visualización consolidada y estructurada (formato de tabla) de todas las justificaciones ingresadas para un método de pago específico.
* Capacidad para registrar gastos adicionales y boletas pendientes como parte del proceso de rectificación.
* Flujo de aprobación o rechazo de solicitudes de rectificación por parte de Superadministradores, con campo para registrar comentarios o motivos de la decisión.
* Indicadores visuales dinámicos (iconos de advertencia/OK con colores distintivos) en la interfaz del Superadministrador, basados en la existencia de diferencias no justificadas en los métodos de pago.

### Generales
* Interfaz de usuario minimalista e intuitiva.
* Navegación entre páginas implementada con React Router DOM.
* Gestión de estado de autenticación global mediante React Context API.
* Layout principal consistente con información del usuario/local y botón de logout.

## Tech Stack 💻

* **Frontend:** React (v18+) con Vite, JavaScript (ES6+), CSS3
* **Backend & Database:** Firebase
    * Firebase Authentication (Email/Password)
    * Firebase Realtime Database
* **Routing:** React Router DOM (v6)
* **Estado Global:** React Context API
* **Integración de Datos Externos:** Consumo de API de Odoo para información de sesiones de caja.
* **(Proceso Inicial):** Script de Python con Pandas y Openpyxl para conversión de Excel a JSON.
* **(Proceso Final):** Uso de librería SheetJS (xlsx) para conversión y exportación de JSON a Excel.
