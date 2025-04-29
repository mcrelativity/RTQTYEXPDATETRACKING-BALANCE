# Rastreador de Stock y Vencimientos 

Aplicación web interna desarrollada con React y Firebase para el seguimiento de ingresos de stock y fechas de vencimiento de productos farmacéuticos en múltiples locales. Permite buscar productos por código de barras, registrar nuevas entradas de stock con cantidad y vencimiento, visualizar el inventario registrado y además exportar a Excel información necesaria. Incluye gestión de usuarios por roles (user, admin y superadmin) y asignación a locales específicos.

## Características Principales ✨

* Login de usuarios predefinidos a través de Firebase Authentication.
* Roles de usuario (User, Admin, SuperAdmin) con asignación a locales específicos almacenados en Realtime Database.
* Búsqueda de productos por código de barras (soporta múltiples códigos por producto) usando un índice en Realtime Database.
* Exportación a Excel.
* Formulario de ingreso de stock: Cantidad y Fecha de Vencimiento (Mes/Año).
* Almacenamiento detallado de cada entrada de stock por local (`/stock/{storeId}/{productId}/entries`).
* Registro de usuario (email) y timestamp del servidor en cada entrada de stock.
* Vista de Administrador para visualizar todas las entradas de stock de todos los locales.
* Funcionalidad de búsqueda dentro de la vista de Administrador.
* Vista de Administrador con secciones colapsables por local para mejor organización.
* Interfaz de usuario básica y funcional con CSS simple.
* Navegación entre páginas con React Router DOM.
* Gestión de estado de autenticación global con React Context API.
* Layout principal consistente con información del usuario/local y botón de logout.

## Tech Stack 💻

* **Frontend:** React (v18+) con Vite, JavaScript (ES6+), CSS3
* **Backend & Database:** Firebase
    * Firebase Authentication (Email/Password)
    * Firebase Realtime Database
* **Routing:** React Router DOM (v6)
* **Estado Global:** React Context API
* **(Proceso Inicial):** Script de Python con Pandas y Openpyxl para conversión de Excel a JSON.
