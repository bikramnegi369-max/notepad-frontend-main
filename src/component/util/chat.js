import dateFormat from "dateformat";
import { getApiRootUrl } from "../api/api";

export const CHAT_EVENTS = {
  messageList: "messageList",
  messages: "messages",
  privateMessage: "private message",
  typing: "typing",
  users: "users",
  onlineUsers: "getOnlineUsers",
  markRead: "markRead", // New event to sync unread status
};

export const CHAT_CONFIG = {
  typingThrottleMs: 1200,
  typingVisibleMs: 2500,
  maxAttachmentSizeMb: 15,
  notificationSoundUrl: "/notification.mp3", // Clean "Ping" sound
};

export function getIdentityValue(value) {
  if (!value) return null;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return (
    value.id ||
    value._id ||
    value.userId ||
    value.name ||
    value.username ||
    null
  );
}

export function getParticipantId(item) {
  return (
    getIdentityValue(item?.id) ||
    getIdentityValue(item?._id) ||
    getIdentityValue(item?.sender) ||
    getIdentityValue(item?.to) ||
    getIdentityValue(item?.from) ||
    null
  );
}

export function getDisplayName(item, fallback = "Unknown") {
  return (
    item?.name ||
    item?.username ||
    item?.displayName ||
    item?.otherName ||
    item?.fromName ||
    item?.toName ||
    fallback
  );
}

export function normalizeConversation(item = {}) {
  const id = getParticipantId(item);
  if (!id) return null;

  return {
    ...item,
    id,
    name: getDisplayName(item, "Chat"),
    lastMessage:
      item?.lastMessage ||
      item?.message ||
      item?.latest ||
      (item?.attachment ? "Attachment" : ""),
    updatedAt:
      item?.updatedAt ||
      item?.timestamp ||
      item?.createdAt ||
      item?.lastSeen ||
      "",
    newMessages: Number(item?.unread ?? item?.newMessages ?? 0),
    isOnline: Boolean(item?.isOnline),
  };
}

export function normalizeConversations(list) {
  return Array.isArray(list)
    ? list.map(normalizeConversation).filter(Boolean)
    : [];
}

export function normalizeMessage(item = {}) {
  const sender = getIdentityValue(item?.sender);
  const from = getIdentityValue(item?.from);
  const to = getIdentityValue(item?.to);
  const clientId =
    item?.clientId ||
    item?.cid ||
    item?._cid ||
    item?._localId ||
    item?.localId ||
    null;

  // attachment must always be a string path/name, never a File object
  const rawAttachment = item?.attachment || item?.filePath || null;
  const attachment =
    typeof rawAttachment === "string"
      ? rawAttachment
      : rawAttachment?.secure_url ||
        rawAttachment?.url ||
        rawAttachment?.path ||
        null;

  return {
    ...item,
    clientId,
    id:
      item?._id ||
      item?.id ||
      clientId ||
      `msg-${item?.timestamp || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: item?.message || "",
    attachment,
    timestamp: item?.timestamp || item?.createdAt || new Date().toISOString(),
    sender,
    from,
    to,
    status: item?.status || "sent",
  };
}

export function normalizeMessages(list) {
  return Array.isArray(list) ? list.map(normalizeMessage) : [];
}

export function isMessageForConversation(message, selectedUserId, currentUser) {
  if (!selectedUserId) return false;
  const from =
    getIdentityValue(message?.from) || getIdentityValue(message?.sender) || "";
  const to = getIdentityValue(message?.to) || "";
  const selected = String(selectedUserId);
  const selfIds = getCurrentUserIds(currentUser);

  return (
    String(from) === selected ||
    String(to) === selected ||
    (selfIds.includes(String(from)) && String(to) === selected) ||
    (selfIds.includes(String(to)) && String(from) === selected)
  );
}

export function isIncomingMessage(message, currentUser, selectedUserId) {
  const from =
    getIdentityValue(message?.from) || getIdentityValue(message?.sender) || "";
  const to = getIdentityValue(message?.to) || "";
  const selfIds = getCurrentUserIds(currentUser);
  const selected = selectedUserId ? String(selectedUserId) : "";

  if (message?.isOwn === true || message?.fromMe === true) return false;
  if (message?.isOwn === false || message?.fromMe === false) return true;
  if (selfIds.includes(String(from))) return false;
  if (selected && String(from) === selected) return true;
  if (selfIds.includes(String(to)) && String(from)) return true;

  return false;
}

export function getCurrentUserIds(currentUser) {
  return [
    currentUser?.userId,
    currentUser?._id,
    currentUser?.id,
    currentUser?.name,
    currentUser?.username,
  ]
    .filter(Boolean)
    .map(String);
}

export function groupMessagesByDate(messages) {
  return messages.reduce((acc, message) => {
    const key = dateFormat(message.timestamp, "d mmmm yyyy");
    if (!acc[key]) acc[key] = [];
    acc[key].push(message);
    return acc;
  }, {});
}

export function buildAttachmentUrl(attachment) {
  if (!attachment) return null;
  if (/^(https?|blob|data):/i.test(attachment)) return attachment;

  const base = getApiRootUrl().replace(/\/$/, "");
  const normalized = String(attachment).replace(/^\/+/, "");
  if (normalized.startsWith("public/")) return `${base}/${normalized}`;
  return `${base}/public/attachments/${normalized}`;
}

export function formatFileSize(bytes = 0) {
  if (!bytes) return "File";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Plays a notification sound for new incoming messages.
 * Uses a singleton audio object to avoid overlapping issues.
 */
let notificationAudio = null;
export function playNotificationSound() {
  try {
    if (!notificationAudio) {
      notificationAudio = new Audio(CHAT_CONFIG.notificationSoundUrl);
    }
    // Reset to start if already playing or finished
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch((err) => {
      console.warn(
        "Audio playback prevented by browser policy until user interaction.",
        err,
      );
    });
  } catch (e) {
    console.error("Failed to play notification sound", e);
  }
}
