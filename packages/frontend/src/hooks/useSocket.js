/**
 * Custom hook for Socket.IO connection management
 * 
 * @file packages/frontend/src/hooks/useSocket.js
 */

import { useEffect, useState } from 'react';
import { initializeSocket } from '../services/socketService';

/**
 * Hook to manage Socket.IO connection lifecycle
 * 
 * @returns {Object} Socket instance and connection status
 */
export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = initializeSocket();

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('✓ Socket connected');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('✗ Socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return { socket, isConnected };
};

export default useSocket;
