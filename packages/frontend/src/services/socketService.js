/**
 * Socket.IO client service
 * 
 * Manages WebSocket connection and real-time event handling
 * 
 * @file packages/frontend/src/services/socketService.js
 */

import { io } from 'socket.io-client';

/**
 * Initialize Socket.IO client connection
 * 
 * @returns {Object} Socket.IO instance
 */
export const initializeSocket = () => {
  const socket = io(import.meta.env.VITE_WS_URL || 'ws://localhost:5000', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  return socket;
};

export default { initializeSocket };
