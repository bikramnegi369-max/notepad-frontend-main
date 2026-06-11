import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";
import { useSocket } from "./SocketContext";

const ListMessageContext = createContext();

const READ_LOCK_MS = 5000; // ignore server unread counts for 5s after marking read

export const ListMessageProvider = ({ children }) => {
  const { socket } = useSocket() || {};
  const [messageList, setMessageList] = useState([]);
  const readLocksRef = useRef({}); // { [conversationId]: lockedAtTimestamp }

  const markConversationRead = useCallback((targetId) => {
    if (!targetId) return;

    // Set a read lock so incoming server messageList updates
    // don't re-stamp this conversation with a stale unread count
    readLocksRef.current[String(targetId)] = Date.now();

    setMessageList((prev) =>
      prev.map((conv) => {
        const id = conv.id || conv._id || conv.sender || conv.from || conv.to;
        if (id && String(id) === String(targetId)) {
          return { ...conv, unread: 0, newMessages: 0 };
        }
        return conv;
      }),
    );
  }, []);

  // New method to update a specific conversation's unread count
  const updateConversationUnread = useCallback(
    (conversationId, unreadCount) => {
      if (!conversationId) return;

      setMessageList((prev) =>
        prev.map((conv) => {
          const id = conv.id || conv._id || conv.sender || conv.from || conv.to;
          if (id && String(id) === String(conversationId)) {
            return { ...conv, unread: unreadCount, newMessages: unreadCount };
          }
          return conv;
        }),
      );
    },
    [],
  );

  useEffect(() => {
    if (!socket) return;

    const handler = (data) => {
      const incoming = data || [];
      const now = Date.now();

      setMessageList((prev) => {
        // Create a map of existing conversations for quick lookup
        const prevMap = new Map();
        prev.forEach((conv) => {
          const id = String(
            conv.id || conv._id || conv.sender || conv.from || conv.to || "",
          );
          prevMap.set(id, conv);
        });

        return incoming.map((conv) => {
          const id = String(
            conv.id || conv._id || conv.sender || conv.from || conv.to || "",
          );
          const lockedAt = readLocksRef.current[id];

          if (lockedAt) {
            if (now - lockedAt < READ_LOCK_MS) {
              // Within lock window — keep unread as 0
              return { ...conv, unread: 0, newMessages: 0 };
            } else {
              // Lock expired — clean it up and trust the server
              delete readLocksRef.current[id];
            }
          }

          // Preserve any local optimistic updates
          const existing = prevMap.get(id);
          if (existing && existing._optimisticUnread === 0) {
            return { ...conv, unread: 0, newMessages: 0 };
          }

          return conv;
        });
      });
    };

    socket.on("messageList", handler);
    return () => {
      try {
        socket.off("messageList", handler);
      } catch (e) {}
    };
  }, [socket]);

  return (
    <ListMessageContext.Provider
      value={{ messageList, markConversationRead, updateConversationUnread }}
    >
      {children}
    </ListMessageContext.Provider>
  );
};

export default function useListMessage() {
  const context = useContext(ListMessageContext);
  if (!context) {
    return {
      messageList: [],
      markConversationRead: () => {},
      updateConversationUnread: () => {},
    };
  }
  return context;
}
