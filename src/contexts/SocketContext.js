// // src/context/SocketContext.js
// import React, { createContext, useContext, useEffect, useState } from 'react';
// import { io } from 'socket.io-client';

import { createContext, useContext, useEffect, useState } from "react";
import useAuth from "./Auth";
import { io } from "socket.io-client";

// const SocketContext = createContext();

// export const useSocket = () => useContext(SocketContext);

// export const SocketProvider = ({ children, userId }) => {
//     const [socket, setSocket] = useState(null);

//     useEffect(() =>
//         const newSocket = io('http://localhost:4444');
//         setSocket(newSocket);

//         if (userId) {
//             newSocket.emit('register', userId);
//         }

//         return () => newSocket.close();
//     }, [userId]);

//     return (
//         <SocketContext.Provider value={socket}>
//             {children}
//         </SocketContext.Provider>
//     );
// };

export const SocketContext = createContext();

export const userSocketContext = () => {
  // return useContext(SocketContext)
};

export const SocketContextProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(null);
  const { cookies } = useAuth();
  useEffect(() => {
    if (cookies?.token) {
      const socket = io("https://4frnn03l-3000.inc1.devtunnels.ms/", {
        query: {
          userId: cookies.id,
        },
      });
      setSocket(socket);
      socket.on("getOnlineUsers", (user) => {
        setOnlineUsers(user);
      });
      return () => socket.close();
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
      }
    }
  }, []);
  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};
