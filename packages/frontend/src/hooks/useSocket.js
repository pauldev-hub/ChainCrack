/**
 * Custom hook for Socket.IO connection management
 * 
 * @file packages/frontend/src/hooks/useSocket.js
 */

import { useEffect, useState } from 'react';
import { getSocket } from '../services/socketService';

/**
 * Hook to manage Socket.IO connection lifecycle
 * 
 * @returns {Object} Socket instance and connection status
 */
export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const sharedSocket = getSocket();
    setSocket(sharedSocket);
    setIsConnected(sharedSocket.connected);

    const onConnect = () => {
      setIsConnected(true);
      console.log('✓ Socket connected');
    };

    const onDisconnect = () => {
      setIsConnected(false);
      console.log('✗ Socket disconnected');
    };

    sharedSocket.on('connect', onConnect);
    sharedSocket.on('disconnect', onDisconnect);

    return () => {
      sharedSocket.off('connect', onConnect);
      sharedSocket.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket, isConnected };
};

export default useSocket;
