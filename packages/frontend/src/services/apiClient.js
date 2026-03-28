/**
 * Axios API client
 * 
 * Handles HTTP requests to backend REST API
 * 
 * @file packages/frontend/src/services/apiClient.js
 */

import axios from 'axios';

/**
 * Create configured axios instance
 * 
 * @returns {Object} Axios instance
 */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default client;
