import { io, Socket } from 'socket.io-client';
import { getServerUrl } from './config';
import type { AlertItem } from './api';

let socketInstance: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  const serverUrl = await getServerUrl();

  if (!socketInstance || !socketInstance.connected) {
    if (socketInstance) {
      socketInstance.disconnect();
    }

    socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected to OccupEye live server:', serverUrl);
    });

    socketInstance.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message);
    });
  }

  return socketInstance;
}

export async function onNewAlert(callback: (alert: AlertItem) => void): Promise<() => void> {
  const socket = await getSocket();
  socket.on('alert', callback);
  return () => {
    socket.off('alert', callback);
  };
}

export async function onAlertResolved(callback: (alert: AlertItem) => void): Promise<() => void> {
  const socket = await getSocket();
  socket.on('alert:resolved', callback);
  return () => {
    socket.off('alert:resolved', callback);
  };
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
