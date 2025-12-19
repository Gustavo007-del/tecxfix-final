// E:\study\techfix\techfix-app\src\api\client.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_ENDPOINTS from './endpoints';

const API_BASE_URL = 'http:/192.168.43.128:8000/api';  // Update your IP!

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests
client.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses (expired token)
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        
        if (refreshToken) {
          const response = await axios.post(
            `${API_BASE_URL}/token/refresh/`,
            { refresh: refreshToken }
          );

          if (response.data.access) {
            await AsyncStorage.setItem('access_token', response.data.access);
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
            return client(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('role');
        await AsyncStorage.removeItem('user');
      }
    }

    return Promise.reject(error);
  }
);

export { API_ENDPOINTS };
export default client;