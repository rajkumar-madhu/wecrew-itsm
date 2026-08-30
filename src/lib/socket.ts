/* See the note in lib/api.ts — this was a self-recursive function. The legacy
   key migration is handled once, correctly, in authStore's onRehydrateStorage. */
const AUTH_STORAGE_KEY = 'wecrew-auth';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored).state?.token : null;
  } catch {
    return null;
  }
}

function getSocket(): Socket {
  if (!socket) {
    // Prefer same-origin proxy (/socket.io → API). Override with VITE_SOCKET_URL if set.
    const url = import.meta.env.VITE_SOCKET_URL || undefined;
    socket = io(url || '/', {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      path: '/socket.io',
    });
    // Suppress noisy console errors — WS is optional
    socket.on('connect_error', () => {});
    socket.on('disconnect', () => {});
    socket.on('error', () => {});
  }
  return socket;
}

export function useSocket(): Socket {
  const socketRef = useRef<Socket>(getSocket());
  useEffect(() => {
    const s = socketRef.current;
    // Refresh token before connecting
    s.auth = { token: getToken() };
    if (!s.connected && getToken()) s.connect();
    return () => {};
  }, []);
  return socketRef.current;
}

export function emitEvent<T = unknown>(event: string, data?: T): void {
  const s = getSocket();
  if (s.connected) s.emit(event, data);
}

export function onEvent<T = unknown>(event: string, cb: (data: T) => void): () => void {
  const s = getSocket();
  s.on(event, cb as (...args: unknown[]) => void);
  return () => { s.off(event, cb as (...args: unknown[]) => void); };
}

export function disconnectSocket(): void {
  if (socket) { socket.disconnect(); socket = null; }
}
