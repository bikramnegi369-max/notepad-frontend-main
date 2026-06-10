// src/components/Header.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import {
  IoAddOutline,
  IoChatbubblesOutline,
  IoDocumentTextOutline,
  IoFileTrayOutline,
} from "react-icons/io5";
import { Link, useNavigate, useLocation } from "react-router-dom";
import useAuth from "../../contexts/Auth";
import { useSocket } from "../../contexts/SocketContext";
import useListMessage from "../../contexts/useListMessage";
import {
  CHAT_EVENTS,
  isIncomingMessage,
  normalizeConversations,
  playNotificationSound,
} from "../util/chat";

const navLinks = [
  { label: "Add Note", href: "/", icon: IoAddOutline },
  { label: "All Notes", href: "/allnotes", icon: IoDocumentTextOutline },
  { label: "Chat", href: "/message", icon: IoChatbubblesOutline },
  { label: "Drafts", href: "/draft", icon: IoFileTrayOutline },
];

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cookies, removeCookie, setAuth } = useAuth();
  const { socket } = useSocket();
  const messageList = useListMessage();
  const [menuOpen, setMenuOpen] = useState(false);

  // Centralized user identity for chat logic
  const currentUser = useMemo(
    () => ({
      id: cookies?.id,
      name: cookies?.name,
      userId: cookies?.userId,
      username: cookies?.username,
    }),
    [cookies],
  );

  // Calculate global unread count from the message list provided by context
  const totalUnreadCount = useMemo(() => {
    const conversations = normalizeConversations(messageList);
    return conversations.reduce((acc, conv) => acc + (conv.newMessages || 0), 0);
  }, [messageList]);

  const refreshLists = useCallback(() => {
    if (socket?.connected) {
      socket.emit(CHAT_EVENTS.messageList);
    }
  }, [socket]);

  // Global side effects for new messages: Sound and Title update
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      // If message is for us and we aren't the sender
      if (isIncomingMessage(data, currentUser)) {
        playNotificationSound();
        refreshLists(); // Ensure the global unread count stays in sync
      }
    };

    socket.on(CHAT_EVENTS.privateMessage, handleNewMessage);
    return () => socket.off(CHAT_EVENTS.privateMessage, handleNewMessage);
  }, [socket, currentUser, refreshLists]);

  // Sync browser tab title with unread status
  useEffect(() => {
    const baseTitle = "Notepad";
    if (totalUnreadCount > 0) {
      document.title = `(${totalUnreadCount}) New Messages | ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [totalUnreadCount]);

  const handleLogout = () => {
    removeCookie("token", { path: "/" });
    removeCookie("name", { path: "/" });
    removeCookie("userId", { path: "/" });
    setAuth(false);
    navigate("/login", { replace: true });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3 text-slate-900">
          <img
            src="image/logo.png"
            alt="Notepad logo"
            className="h-10 w-10 rounded-full border border-slate-200 object-cover"
          />
          <div>
            <p className="text-lg font-semibold">Notepad</p>
            <p className="text-xs text-slate-500">
              Notes, drafts & chat in one place
            </p>
          </div>
        </Link>

        <button
          type="button"
          className="relative inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:hidden"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          Menu
          {totalUnreadCount > 0 && !menuOpen && (
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
            </span>
          )}
        </button>

        <nav
          className={`w-full transition-all duration-200 sm:flex sm:w-auto ${menuOpen ? "block" : "hidden"}`}
          aria-hidden={!menuOpen}
        >
          <ul className="flex flex-col gap-2 px-2 pb-4 sm:flex-row sm:items-center sm:gap-4 sm:px-0 sm:pb-0">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className={`block rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 sm:px-3 ${
                      isActive
                        ? "bg-slate-100 text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="relative flex items-center gap-2">
                      {link.icon && <link.icon size={18} className="opacity-70" />}
                      {link.label}
                      {link.label === "Chat" && totalUnreadCount > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                          {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center justify-end gap-3">
          <p className="hidden w-fit text-sm font-medium text-slate-600 sm:block">
            Hi, {cookies?.name ?? "User"}
          </p>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
