import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BsSendFill } from "react-icons/bs";
import { IoIosAttach } from "react-icons/io";
import {
  IoChevronBack,
  IoClose,
  IoCloudOfflineOutline,
  IoDocumentAttachOutline,
  IoDocumentOutline,
  IoDocumentTextOutline,
  IoDownloadOutline,
  IoImageOutline,
  IoMusicalNoteOutline,
  IoRefresh,
  IoVideocamOutline,
} from "react-icons/io5";
import Messageuser from "./User";
import { useSocket } from "../../contexts/SocketContext";
import useListMessage from "../../contexts/useListMessage";
import useAuth from "../../contexts/Auth";
import {
  buildAttachmentUrl,
  CHAT_CONFIG,
  CHAT_EVENTS,
  formatFileSize,
  getDisplayName,
  getParticipantId,
  groupMessagesByDate,
  isIncomingMessage,
  isMessageForConversation,
  normalizeConversation,
  normalizeConversations,
  normalizeMessage,
  normalizeMessages,
} from "../util/chat";
import { dateInNY, timeInNY } from "../util/inNytimezone";

// ─── File type helpers ────────────────────────────────────────────────────────

function getFileKind(nameOrType) {
  if (!nameOrType) return "file";
  const s = String(nameOrType).toLowerCase();
  if (
    /^image\//.test(s) ||
    /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico|tiff)$/.test(s)
  )
    return "image";
  if (/^video\//.test(s) || /\.(mp4|mov|avi|mkv|webm|3gp|wmv)$/.test(s))
    return "video";
  if (/^audio\//.test(s) || /\.(mp3|wav|ogg|aac|flac|m4a|wma)$/.test(s))
    return "audio";
  if (s === "application/pdf" || s.endsWith(".pdf")) return "pdf";
  if (
    /word|\.docx?$/.test(s) ||
    s === "application/msword" ||
    s.includes("wordprocessingml")
  )
    return "word";
  if (
    /excel|spreadsheet|\.xlsx?$/.test(s) ||
    s.includes("spreadsheetml") ||
    s.includes("ms-excel")
  )
    return "excel";
  if (
    /powerpoint|presentation|\.pptx?$/.test(s) ||
    s.includes("presentationml")
  )
    return "ppt";
  if (/^text\/|\.txt$|\.csv$|\.md$|\.json$|\.js$|\.html$|\.css$/.test(s))
    return "text";
  if (
    /zip|rar|7z|tar|gz|bz2|xz/.test(s) ||
    s.includes("zip") ||
    s.includes("compressed")
  )
    return "archive";
  return "file";
}

function FileIcon({ kind, size = 24 }) {
  const icons = {
    image: { bg: "bg-blue-50", text: "text-blue-500", icon: IoImageOutline },
    video: {
      bg: "bg-purple-50",
      text: "text-purple-500",
      icon: IoVideocamOutline,
    },
    audio: {
      bg: "bg-pink-50",
      text: "text-pink-500",
      icon: IoMusicalNoteOutline,
    },
    pdf: {
      bg: "bg-red-50",
      text: "text-red-500",
      icon: IoDocumentAttachOutline,
    },
    word: { bg: "bg-blue-50", text: "text-blue-600", icon: IoDocumentOutline },
    excel: {
      bg: "bg-green-50",
      text: "text-green-600",
      icon: IoDocumentOutline,
    },
    ppt: {
      bg: "bg-orange-50",
      text: "text-orange-500",
      icon: IoDocumentOutline,
    },
    text: {
      bg: "bg-slate-50",
      text: "text-slate-500",
      icon: IoDocumentTextOutline,
    },
    archive: {
      bg: "bg-amber-50",
      text: "text-amber-500",
      icon: IoDocumentOutline,
    },
    file: {
      bg: "bg-slate-50",
      text: "text-slate-400",
      icon: IoDocumentOutline,
    },
  };
  const { bg, text, icon: Icon } = icons[kind] || icons.file;
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-xl ${bg} ${text}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      <Icon size={size} />
    </div>
  );
}

function getFileName(chat) {
  if (chat.attachmentName) return chat.attachmentName;
  if (chat.file instanceof File) return chat.file.name;
  const url = chat.attachment || "";
  const decoded = decodeURIComponent(url);
  const part = decoded.split("/").pop().split("?")[0];
  return part || "Attachment";
}

// ─── createClientMessage ─────────────────────────────────────────────────────

function createClientMessage({ text, file, preview, to, currentUser }) {
  const now = new Date().toISOString();
  const clientId = `optimistic-${Date.now()}`;
  return {
    clientId,
    id: clientId,
    _id: clientId,
    message: text || "",
    attachment: file?.name || null,
    attachmentName: file?.name || null,
    attachmentType: file?.type || null,
    attachmentSize: file?.size || null,
    preview: preview || null,
    file: file || null,
    timestamp: now,
    from: currentUser?.userId || currentUser?.name,
    sender: currentUser?.userId || currentUser?.name,
    to,
    status: "sending",
  };
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Message() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState("");
  const [userChats, setUserChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [search, setSearch] = useState("");
  const [sendError, setSendError] = useState("");
  const [isRequestingMessages, setIsRequestingMessages] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);
  const typingTimeoutsRef = useRef({});
  const lastTypingAtRef = useRef(0);
  const chatContainerRef = useRef(null);
  const userListContainerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const { socket, onlineUsers } = useSocket();
  const { cookies } = useAuth();
  const { messageList, markConversationRead, updateConversationUnread } =
    useListMessage();
  const selectedUserId = getParticipantId(selectedUser);
  // Ref so socket handlers always read the current value without needing
  // selectedUserId as a dependency — prevents listener teardown on every click.
  const selectedUserIdRef = useRef(selectedUserId);
  selectedUserIdRef.current = selectedUserId;

  // Track which conversations have been read while they were open
  const readConversationsRef = useRef(new Set());

  const isConnected = Boolean(socket?.connected);

  const currentUser = useMemo(
    () => ({
      id: cookies?.id,
      name: cookies?.name,
      userId: cookies?.userId,
      username: cookies?.username,
    }),
    [cookies?.id, cookies?.name, cookies?.userId, cookies?.username],
  );

  const clearAttachment = useCallback((shouldRevoke = true) => {
    setSelectedFile(null);
    setFilePreview((current) => {
      if (shouldRevoke && current) URL.revokeObjectURL(current);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    return () => {
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const refreshLists = useCallback(() => {
    if (!socket?.connected) return;
    socket.emit(CHAT_EVENTS.messageList);
    socket.emit(CHAT_EVENTS.onlineUsers);
  }, [socket]);

  const requestMessages = useCallback(
    (targetId) => {
      if (!socket?.connected || !targetId) return;
      setIsRequestingMessages(true);
      socket.emit(CHAT_EVENTS.markRead, targetId);
      socket.emit(CHAT_EVENTS.messages, targetId);

      // Mark this conversation as read
      readConversationsRef.current.add(targetId);
      markConversationRead(targetId);

      // Update global unread count
      if (updateConversationUnread) {
        updateConversationUnread(targetId, 0);
      }

      setTimeout(refreshLists, 600);

      setUsers((prev) =>
        prev.map((u) =>
          getParticipantId(u) === targetId ? { ...u, newMessages: 0 } : u,
        ),
      );
    },
    [socket, markConversationRead, refreshLists, updateConversationUnread],
  );

  // Function to scroll user list to top with retry logic
  const scrollUserListToTop = useCallback(() => {
    if (!userListContainerRef.current) return;

    // Clear any pending scroll timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Try to find the actual scrollable element inside the container
    const scrollableElement =
      userListContainerRef.current.querySelector(
        '.overflow-y-auto, [style*="overflow-y"]',
      ) || userListContainerRef.current;

    const attemptScroll = (attempt = 0) => {
      if (scrollableElement) {
        scrollableElement.scrollTop = 0;
        // Verify scroll worked, if not retry
        if (scrollableElement.scrollTop !== 0 && attempt < 3) {
          scrollTimeoutRef.current = setTimeout(
            () => attemptScroll(attempt + 1),
            50,
          );
        }
      } else if (attempt < 3) {
        scrollTimeoutRef.current = setTimeout(
          () => attemptScroll(attempt + 1),
          50,
        );
      }
    };

    // Try immediate scroll
    attemptScroll();

    // Also try after a delay to ensure DOM is fully updated
    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollableElement) {
        scrollableElement.scrollTop = 0;
      }
    }, 150);
  }, []);

  // When switching away from a conversation, we don't need to do anything
  // because readConversationsRef keeps track of which ones were read
  const handleSelectUser = useCallback(
    (user) => {
      if (!user) return;
      const selected = { ...user, id: getParticipantId(user) };
      setSelectedUser(selected);
      setMessage("");
      setSendError("");
      clearAttachment();
      setUserChats([]);
      requestMessages(selected.id);
      refreshLists();
      setUsers((prev) =>
        prev.map((item) =>
          getParticipantId(item) === selected.id
            ? { ...item, newMessages: 0 }
            : item,
        ),
      );

      // Reset unread in global messageList for header sync
      if (updateConversationUnread) {
        updateConversationUnread(selected.id, 0);
      }

      // Scroll to top after selecting user
      scrollUserListToTop();
    },
    [
      requestMessages,
      refreshLists,
      clearAttachment,
      scrollUserListToTop,
      updateConversationUnread,
    ],
  );

  // Auto-scroll user list to top when a chat is selected (re-render trigger)
  useEffect(() => {
    if (selectedUserId) {
      scrollUserListToTop();
    }
  }, [selectedUserId, scrollUserListToTop]);

  // Also scroll when users list updates (in case reordering happened)
  useEffect(() => {
    if (selectedUserId) {
      scrollUserListToTop();
    }
  }, [users, selectedUserId, scrollUserListToTop]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      refreshLists();
      if (selectedUserIdRef.current) requestMessages(selectedUserIdRef.current);
    };

    const handleMessages = (data) => {
      const next = normalizeMessages(data);
      setUserChats((prev) => {
        const pending = prev.filter((m) => m.status === "sending");
        if (pending.length === 0) return next;
        const confirmedIds = new Set(next.map((m) => m.id));
        const stillPending = pending.filter((m) => !confirmedIds.has(m.id));
        return [...next, ...stillPending];
      });
      setIsRequestingMessages(false);
    };

    const handlePrivate = (data) => {
      const activeId = selectedUserIdRef.current;
      const incoming = normalizeMessage(data);
      const fromId = incoming.from || incoming.sender;
      const isIncoming = isIncomingMessage(incoming, currentUser, activeId);
      const belongsToOpenChat = isMessageForConversation(
        incoming,
        activeId,
        currentUser,
      );

      if (belongsToOpenChat) {
        // Message belongs to the currently open chat
        if (isIncoming) {
          // Mark as read on server since we're viewing this chat
          socket.emit(CHAT_EVENTS.markRead, activeId);
          socket.emit(CHAT_EVENTS.messageList);
          markConversationRead(activeId);
          // Track that this conversation has been read while open
          readConversationsRef.current.add(activeId);

          // Update global unread count to 0 for this conversation
          if (updateConversationUnread) {
            updateConversationUnread(activeId, 0);
          }

          setTimeout(refreshLists, 600);
        }

        setUserChats((prev) => {
          const matchIndex = prev.findIndex((m) => {
            const isOptimistic =
              m.status === "sending" ||
              String(m._id || m.id || "").startsWith("optimistic-");
            if (!isOptimistic || isIncoming) return false;

            const serverIdRef =
              incoming.clientId || incoming._id || incoming.id;
            if (
              m.clientId &&
              serverIdRef &&
              String(m.clientId) === String(serverIdRef)
            )
              return true;

            const norm = (t) => (t || "").trim().toLowerCase();
            const messagesMatch = norm(m.message) === norm(incoming.message);
            const attachmentStatusMatch =
              !!(m.attachmentName || m.file?.name) === !!incoming.attachment;
            const timeDiff = Math.abs(
              new Date(m.timestamp).getTime() -
                new Date(incoming.timestamp).getTime(),
            );
            return messagesMatch && attachmentStatusMatch && timeDiff < 300000;
          });

          if (matchIndex >= 0) {
            const updatedChats = [...prev];
            const local = prev[matchIndex];
            const serverHasRealUrl = !!(
              incoming.attachment &&
              !String(incoming.attachment).startsWith("blob:")
            );
            updatedChats[matchIndex] = {
              ...local,
              ...incoming,
              status: "sent",
              id: incoming.id || incoming._id || local.id,
              _id: incoming._id || incoming.id || local._id,
              preview: serverHasRealUrl ? null : local.preview || null,
              file: local.file || null,
              attachmentName: incoming.attachmentName || local.attachmentName,
              attachmentType: incoming.attachmentType || local.attachmentType,
              attachmentSize: incoming.attachmentSize || local.attachmentSize,
            };
            return updatedChats;
          }

          const isAlreadyPresent = prev.some((m) => {
            if (m.status === "sending") return false;
            const mId = String(m.id || m._id || "");
            const inId = String(incoming.id || incoming._id || "");
            return mId && inId && mId === inId;
          });
          if (isAlreadyPresent) return prev;

          return [...prev, incoming];
        });
      } else if (isIncoming) {
        // Message belongs to a different conversation
        refreshLists();
      }

      // Update the conversation list with the new message
      setUsers((prev) =>
        prev.map((user) => {
          const id = getParticipantId(user);
          if (id !== fromId && id !== incoming.to) return user;

          // Check if this conversation was read while it was open
          const wasRead = readConversationsRef.current.has(id);
          const isCurrentlySelected = id === activeId;
          const shouldHaveUnread =
            !isCurrentlySelected && !wasRead && isIncoming;

          // If the conversation is currently selected or was read before, keep unread count at 0
          let newUnreadCount = 0;
          if (shouldHaveUnread) {
            newUnreadCount = (user.newMessages || 0) + 1;
          }

          // Sync with global messageList for header
          if (updateConversationUnread) {
            updateConversationUnread(id, newUnreadCount);
          }

          return {
            ...user,
            lastMessage:
              incoming.message || (incoming.attachment ? "Attachment" : ""),
            updatedAt: incoming.timestamp,
            newMessages: newUnreadCount,
          };
        }),
      );
    };

    const handleTyping = (payload) => {
      const from = payload?.from || payload?.sender;
      if (!from) return;
      setTypingUsers((prev) => new Set([...prev, from]));
      clearTimeout(typingTimeoutsRef.current[from]);
      typingTimeoutsRef.current[from] = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(from);
          return next;
        });
        delete typingTimeoutsRef.current[from];
      }, CHAT_CONFIG.typingVisibleMs);
    };

    const handleUsersList = (list) => {
      const normalized = normalizeConversations(list);
      setUsers((prev) => {
        const merged = mergeConversations(
          selectedUserIdRef.current,
          prev,
          normalized,
        );
        if (conversationsEqual(prev, merged)) return prev;
        const activeId = selectedUserIdRef.current;
        if (!activeId) return merged;
        // Ensure selected conversation and read conversations have 0 unread messages
        return merged.map((u) => {
          const userId = getParticipantId(u);
          if (userId === activeId || readConversationsRef.current.has(userId)) {
            // Also sync with global state
            if (updateConversationUnread) {
              updateConversationUnread(userId, 0);
            }
            return { ...u, newMessages: 0 };
          }
          return u;
        });
      });
    };

    const handleOnlineUsers = (list) => {
      const normalized = normalizeConversations(list).map((u) => ({
        ...u,
        isOnline: true,
      }));
      setUsers((prev) => {
        const merged = mergeConversations(
          selectedUserIdRef.current,
          prev,
          normalized,
        );
        if (conversationsEqual(prev, merged)) return prev;
        const activeId = selectedUserIdRef.current;
        if (!activeId) return merged;
        // Ensure selected conversation and read conversations have 0 unread messages
        return merged.map((u) => {
          const userId = getParticipantId(u);
          if (userId === activeId || readConversationsRef.current.has(userId)) {
            // Also sync with global state
            if (updateConversationUnread) {
              updateConversationUnread(userId, 0);
            }
            return { ...u, newMessages: 0 };
          }
          return u;
        });
      });
    };

    socket.on("connect", handleConnect);
    socket.on(CHAT_EVENTS.messages, handleMessages);
    socket.on(CHAT_EVENTS.privateMessage, handlePrivate);
    socket.on(CHAT_EVENTS.typing, handleTyping);
    socket.on(CHAT_EVENTS.users, handleUsersList);
    socket.on(CHAT_EVENTS.onlineUsers, handleOnlineUsers);
    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(CHAT_EVENTS.messages, handleMessages);
      socket.off(CHAT_EVENTS.privateMessage, handlePrivate);
      socket.off(CHAT_EVENTS.typing, handleTyping);
      socket.off(CHAT_EVENTS.users, handleUsersList);
      socket.off(CHAT_EVENTS.onlineUsers, handleOnlineUsers);
    };
  }, [
    socket,
    currentUser,
    refreshLists,
    requestMessages,
    markConversationRead,
    updateConversationUnread,
  ]);

  useEffect(() => {
    const recentChats = normalizeConversations(messageList).map(
      ({ isOnline: _drop, ...rest }) => rest,
    );
    const online = normalizeConversations(onlineUsers).map((u) => ({
      ...u,
      isOnline: true,
    }));
    setUsers((prev) => {
      const merged = mergeConversations(
        selectedUserId,
        prev,
        recentChats,
        online,
      );
      if (conversationsEqual(prev, merged)) return prev;
      // Ensure selected conversation and read conversations have 0 unread messages
      if (selectedUserId) {
        return merged.map((u) => {
          const userId = getParticipantId(u);
          if (
            userId === selectedUserId ||
            readConversationsRef.current.has(userId)
          ) {
            return { ...u, newMessages: 0 };
          }
          return u;
        });
      }
      return merged;
    });
  }, [messageList, onlineUsers, selectedUserId]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [userChats]);

  // Always scroll when switching users
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [selectedUserId, isRequestingMessages]);

  const selectedConversation = users.find(
    (u) => getParticipantId(u) === selectedUserId,
  );
  const isSelectedUserOnline = Boolean(selectedConversation?.isOnline);
  const groupedMessages = useMemo(
    () => groupMessagesByDate(userChats),
    [userChats],
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const enhanced = users.map((u) => ({
      ...u,
      isTyping: typingUsers.has(getParticipantId(u)),
    }));
    if (!term) return enhanced;
    return enhanced.filter((u) =>
      `${getDisplayName(u)} ${u.lastMessage || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [search, typingUsers, users]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const maxBytes = CHAT_CONFIG.maxAttachmentSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setSendError(
        `Attachment must be ${CHAT_CONFIG.maxAttachmentSizeMb} MB or less.`,
      );
      event.target.value = "";
      return;
    }
    clearAttachment();
    setSendError("");
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleMessage = (event) => {
    const value = event.target.value;
    setMessage(value);
    setSendError("");
    const now = Date.now();
    if (
      selectedUserId &&
      socket?.connected &&
      value.trim() &&
      now - lastTypingAtRef.current > CHAT_CONFIG.typingThrottleMs
    ) {
      socket.emit(CHAT_EVENTS.typing, { to: selectedUserId });
      lastTypingAtRef.current = now;
    }
  };

  const handleSubmitMessage = () => {
    const text = message.trim();
    if ((!text && !selectedFile) || !selectedUserId) return;
    if (!socket?.connected) {
      setSendError("Chat is offline. Reconnect before sending.");
      return;
    }

    const optimistic = createClientMessage({
      text,
      file: selectedFile,
      preview: filePreview,
      to: selectedUserId,
      currentUser,
    });
    setUserChats((prev) => [...prev, optimistic]);

    // Optimistically update the conversation list without refreshing from server
    // Ensure newMessages remains 0 for the selected conversation
    setUsers((prev) =>
      prev.map((u) =>
        getParticipantId(u) === selectedUserId
          ? {
              ...u,
              lastMessage: text || (selectedFile ? "Attachment" : ""),
              updatedAt: optimistic.timestamp,
              newMessages: 0,
            }
          : u,
      ),
    );

    // Also update global messageList to keep header in sync
    if (updateConversationUnread) {
      updateConversationUnread(selectedUserId, 0);
    }

    socket.emit(CHAT_EVENTS.privateMessage, {
      clientId: optimistic.clientId,
      message: text,
      selectedFile,
      filePath: selectedFile?.name || null,
      attachmentName: selectedFile?.name || null,
      attachmentType: selectedFile?.type || null,
      to: selectedUserId,
      sender: currentUser.userId || currentUser.name,
    });

    setMessage("");
    clearAttachment(false);
    setSendError("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmitMessage();
    }
  };


  return (
    <div className="h-[calc(100dvh-5.5rem)] min-h-[calc(100vh-5.5rem)] bg-slate-50 lg:px-6 lg:py-6">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 lg:flex-row">
        {/* Sidebar */}
        <div
          className={`h-full transition-all duration-300 lg:w-[360px] ${selectedUser ? "hidden lg:block" : "w-full"}`}
        >
          <div
            ref={userListContainerRef}
            className="h-full overflow-hidden border-slate-200 bg-white shadow-sm lg:rounded-2xl lg:border"
          >
            <Messageuser
              handleId={handleSelectUser}
              userId={selectedUserId}
              users={filteredUsers}
              search={search}
              onSearch={setSearch}
              isConnected={isConnected}
              selectedUserId={selectedUserId}
            />
          </div>
        </div>

        {/* Chat panel */}
        <div
          className={`h-full transition-all duration-300 lg:flex-1 ${!selectedUser ? "hidden lg:block" : "w-full"}`}
        >
          {selectedUser ? (
            <section className="flex h-full flex-col overflow-hidden border-slate-200 bg-white shadow-sm lg:rounded-2xl lg:border">
              {/* Header */}
              <header className="shrink-0 border-b border-slate-100 bg-white/95 px-3 py-3 backdrop-blur sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 lg:hidden"
                      aria-label="Back"
                    >
                      <IoChevronBack size={24} />
                    </button>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-600 text-base font-black text-white sm:h-11 sm:w-11">
                      {getDisplayName(selectedUser).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-black text-slate-950 sm:text-lg">
                        {getDisplayName(selectedUser, "Unnamed chat")}
                      </h2>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${isSelectedUserOnline ? "bg-emerald-500" : "bg-slate-300"}`}
                        />
                        <p className="text-xs font-semibold text-slate-500">
                          {typingUsers.has(selectedUserId)
                            ? "typing..."
                            : isSelectedUserOnline
                              ? "Active now"
                              : "Offline"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={refreshLists}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Refresh"
                  >
                    <IoRefresh size={20} />
                  </button>
                </div>
              </header>

              {/* Messages */}
              <div className="min-h-0 flex-1 bg-slate-50/70 px-2 py-3 sm:px-5">
                <div
                  ref={chatContainerRef}
                  className="flex h-full flex-col gap-1 overflow-y-auto px-1 pb-2"
                >
                  {isRequestingMessages ? (
                    <ChatState title="Loading messages" />
                  ) : userChats.length > 0 ? (
                    Object.entries(groupedMessages).map(([date, chats]) => (
                      <div key={date}>
                        <div className="my-4 flex justify-center">
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm ring-1 ring-slate-200">
                            {dateInNY(date)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {chats.map((chat) => (
                            <MessageBubble
                              key={chat.clientId || chat.id}
                              chat={chat}
                              currentUser={currentUser}
                              selectedUserId={selectedUserId}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <ChatState
                      title="No messages yet"
                      description="Send a message or attach a file to start this conversation."
                    />
                  )}
                </div>
              </div>

              {/* Attachment staging */}
              {selectedFile && (
                <AttachmentPreview
                  file={selectedFile}
                  preview={filePreview}
                  onRemove={clearAttachment}
                />
              )}

              {/* Error */}
              {sendError && (
                <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 sm:px-5">
                  {sendError}
                </div>
              )}

              {/* Input */}
              <footer className="shrink-0 border-t border-slate-100 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
                <div className="flex items-end gap-2">
                  <label
                    htmlFor="file-upload"
                    className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                    title="Attach file"
                  >
                    <IoIosAttach size={25} />
                  </label>
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <textarea
                    placeholder="Message"
                    aria-label="Message input"
                    rows={1}
                    className="max-h-32 min-h-11 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] font-medium leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    value={message}
                    onChange={handleMessage}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="button"
                    aria-label="Send message"
                    onClick={handleSubmitMessage}
                    disabled={
                      !isConnected || (!message.trim() && !selectedFile)
                    }
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <BsSendFill size={18} />
                  </button>
                </div>
              </footer>
            </section>
          ) : (
            <div className="flex h-full min-h-[70vh] items-center justify-center border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm lg:rounded-2xl">
              <div className="max-w-sm">
                <img
                  src="image/chatimage.png"
                  alt=""
                  className="mx-auto mb-6 h-40 w-40 object-contain"
                />
                <h2 className="text-2xl font-black tracking-tight text-slate-950">
                  Select a conversation
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Choose a chat to view history, see presence, and continue the
                  conversation.
                </p>
                {!isConnected && (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                    <IoCloudOfflineOutline size={16} />
                    Chat connection is offline
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ chat, currentUser, selectedUserId }) {
  const incoming = isIncomingMessage(chat, currentUser, selectedUserId);

  const rawAttachment =
    typeof chat.attachment === "string" ? chat.attachment : null;
  const attachmentUrl =
    chat.preview || (rawAttachment ? buildAttachmentUrl(rawAttachment) : null);

  const mimeOrName =
    chat.attachmentType ||
    chat.file?.type ||
    rawAttachment ||
    chat.file?.name ||
    "";
  const kind = getFileKind(mimeOrName);
  const fileName = getFileName(chat);
  const fileSize = chat.attachmentSize || chat.file?.size || null;
  const hasAttachment = Boolean(chat.attachment);

  const bubble = incoming
    ? "rounded-bl-md border border-slate-200 bg-white text-slate-800"
    : "rounded-br-md bg-blue-600 text-white";

  return (
    <div className={`flex ${incoming ? "justify-start" : "justify-end"} px-1`}>
      <div
        className={`max-w-[86%] sm:max-w-[72%] break-words rounded-2xl shadow-sm ${bubble}`}
      >
        {hasAttachment && (
          <div
            className={`${chat.message ? "rounded-t-2xl" : "rounded-2xl"} overflow-hidden`}
          >
            {kind === "image" && attachmentUrl ? (
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="relative block"
              >
                <img
                  src={attachmentUrl}
                  alt={fileName}
                  className="max-h-72 w-full object-cover transition-opacity duration-200"
                  style={{ minWidth: 180 }}
                />
                {chat.status === "sending" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}
              </a>
            ) : (
              <div
                className={`flex items-center gap-3 px-3 py-2.5 ${!chat.message ? "px-4 py-3" : ""}`}
              >
                <FileIcon kind={kind} size={22} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-semibold leading-tight ${incoming ? "text-slate-800" : "text-white"}`}
                  >
                    {fileName}
                  </p>
                  {fileSize && (
                    <p
                      className={`text-[11px] font-medium mt-0.5 ${incoming ? "text-slate-400" : "text-blue-200"}`}
                    >
                      {formatFileSize(fileSize)}
                    </p>
                  )}
                </div>
                {attachmentUrl && chat.status !== "sending" && (
                  <a
                    href={attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={fileName}
                    onClick={(e) => e.stopPropagation()}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                      incoming
                        ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        : "text-blue-200 hover:bg-white/15 hover:text-white"
                    }`}
                    aria-label={`Download ${fileName}`}
                  >
                    <IoDownloadOutline size={17} />
                  </a>
                )}
                {chat.status === "sending" && (
                  <span
                    className={`text-[10px] font-semibold ${incoming ? "text-slate-400" : "text-blue-200"}`}
                  >
                    ↑
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {chat.message && (
          <p
            className={`whitespace-pre-wrap break-words px-4 py-2.5 text-[15px] leading-relaxed ${hasAttachment ? "pt-2" : ""}`}
          >
            {chat.message}
          </p>
        )}

        <p
          className={`px-4 pb-2 text-right text-[10px] font-semibold ${hasAttachment && !chat.message ? "pt-0" : ""} ${incoming ? "text-slate-400" : "text-blue-200"}`}
        >
          {timeInNY(chat.timestamp)}
          {chat.status === "sending" ? " · sending" : ""}
        </p>
      </div>
    </div>
  );
}

// ─── AttachmentPreview ──────────────────────────────────────────────────────

function AttachmentPreview({ file, preview, onRemove }) {
  const kind = getFileKind(file?.type || file?.name || "");
  const isImage = kind === "image";

  return (
    <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        {isImage && preview ? (
          <img
            src={preview}
            alt="Preview"
            className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
          />
        ) : (
          <FileIcon kind={kind} size={20} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">
            {file?.name}
          </p>
          <p className="text-xs font-medium text-slate-400">
            {formatFileSize(file?.size)}
          </p>
        </div>
        <button
          type="button"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-red-600"
          onClick={onRemove}
          aria-label="Remove attachment"
        >
          <IoClose size={18} />
        </button>
      </div>
    </div>
  );
}

// ─── ChatState ────────────────────────────────────────────────────────────────

function ChatState({ title, description }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
      <p className="text-lg font-black text-slate-900">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm">{description}</p>}
    </div>
  );
}

// ─── conversationsEqual ───────────────────────────────────────────────────────

function conversationsEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((u, i) => {
    const v = b[i];
    return (
      u.id === v.id &&
      u.newMessages === v.newMessages &&
      u.isOnline === v.isOnline &&
      u.lastMessage === v.lastMessage &&
      u.updatedAt === v.updatedAt
    );
  });
}

// ─── mergeConversations ───────────────────────────────────────────────────────

function mergeConversations(selectedUserId = null, ...groups) {
  const map = new Map();
  groups
    .flat()
    .filter(Boolean)
    .forEach((conversation) => {
      const normalized = normalizeConversation(conversation);
      if (!normalized) return;
      const existing = map.get(normalized.id);

      const hasUnreadInfo =
        conversation.unread !== undefined ||
        conversation.newMessages !== undefined;

      map.set(normalized.id, {
        ...existing,
        ...normalized,
        newMessages: hasUnreadInfo
          ? normalized.newMessages
          : (existing?.newMessages ?? normalized.newMessages ?? 0),
        isOnline: normalized.isOnline ?? existing?.isOnline ?? false,
      });
    });

  const conversations = Array.from(map.values());

  return conversations.sort((a, b) => {
    const aId = getParticipantId(a);
    const bId = getParticipantId(b);
    const aIsSelected = selectedUserId && aId === selectedUserId;
    const bIsSelected = selectedUserId && bId === selectedUserId;

    if (aIsSelected && !bIsSelected) return -1;
    if (!aIsSelected && bIsSelected) return 1;

    const timeA = a.updatedAt || "";
    const timeB = b.updatedAt || "";
    const timeDiff = String(timeB).localeCompare(String(timeA));

    if (timeDiff !== 0) return timeDiff;

    return getDisplayName(a).localeCompare(getDisplayName(b));
  });
}
