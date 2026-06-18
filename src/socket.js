import { io } from "socket.io-client";

const API_URL =
  process.env.REACT_APP_API_URL ||
  "https://entryapi.entryus.xyz/api" ||
  "https://4frnn03l-3016.inc1.devtunnels.ms/api";
const getSocketUrl = () => {
  if (process.env.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;
  return API_URL.replace(/\/api\/?$/, "");
};

const SOCKET_URL = getSocketUrl();

let socket = null;

export function createSocket(auth) {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: auth || undefined,
  });

  socket.onAny((event, ...args) => {
    // keep a light log in development
    if (process.env.NODE_ENV === "development")
      console.log("socket:", event, args);
  });

  return socket;
}

export function connectSocket(auth) {
  const s = createSocket(auth);
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) {
    try {
      socket.disconnect();
    } catch (e) {}
    socket = null;
  }
}
