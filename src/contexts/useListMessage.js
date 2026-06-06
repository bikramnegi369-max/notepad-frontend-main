import { useEffect, useState } from "react";
import { useSocket } from "./SocketContext";

const useListMessage = () => {
  const { socket } = useSocket() || {};
  const [messageList, setMessageList] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handler = (data) => setMessageList(data || []);
    socket.on("messageList", handler);
    return () => {
      try {
        socket.off("messageList", handler);
      } catch (e) {}
    };
  }, [socket]);

  return messageList;
};

export default useListMessage;
