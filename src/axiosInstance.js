import { STAGING_BASE_URL } from "./config";
import axios from "axios";

// Create an instance of Axios for the Admin console
const axiosInstance = axios.create({
  baseURL: STAGING_BASE_URL, // Using deployed staging backend
  withCredentials: true, // Ensures cookies are sent if needed
  headers: {
    "Content-Type": "application/json",
  },
});

// Debug Log: Log All Outgoing Requests
axiosInstance.interceptors.request.use((config) => {
  console.log(`[Admin] Request made with URL: ${config.baseURL}${config.url}`);
  return config;
});

// Debug Log: Log API Responses
axiosInstance.interceptors.response.use(
  (response) => {
    console.log(`[Admin] Response from ${response.config.url}:`, response.data);
    return response;
  },
  (error) => {
    console.error(`[Admin] API Error at ${error.config?.url}:`, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default axiosInstance;
