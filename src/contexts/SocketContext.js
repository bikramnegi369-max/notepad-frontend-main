// // src/context/SocketContext.js
// import React, { createContext, useContext, useEffect, useState } from 'react';
// import { io } from 'socket.io-client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import useAuth from "./Auth";
import { createSocket, disconnectSocket } from "../socket";

export const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketContextProvider = ({ children }) => {
  const { cookies } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const handleOnline = useCallback((users) => {
    setOnlineUsers(users || []);
  }, []);

  const connect = useCallback(() => {
    if (!cookies?.token) return null;
    let s = socketRef.current;
    if (!s) {
      s = createSocket(cookies.token);
      socketRef.current = s;
      setSocket(s);
      s.on("getOnlineUsers", handleOnline);
      s.on("users", handleOnline);
    }
    if (!s.connected) s.connect();
    return s;
  }, [cookies?.token, handleOnline]);

  const disconnect = useCallback(() => {
    if (!socketRef.current) return;
    try {
      socketRef.current.off("getOnlineUsers", handleOnline);
      socketRef.current.off("users", handleOnline);
    } catch (e) {}
    disconnectSocket();
    socketRef.current = null;
    setSocket(null);
    setOnlineUsers([]);
  }, [handleOnline]);

  useEffect(() => {
    if (!cookies?.token) {
      disconnect();
    }
  }, [cookies?.token, disconnect]);

  return (
    <SocketContext.Provider
      value={{ socket, onlineUsers, connect, disconnect }}
    >
      {children}
    </SocketContext.Provider>
  );
};
