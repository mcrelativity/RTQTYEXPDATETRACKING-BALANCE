[English](./README.md) | [Español](./README.es.md) 

# Stock and Expiry Tracker + Cash Balancing System

Comprehensive internal web application developed with React and Firebase. Originally designed for tracking stock and expiry dates of pharmaceutical products, it has expanded to include a robust module for cash balancing and till closure rectification. It allows for inventory management, viewing and filtering of cash sessions (integrated with Odoo), and a detailed workflow for requesting, justifying, and approving/rejecting cash rectifications. It includes user management by roles (user, admin, and superadmin) with assignment to stores and specific module permissions.

## Main Features ✨

### Stock and Expiry Management
* User login via Firebase Authentication.
* User roles (User, Admin, SuperAdmin) with assignment to specific stores, stored in Realtime Database.
* Product search by barcode (supports multiple codes per product) using an index in Realtime Database.
* Export to Excel of Stock, Expiry, ROP (Reorder Point), Product Information, Etc.
* Stock entry form: Quantity and Expiry Date (Month/Year).
* Detailed storage of each stock entry per store (`/stock/{storeId}/{productId}/entries`).
* User (email) and server timestamp logging for each stock entry.
* Administrator view to display all stock entries from all stores, with search functionality and collapsible sections per store.

### Cash Balancing Module
* Visualization of cash sessions obtained from an external API (Odoo), grouped hierarchically by store, month, and day.
* Integration with Firebase to display the status of rectification requests associated with each session (pending, approved, rejected, unrectified).
* Interactive filter in the balancing view to display sessions according to their rectification status (with visual indicators in the filter options).
* Contextual navigation to the detail screen to rectify or review a specific cash session.

### Till Closure Rectification Module
* Dedicated interface for creating (Admin role) and reviewing/approving (Superadmin role) till closure rectification requests.
* Detailed comparison of system balances (Odoo API) versus physical balances for cash and multiple payment methods.
* Functionality to enter multiple justifications (amount and reason) for each payment method that shows discrepancies.
* Modal for consolidated and structured (table format) visualization of all justifications entered for a specific payment method.
* Ability to register additional expenses and pending receipts as part of the rectification process.
* Approval or rejection workflow for rectification requests by Superadmins, with a field to record comments or reasons for the decision.
* Dynamic visual indicators (warning/OK icons with distinctive colors) in the Superadmin interface, based on the existence of unjustified discrepancies in payment methods.

### General
* Minimalist and intuitive user interface.
* Page navigation implemented with React Router DOM.
* Global authentication state management using React Context API.
* Consistent main layout with user/store information and logout button.

## Tech Stack 💻
* **Frontend:** React (v18+) with Vite, JavaScript (ES6+), CSS3
* **Backend & Database:** Node.js, Firebase
    * Firebase Authentication (Email/Password)
    * Firebase Realtime Database
* **Routing:** React Router DOM (v6)
* **Global State:** React Context API
* **External Data Integration:** Consumption of Odoo API for cash session information.
* **(Initial Process):** Python script with Pandas and Openpyxl for Excel to JSON conversion.
* **(Final Process):** Use of SheetJS library (xlsx) for JSON to Excel conversion and export.

<img width="1911" height="938" alt="image" src="https://github.com/user-attachments/assets/0f8b4281-4016-440e-9d23-c51b244dbad9" />

<img width="1915" height="944" alt="image" src="https://github.com/user-attachments/assets/4cb02326-821c-491d-a84a-76d8e2d153e6" />

<img width="1901" height="941" alt="image" src="https://github.com/user-attachments/assets/a1f93ab1-87e7-41dd-ac5f-6a269287565f" />
<img width="1916" height="940" alt="image" src="https://github.com/user-attachments/assets/1c46bbb0-d2d0-4dd6-9e22-75070f42dbe8" />
<img width="1898" height="940" alt="image" src="https://github.com/user-attachments/assets/8f8ef451-7c7b-4239-9067-a6ee72a10329" />



