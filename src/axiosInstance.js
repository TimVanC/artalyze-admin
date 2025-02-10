import { BASE_URL } from "./config";
import axios from 'axios';

// Create an instance of Axios for the Admin console
const axiosInstance = axios.create({
  baseURL: BASE_URL, // Updated to use deployed backend
  withCredentials: true, // Include credentials if needed
  headers: {
    'Content-Type': 'application/json',
  },
});

// Debug Log: Use an interceptor to log all outgoing requests
axiosInstance.interceptors.request.use((config) => {
  console.log('[Admin] Request made with URL:', config.url);
  return config;
});

export default axiosInstance;
