import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BsSendFill } from "react-icons/bs";
import { FaFileAlt } from "react-icons/fa";
import { IoIosAttach } from "react-icons/io";
import {
  IoChevronBack,
  IoClose,
  IoCloudOfflineOutline,
  IoDocumentAttachOutline,
  IoImageOutline,
  IoRefresh,
} from "react-icons/io5";
import { AiFillFilePdf } from "react-icons/ai";
import dateFormat from "dateformat";
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
  normalizeConversations,
  normalizeMessage,
  normalizeMessages,
} from "../util/chat";

function createClientMessage({ text, fileName, to, currentUser }) {
  const now = new Date().toISOString();
  return normalizeMessage({
    clientId: `local-${Date.now()}`,
    message: text,
    attachment: fileName,
    timestamp: now,
    createdAt: now,
    from: currentUser?.userId || currentUser?.name,
    sender: currentUser?.userId || currentUser?.name,
    to,
    status: "sending",
  });
}

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
  const { socket, onlineUsers, connect, disconnect } = useSocket();
  const { cookies } = useAuth();
  const messageList = useListMessage();
  const selectedUserId = getParticipantId(selectedUser);
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

  const clearAttachment = useCallback(() => {
    setSelectedFile(null);
    setFilePreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
      Object.values(typingTimeoutsRef.current).forEach((timer) =>
        clearTimeout(timer),
      );
      typingTimeoutsRef.current = {};
    };
  }, [connect, disconnect]);

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
      socket.emit(CHAT_EVENTS.messages, targetId);
    },
    [socket],
  );

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      refreshLists();
      if (selectedUserId) requestMessages(selectedUserId);
    };

    const handleMessages = (data) => {
      setUserChats(normalizeMessages(data));
      setIsRequestingMessages(false);
    };

    const handlePrivate = (data) => {
      const incoming = normalizeMessage(data);
      const fromId = incoming.from || incoming.sender;
      const isIncoming = isIncomingMessage(
        incoming,
        currentUser,
        selectedUserId,
      );
      const belongsToOpenChat = isMessageForConversation(
        incoming,
        selectedUserId,
        currentUser,
      );

      if (belongsToOpenChat) {
        setUserChats((prev) => {
          const pendingIndex = prev.findIndex(
            (item) =>
              item.status === "sending" &&
              !isIncoming &&
              item.message === incoming.message &&
              item.attachment === incoming.attachment,
          );
          if (pendingIndex >= 0) {
            const next = [...prev];
            next[pendingIndex] = incoming;
            return next;
          }
          return [...prev, incoming];
        });
      }

      setUsers((prev) =>
        prev.map((user) => {
          const id = getParticipantId(user);
          if (id !== fromId && id !== incoming.to) return user;
          return {
            ...user,
            lastMessage: incoming.message || (incoming.attachment && "Attachment"),
            updatedAt: incoming.timestamp,
            newMessages:
              belongsToOpenChat || id === selectedUserId
                ? 0
                : (user.newMessages || 0) + 1,
          };
        }),
      );
    };

    const handleTyping = (payload) => {
      const from = payload?.from || payload?.sender;
      if (!from) return;
      setTypingUsers((prev) => new Set([...prev, from]));
      if (typingTimeoutsRef.current[from]) {
        clearTimeout(typingTimeoutsRef.current[from]);
      }
      typingTimeoutsRef.current[from] = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(from);
          return next;
        });
        delete typingTimeoutsRef.current[from];
      }, CHAT_CONFIG.typingVisibleMs);
    };

    const handleUsers = (list) => {
      const normalized = normalizeConversations(list).map((user) => ({
        ...user,
        isOnline: true,
      }));
      setUsers((prev) => mergeConversations(prev, normalized));
    };

    socket.on("connect", handleConnect);
    socket.on(CHAT_EVENTS.messages, handleMessages);
    socket.on(CHAT_EVENTS.privateMessage, handlePrivate);
    socket.on(CHAT_EVENTS.typing, handleTyping);
    socket.on(CHAT_EVENTS.users, handleUsers);
    socket.on(CHAT_EVENTS.onlineUsers, handleUsers);

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(CHAT_EVENTS.messages, handleMessages);
      socket.off(CHAT_EVENTS.privateMessage, handlePrivate);
      socket.off(CHAT_EVENTS.typing, handleTyping);
      socket.off(CHAT_EVENTS.users, handleUsers);
      socket.off(CHAT_EVENTS.onlineUsers, handleUsers);
    };
  }, [socket, selectedUserId, currentUser, refreshLists, requestMessages]);

  useEffect(() => {
    const recentChats = normalizeConversations(messageList);
    const online = normalizeConversations(onlineUsers).map((user) => ({
      ...user,
      isOnline: true,
    }));
    setUsers((prev) => mergeConversations(prev, recentChats, online));
  }, [messageList, onlineUsers]);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [userChats, selectedUserId, isRequestingMessages]);

  const selectedConversation = users.find(
    (user) => getParticipantId(user) === selectedUserId,
  );
  const isSelectedUserOnline = Boolean(selectedConversation?.isOnline);
  const groupedMessages = useMemo(
    () => groupMessagesByDate(userChats),
    [userChats],
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const enhanced = users.map((user) => ({
      ...user,
      isTyping: typingUsers.has(getParticipantId(user)),
    }));

    if (!term) return enhanced;
    return enhanced.filter((user) =>
      `${getDisplayName(user)} ${user.lastMessage || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [search, typingUsers, users]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxBytes = CHAT_CONFIG.maxAttachmentSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setSendError(`Attachment must be ${CHAT_CONFIG.maxAttachmentSizeMb} MB or less.`);
      event.target.value = "";
      return;
    }

    clearAttachment();
    setSendError("");
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
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

  const handleSubmitMessage = async () => {
    const text = message.trim();
    if ((!text && !selectedFile) || !selectedUserId) return;

    if (!socket?.connected) {
      setSendError("Chat is offline. Reconnect before sending.");
      return;
    }

    const optimistic = createClientMessage({
      text,
      fileName: selectedFile?.name,
      to: selectedUserId,
      currentUser,
    });
    setUserChats((prev) => [...prev, optimistic]);
    setUsers((prev) =>
      prev.map((user) =>
        getParticipantId(user) === selectedUserId
          ? {
              ...user,
              lastMessage: text || "Attachment",
              updatedAt: optimistic.timestamp,
              newMessages: 0,
            }
          : user,
      ),
    );

    socket.emit(CHAT_EVENTS.privateMessage, {
      message: text,
      selectedFile,
      filePath: selectedFile?.name || null,
      to: selectedUserId,
      sender: currentUser.userId || currentUser.name,
    });

    setMessage("");
    clearAttachment();
    setSendError("");
    setTimeout(refreshLists, 300);
  };

  const handleSelectUser = (user) => {
    if (!user) return;
    const selected = { ...user, id: getParticipantId(user) };
    setSelectedUser(selected);
    setMessage("");
    setSendError("");
    clearAttachment();
    setUserChats([]);
    requestMessages(selected.id);
    setUsers((prev) =>
      prev.map((item) =>
        getParticipantId(item) === selected.id
          ? { ...item, newMessages: 0 }
          : item,
      ),
    );
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
        <div
          className={`h-full transition-all duration-300 lg:w-[360px] ${
            selectedUser ? "hidden lg:block" : "w-full"
          }`}
        >
          <div className="h-full overflow-hidden border-slate-200 bg-white shadow-sm lg:rounded-2xl lg:border">
            <Messageuser
              handleId={handleSelectUser}
              userId={selectedUserId}
              users={filteredUsers}
              search={search}
              onSearch={setSearch}
              isConnected={isConnected}
            />
          </div>
        </div>

        <div
          className={`h-full transition-all duration-300 lg:flex-1 ${
            !selectedUser ? "hidden lg:block" : "w-full"
          }`}
        >
          {selectedUser ? (
            <section className="flex h-full flex-col overflow-hidden border-slate-200 bg-white shadow-sm lg:rounded-2xl lg:border">
              <header className="shrink-0 border-b border-slate-100 bg-white/95 px-3 py-3 backdrop-blur sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 lg:hidden"
                      aria-label="Back to conversations"
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
                          className={`h-2 w-2 rounded-full ${
                            isSelectedUserOnline
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          }`}
                        ></span>
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
                    aria-label="Refresh chat"
                  >
                    <IoRefresh size={20} />
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 bg-slate-50/70 px-2 py-3 sm:px-5">
                <div
                  ref={chatContainerRef}
                  className="flex h-full flex-col gap-3 overflow-y-auto px-1 pb-2"
                >
                  {isRequestingMessages ? (
                    <ChatState title="Loading messages" />
                  ) : userChats.length > 0 ? (
                    Object.entries(groupedMessages).map(([date, chats]) => (
                      <div key={date}>
                        <div className="my-4 flex justify-center">
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm ring-1 ring-slate-200">
                            {date}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {chats.map((chat) => (
                            <MessageBubble
                              key={chat.id}
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

              {selectedFile && (
                <AttachmentPreview
                  file={selectedFile}
                  preview={filePreview}
                  onRemove={clearAttachment}
                />
              )}

              {sendError && (
                <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 sm:px-5">
                  {sendError}
                </div>
              )}

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
                    name="attachment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <textarea
                    placeholder="Message"
                    aria-label="Message input"
                    rows={1}
                    className="max-h-32 min-h-11 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] font-medium leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    name="message"
                    value={message}
                    onChange={handleMessage}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="button"
                    aria-label="Send message"
                    onClick={handleSubmitMessage}
                    disabled={!isConnected || (!message.trim() && !selectedFile)}
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
                  alt="Chat placeholder"
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

function MessageBubble({ chat, currentUser, selectedUserId }) {
  const incoming = isIncomingMessage(chat, currentUser, selectedUserId);
  const attachmentUrl = buildAttachmentUrl(chat.attachment);

  return (
    <div className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[86%] break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm sm:max-w-[72%] ${
          incoming
            ? "rounded-bl-md border border-slate-200 bg-white text-slate-800"
            : "rounded-br-md bg-blue-600 text-white"
        }`}
      >
        {chat.attachment && (
          <a
            className={`mb-2 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
              incoming
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
            href={attachmentUrl || undefined}
            target="_blank"
            rel="noreferrer"
          >
            <FaFileAlt size={15} />
            View attachment
          </a>
        )}
        {chat.message && (
          <p className="whitespace-pre-wrap break-words">{chat.message}</p>
        )}
        <p
          className={`mt-1 text-right text-[10px] font-semibold ${
            incoming ? "text-slate-400" : "text-blue-100"
          }`}
        >
          {dateFormat(chat.timestamp || new Date(), "h:MM TT")}
          {chat.status === "sending" ? " · sending" : ""}
        </p>
      </div>
    </div>
  );
}

function AttachmentPreview({ file, preview, onRemove }) {
  const isImage = file?.type?.startsWith("image/");
  const isPdf = file?.type === "application/pdf";

  return (
    <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
            {isImage ? (
              <IoImageOutline size={24} />
            ) : isPdf ? (
              <AiFillFilePdf size={26} />
            ) : (
              <IoDocumentAttachOutline size={24} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              {file?.name}
            </p>
            <p className="text-xs font-medium text-slate-500">
              {formatFileSize(file?.size)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isImage && preview && (
            <img
              src={preview}
              alt="Attachment preview"
              className="h-12 w-12 rounded-lg object-cover"
            />
          )}
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-red-600"
            onClick={onRemove}
            aria-label="Remove attachment"
          >
            <IoClose size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatState({ title, description }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
      <p className="text-lg font-black text-slate-900">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm">{description}</p>}
    </div>
  );
}

function mergeConversations(...groups) {
  const map = new Map();
  groups.flat().filter(Boolean).forEach((conversation) => {
    const normalized = normalizeConversations([conversation])[0];
    if (!normalized) return;
    const existing = map.get(normalized.id);
    map.set(normalized.id, {
      ...existing,
      ...normalized,
      newMessages: normalized.newMessages || existing?.newMessages || 0,
      isOnline: normalized.isOnline || existing?.isOnline || false,
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const unreadDiff = (b.newMessages || 0) - (a.newMessages || 0);
    const timeDiff = String(b.updatedAt || "").localeCompare(
      String(a.updatedAt || ""),
    );
    return unreadDiff || timeDiff || getDisplayName(a).localeCompare(getDisplayName(b));
  });
}
