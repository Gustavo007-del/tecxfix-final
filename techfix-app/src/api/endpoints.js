// E:\study\techfix\techfix-app\src\api\endpoints.js
const API_ENDPOINTS = {
  // Authentication - FIXED
  LOGIN_TECHNICIAN: '/login/technician/',
  LOGIN_ADMIN: '/login/admin/',
  REFRESH_TOKEN: '/token/refresh/',
  
  // User
  CURRENT_USER: '/users/me/',
  
  // Stock
  COMPANY_STOCK: '/company-stock/',
  MY_STOCK: '/my-stock/',
  
  // Courier
  COURIER_CREATE: '/create-courier/',
  COURIER_LIST: '/courier-list/',
  COURIER_DETAIL: (id) => `/courier/${id}/`,
  COURIER_RECEIVE: (id) => `/mark-received/${id}/`,
  PENDING_COURIERS: '/pending-couriers/',
  TECHNICIANS_FOR_COURIER: '/technicians-for-courier/',
  COURIER_PDF: (id) => `/courier/${id}/pdf/`,
  MY_COURIER_HISTORY: '/my-courier-history/',
  
  // Technician
  TECHNICIAN_LIST: '/technicians/',
};

export default API_ENDPOINTS;