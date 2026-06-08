import { BsSendFill } from "react-icons/bs";
import Messageuser from "./User";
import { useEffect, useRef, useState } from "react";
import { FaFileAlt } from "react-icons/fa";
import { IoIosAttach } from "react-icons/io";
import { useSocket } from "../../contexts/SocketContext";
import useListMessage from "../../contexts/useListMessage";
import { getApiRootUrl } from "../../component/api/api";
import dateFormat from "dateformat";
import { IoClose, IoChevronBack } from "react-icons/io5";
import { AiFillFilePdf } from "react-icons/ai";
import useAuth from "../../contexts/Auth";

const getUserId = (item) =>
  item?.id || item?._id || item?.sender || item?.to || item?.from || null;

export default function Message() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState("");
  const [userChats, setUserChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingTimeoutsRef = useRef({});
  const chatContainerRef = useRef(null);
  const [filePath, setFilePath] = useState(null);
  const [filePreview, setFilePreview] = useState();
  const { socket, onlineUsers, connect, disconnect } = useSocket();
  const { cookies } = useAuth();
  const messageList = useListMessage();
  const selectedUserId = getUserId(selectedUser);
  const isSelectedUserOnline = users.find(
    (u) => getUserId(u) === selectedUserId,
  )?.isOnline;

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setFilePath(file.name);
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  };

  const handleClick = (pdfUrl) => {
    const base = getApiRootUrl();
    const url = base.replace(/\/$/, "") + `/public/attachments/${pdfUrl}`;
    window.open(url, "_blank");
  };

  const handleMessage = (e) => {
    const value = e.target.value;
    setMessage(value);
    const targetId = getUserId(selectedUser);
    if (targetId && socket && socket.connected && value.trim() !== "") {
      socket.emit("typing", { to: targetId });
    }
  };

  const handleSubmitMessage = async () => {
    if ((!message.trim() && !selectedFile) || !selectedUser) return;
    const targetId = getUserId(selectedUser);
    if (!targetId) return;
    const s = socket;
    if (s && s.connected) {
      s.emit("private message", {
        message,
        selectedFile,
        filePath,
        to: targetId,
        sender: cookies.name, // Explicitly add sender for consistency
      });
    }
    setMessage("");
    setFilePreview(null);
    setSelectedFile(null);
    setFilePath(null);
  };

  const handleId = (user) => {
    if (!user) return;
    const selected = { ...user, id: getUserId(user) };
    setSelectedUser(selected);
    setFilePreview(null);
    setSelectedFile(null);
    setFilePath(null);
    setMessage("");
    const targetId = selected.id;
    const s = socket;
    if (s && s.connected) {
      s.emit("messages", targetId);
    }
    setUsers((prev) =>
      prev.map((u) =>
        getUserId(u) === targetId ? { ...u, newMessages: 0 } : u,
      ),
    );
  };
  useEffect(() => {
    // rely on SocketContext to manage connection lifecycle
    if (!socket) return;

    const handleMessages = (data) => setUserChats(data);
    const handlePrivate = (data) => {
      setUserChats((prev) => [...prev, data]);
      const fromId = getUserId(data);
      const targetId = getUserId(selectedUser);
      if (fromId && (!selectedUser || fromId !== targetId)) {
        setUsers((prev) =>
          prev.map((u) =>
            getUserId(u) === fromId
              ? { ...u, newMessages: (u.newMessages || 0) + 1 }
              : u,
          ),
        );
      }
    };
    const handleTyping = (payload) => {
      const from = payload?.from;
      if (!from) return;
      setTypingUsers((prev) => new Set([...prev, from]));
      // clear previous timeout
      if (typingTimeoutsRef.current[from])
        clearTimeout(typingTimeoutsRef.current[from]);
      typingTimeoutsRef.current[from] = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(from);
          return next;
        });
        delete typingTimeoutsRef.current[from];
      }, 3000);
    };
    const normalizeList = (list) =>
      Array.isArray(list)
        ? list.map((item) => ({ ...item, id: getUserId(item) }))
        : [];

    const handleUsers = (list) => setUsers(normalizeList(list));

    socket.on("messages", handleMessages);
    socket.on("private message", handlePrivate);
    socket.on("typing", handleTyping);
    socket.on("users", handleUsers);
    socket.on("getOnlineUsers", handleUsers);

    // session handling is expected to be managed by the server/socket helper

    return () => {
      try {
        socket.off("messages", handleMessages);
        socket.off("private message", handlePrivate);
        socket.off("typing", handleTyping);
        socket.off("users", handleUsers);
        socket.off("getOnlineUsers", handleUsers);
      } catch (e) {}
      Object.values(typingTimeoutsRef.current).forEach((t) => clearTimeout(t));
      typingTimeoutsRef.current = {};
    };
  }, [socket, selectedUser]);

  useEffect(() => {
    if (!socket || !socket.connected) return;
    socket.emit("messageList");
    socket.emit("getOnlineUsers");
  }, [socket]);

  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  // Function to group messages by date
  const groupMessagesByDate = (messages) => {
    return messages.reduce((acc, message) => {
      const date = dateFormat(message.timestamp, "d mmmm yyyy");
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(message);
      return acc;
    }, {});
  };

  const groupedMessages = groupMessagesByDate(userChats);

  useEffect(() => {
    const getId = (item) => item?.id || item?._id || item?.sender || item?.to;

    const existingChats = (messageList || [])
      .map((item) => ({
        id: getId(item),
        name:
          item?.name ||
          item?.username ||
          item?.displayName ||
          item?.otherName ||
          item?.fromName ||
          item?.toName ||
          "Chat",
        lastMessage: item?.lastMessage || item?.message || item?.latest || "",
        updatedAt:
          item?.updatedAt ||
          item?.timestamp ||
          item?.createdAt ||
          item?.lastSeen ||
          "",
        newMessages: item?.unread || item?.newMessages || 0,
        isTyping: false,
        ...item,
      }))
      .filter((item) => item.id);

    const online = (onlineUsers || [])
      .filter((u) => getId(u))
      .map((user) => ({
        ...user,
        id: getId(user),
        name: user?.name || user?.username || "Chat",
        isOnline: true,
      }));

    const merged = new Map();
    existingChats.forEach((item) => merged.set(item.id, item));
    online.forEach((user) => {
      const existing = merged.get(user.id);
      if (existing) {
        merged.set(user.id, { ...existing, ...user, isOnline: true });
      } else {
        merged.set(user.id, user);
      }
    });

    const sorted = Array.from(merged.values()).sort((a, b) => {
      const timeA = a.updatedAt || "";
      const timeB = b.updatedAt || "";
      return (
        timeB.localeCompare(timeA) ||
        (b.newMessages || 0) - (a.newMessages || 0)
      );
    });

    setUsers(sorted);
  }, [messageList, onlineUsers]);

  // Scroll to bottom whenever userChats changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [userChats]);

  // Handle "Enter" key press
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmitMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-5.5rem)] bg-slate-50 lg:px-6 lg:py-6">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 lg:flex-row">
        {/* User List Panel - Hidden on mobile when a user is selected */}
        <div
          className={`h-full transition-all duration-300 lg:w-[30%] ${selectedUser ? "hidden lg:block" : "w-full"}`}
        >
          <div className="h-full overflow-hidden lg:rounded-3xl border-slate-200 bg-white shadow-md lg:border">
            <Messageuser
              handleId={handleId}
              userId={getUserId(selectedUser)}
              users={users.map((u) => ({
                ...(u || {}),
                isTyping: typingUsers.has(getUserId(u)),
              }))}
            />
          </div>
        </div>

        {/* Chat Panel - Full screen on mobile with improved visual depth */}
        <div
          className={`lg:flex-1 h-full transition-all duration-300 ${!selectedUser ? "hidden lg:block" : "w-full"}`}
        >
          {selectedUser ? (
            <div className="flex h-full flex-col overflow-hidden lg:rounded-3xl border-slate-200 bg-white shadow-md lg:border">
              <div className="border-b px-4 py-3 sm:px-5 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                      <IoChevronBack size={24} />
                    </button>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 leading-tight">
                        {selectedUser?.name ||
                          selectedUser?.displayName ||
                          "Unnamed chat"}
                      </h2>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${isSelectedUserOnline ? "bg-emerald-500" : "bg-slate-300"}`}
                        ></span>
                        <p className="text-xs font-medium text-slate-500">
                          {isSelectedUserOnline ? "Active now" : "Offline"}
                        </p>
                      </div>
                    </div>
                  </div>
                  {typingUsers.has(selectedUserId) && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      typing...
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-hidden px-3 py-3 sm:px-5">
                <div
                  ref={chatContainerRef}
                  className="flex h-full flex-col gap-4 overflow-y-auto pr-2 pb-4"
                >
                  {userChats?.length > 0 ? (
                    Object.keys(groupedMessages).map((date, index) => (
                      <div key={index}>
                        <div className="flex justify-center my-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {date}
                          </span>
                        </div>
                        {groupedMessages[date].map((chat) => {
                          const isIncoming =
                            getUserId(chat) !== cookies.userId &&
                            getUserId(chat) !== cookies.name;
                          return (
                            <div
                              key={chat._id || chat.timestamp || Math.random()}
                              className={`flex ${isIncoming ? "justify-start" : "justify-end"}`}
                            >
                              <div
                                className={`max-w-[85%] lg:max-w-[70%] break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                                  isIncoming
                                    ? "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"
                                    : "bg-blue-600 text-white rounded-br-none"
                                }`}
                              >
                                {chat.attachment && (
                                  <button
                                    className="mb-3 inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700"
                                    onClick={() => handleClick(chat.attachment)}
                                  >
                                    <FaFileAlt size={16} />
                                    View attachment
                                  </button>
                                )}
                                <p className="whitespace-pre-wrap break-words">
                                  {chat.message}
                                </p>
                                <p
                                  className={`mt-1 text-[10px] text-right ${isIncoming ? "text-slate-400" : "text-blue-100"}`}
                                >
                                  {dateFormat(
                                    chat.timestamp ||
                                      chat.createdAt ||
                                      new Date(),
                                    "h:MM TT",
                                  )}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
                      <p className="text-lg font-semibold">No messages yet</p>
                      <p className="mt-2 text-sm">
                        Select a conversation to start chatting.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {filePreview && (
                <div className="border-t border-gray-200 bg-slate-50 px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="rounded-full bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-100"
                        onClick={() => {
                          setFilePreview(null);
                          setSelectedFile(null);
                        }}
                        aria-label="Remove attachment preview"
                      >
                        <IoClose size={20} />
                      </button>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {selectedFile?.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Preview attached file
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedFile?.type?.startsWith("image/") ? (
                        <img
                          src={filePreview}
                          alt="Preview"
                          className="h-24 rounded-2xl object-contain"
                        />
                      ) : selectedFile?.type === "application/pdf" ? (
                        <AiFillFilePdf size={48} className="text-slate-700" />
                      ) : (
                        <FaFileAlt size={48} className="text-slate-700" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 bg-white p-3 sm:p-4">
                <div className="relative mx-auto flex w-full items-center gap-2">
                  <label
                    htmlFor="file-upload"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                  >
                    <IoIosAttach size={24} />
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    name="attachment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <input
                    type="text"
                    placeholder="Type your message or attach a file..."
                    aria-label="Message input"
                    className="w-full rounded-full border-slate-200 bg-slate-100 py-3 pl-5 pr-12 text-[15px] text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all border"
                    name="message"
                    value={message}
                    onChange={handleMessage}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="button"
                    aria-label="Send message"
                    onClick={handleSubmitMessage}
                    disabled={!message.trim() && !selectedFile}
                    className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition-all hover:bg-blue-700 active:scale-90 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <BsSendFill size={18} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[70vh] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <div>
                <img
                  src="image/chatimage.png"
                  alt="Chat placeholder"
                  className="mx-auto mb-6 h-40 w-40 object-contain"
                />
                <h2 className="text-2xl font-semibold text-slate-900">
                  Select a conversation
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Choose a chat from the left panel to view your message history
                  and continue talking.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
