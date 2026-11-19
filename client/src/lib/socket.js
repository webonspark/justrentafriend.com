import { io } from "socket.io-client";
import { getAccessToken } from "../services/api";

/**
 * One socket per signed-in tab, for live chat and notifications.
 * It signs in with the in-memory access token, read afresh on every
 * reconnect, so a refreshed token is picked up automatically.
 */
let socket = null;

export function connectSocket() {
  const token = getAccessToken();
  if (!token) return null;
  if (socket) return socket;
  socket = io(import.meta.env.VITE_API_URL || "/", {
    path: "/socket.io",
    // A function, so every reconnect presents the current access token.
    auth: (cb) => cb({ token: getAccessToken() }),
    transports: ["websocket", "polling"],
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
