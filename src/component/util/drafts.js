import {
  getAttachmentName,
  getAttachmentSize,
  normalizeAttachments,
  restoreDraftAttachments,
  appendAttachmentsToFormData,
} from "./attachments";
import Api_Url, { API_BASE_URL } from "../api/api";

export const DRAFT_STORAGE_KEY = "note-drafts-v3";
export const LEGACY_CREATE_DRAFT_KEY = "note-create-drafts-v2";
export const LEGACY_UPDATE_DRAFT_KEY = "note-update-drafts";

const LOCAL_DRAFT_PREFIX = "local-draft";

export function createDraftId() {
  return `${LOCAL_DRAFT_PREFIX}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function isLocalDraftId(id) {
  return typeof id === "string" && id.startsWith(`${LOCAL_DRAFT_PREFIX}-`);
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    localStorage.removeItem(key);
    return fallback;
  }
}

export function normalizeDraft(draft, fallback = {}) {
  if (!draft) return null;

  const id = draft._id || draft.id || fallback.id || createDraftId();
  const noteId = draft.noteId || draft.note?._id || draft.note || fallback.noteId || null;
  const attachments = normalizeAttachments(draft.attachments || draft.attachment);
  const isUnsynced = draft.isUnsynced !== undefined ? Boolean(draft.isUnsynced) : Boolean(fallback.isUnsynced || false);

  return {
    id: String(id),
    noteId: noteId ? String(noteId) : null,
    title: draft.title || "",
    content: draft.content || "",
    updatedAt: draft.updatedAt || fallback.updatedAt || new Date().toISOString(),
    attachments,
    isUnsynced,
  };
}

function mergeDraftLists(...draftLists) {
  const merged = [];

  draftLists.flat().filter(Boolean).forEach((draft) => {
    const normalized = normalizeDraft(draft);
    if (!normalized) return;

    const existingIndex = merged.findIndex(
      (item) =>
        item.id === normalized.id ||
        (item.noteId && normalized.noteId && item.noteId === normalized.noteId),
    );

    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...normalized,
        attachments:
          normalized.attachments.length > 0
            ? normalized.attachments
            : merged[existingIndex].attachments,
      };
    } else {
      merged.push(normalized);
    }
  });

  return merged.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function sanitizeAttachmentForStorage(attachment) {
  if (!attachment) return null;

  // Never persist File objects or live blob references to localStorage
  const url =
    attachment.url && !/^blob:/i.test(attachment.url) ? attachment.url : null;
  const dataUrl =
    attachment.dataUrl && attachment.dataUrl.startsWith("data:")
      ? attachment.dataUrl
      : null;

  return {
    kind: attachment.pendingUpload ? "local-file" : attachment.kind || "remote",
    id: attachment.id || attachment._id || null,
    name: getAttachmentName(attachment),
    type: attachment.type || attachment.mimetype || "",
    size: getAttachmentSize(attachment),
    url,
    dataUrl,
    path: attachment.path || null,
    location: attachment.location || null,
    key: attachment.key || null,
    pendingUpload: Boolean(attachment.pendingUpload || attachment.kind === "local-file"),
  };
}

function sanitizeDraftForStorage(draft) {
  return {
    ...draft,
    attachments: normalizeAttachments(draft.attachments)
      .map(sanitizeAttachmentForStorage)
      .filter(Boolean),
  };
}

function persistDrafts(drafts) {
  localStorage.removeItem(LEGACY_CREATE_DRAFT_KEY);
  localStorage.removeItem(LEGACY_UPDATE_DRAFT_KEY);
  localStorage.removeItem(DRAFT_STORAGE_KEY);

  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    return drafts;
  } catch (error) {
    if (error?.name !== "QuotaExceededError") {
      throw error;
    }

    const withoutAttachments = drafts.map((draft) => ({
      ...draft,
      attachments: [],
    }));

    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify(withoutAttachments),
      );
      return withoutAttachments;
    } catch (fallbackError) {
      const latestDraft = withoutAttachments[0] ? [withoutAttachments[0]] : [];
      try {
        if (latestDraft.length > 0) {
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(latestDraft));
        }
      } catch (finalError) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return [];
      }
      return latestDraft;
    }
  }
}

function loadLegacyCreateDrafts() {
  const value = readJson(LEGACY_CREATE_DRAFT_KEY, []);
  const drafts = Array.isArray(value) ? value : value ? [value] : [];
  return drafts.map((draft) => normalizeDraft(draft)).filter(Boolean);
}

function loadLegacyUpdateDrafts() {
  const value = readJson(LEGACY_UPDATE_DRAFT_KEY, {});
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  return Object.entries(value)
    .map(([noteId, draft]) =>
      normalizeDraft(draft, {
        id: draft?.id || createDraftId(),
        noteId,
      }),
    )
    .filter(Boolean);
}

export function loadLocalDrafts() {
  const current = readJson(DRAFT_STORAGE_KEY, []);
  const currentDrafts = Array.isArray(current) ? current : current ? [current] : [];
  return mergeDraftLists(currentDrafts, loadLegacyCreateDrafts(), loadLegacyUpdateDrafts());
}

export function saveLocalDrafts(drafts) {
  const normalized = mergeDraftLists(drafts)
    .map(sanitizeDraftForStorage)
    .filter(
      (draft) =>
        draft.title.trim() ||
        draft.content.trim() ||
        draft.attachments.length > 0,
    );

  if (normalized.length === 0) {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    localStorage.removeItem(LEGACY_CREATE_DRAFT_KEY);
    localStorage.removeItem(LEGACY_UPDATE_DRAFT_KEY);
    return [];
  }

  return persistDrafts(normalized);
}

export function upsertLocalDraft(nextDraft) {
  const normalized = normalizeDraft(nextDraft);
  if (!normalized) return loadLocalDrafts();
  const result = saveLocalDrafts([normalized, ...loadLocalDrafts()]);
  try {
    window.dispatchEvent(new Event("draftsUpdated"));
  } catch (e) {}
  return result;
}

export function removeLocalDraftsForNote(noteId) {
  const result = saveLocalDrafts(
    loadLocalDrafts().filter((draft) => draft.noteId !== String(noteId)),
  );
  try {
    window.dispatchEvent(new Event("draftsUpdated"));
  } catch (e) {}
  return result;
}

export function replaceLocalDraftId(oldId, serverId) {
  if (!oldId || !serverId) return loadLocalDrafts();

  return saveLocalDrafts(
    loadLocalDrafts().map((draft) =>
      draft.id === oldId ? { ...draft, id: String(serverId) } : draft,
    ),
  );
}

export function normalizeServerDrafts(data) {
  const drafts = Array.isArray(data) ? data : data ? [data] : [];
  return drafts.map((draft) => normalizeDraft(draft)).filter(Boolean);
}

function getTokenFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function mergeServerAndLocalDrafts(serverDrafts, localDrafts) {
  const merged = [];

  // Start with server drafts
  serverDrafts.forEach((sd) => {
    // If there is an unsynced local version of this draft, use the local version instead
    const localVersion = localDrafts.find(
      (ld) => ld.id === sd.id || (sd.noteId && ld.noteId === sd.noteId)
    );
    if (localVersion && localVersion.isUnsynced) {
      merged.push(localVersion);
    } else {
      merged.push(sd);
    }
  });

  // Add local-only drafts that do not exist on the server at all
  localDrafts.forEach((ld) => {
    const isLocalOnly = isLocalDraftId(ld.id) || ld.isUnsynced;
    if (isLocalOnly) {
      const exists = serverDrafts.some(
        (sd) => sd.id === ld.id || (ld.noteId && sd.noteId === ld.noteId)
      );
      if (!exists) {
        merged.push(ld);
      }
    }
  });

  return merged;
}

export async function syncDraftOnUnload(draftId, title, content, noteId = null) {
  const token = getTokenFromCookie();
  if (!token) return;

  const url = `${API_BASE_URL}/draft`;
  const formData = new FormData();
  formData.append("title", title || "");
  formData.append("content", content || "");
  if (draftId && !isLocalDraftId(draftId)) {
    formData.append("id", draftId);
  }
  if (noteId) {
    formData.append("noteId", noteId);
  }

  try {
    // Standard fetch with keepalive: true to sync background text drafts on unload
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      },
      body: formData,
      keepalive: true,
    });
  } catch (err) {
    console.error("Failed to sync draft on unload:", err);
  }
}

export async function syncUnsyncedDraftsToServer() {
  const localDrafts = loadLocalDrafts();
  const unsynced = localDrafts.filter((d) => d.isUnsynced);
  if (unsynced.length === 0) return;

  for (const draft of unsynced) {
    try {
      const formData = new FormData();
      formData.append("title", draft.title || "");
      formData.append("content", draft.content || "");
      if (draft.noteId) {
        formData.append("noteId", draft.noteId);
      }
      if (!isLocalDraftId(draft.id)) {
        formData.append("id", draft.id);
      }

      // Restore attachments and append them if any
      const restoredAttachments = restoreDraftAttachments(draft.attachments);
      appendAttachmentsToFormData(formData, restoredAttachments);

      const response = await Api_Url.post("draft", formData);

      let finalId = draft.id;
      if (response.data?.data?._id && isLocalDraftId(draft.id)) {
        finalId = response.data.data._id;
        replaceLocalDraftId(draft.id, finalId);
      }

      // Mark this draft as synced
      const currentLocal = loadLocalDrafts();
      const updated = currentLocal.map((d) =>
        d.id === finalId ? { ...d, isUnsynced: false } : d,
      );
      saveLocalDrafts(updated);
    } catch (err) {
      console.error(`Failed to sync unsynced draft ${draft.id} to server:`, err);
    }
  }
  window.dispatchEvent(new Event("draftsUpdated"));
}
