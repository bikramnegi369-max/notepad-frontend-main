import {
  getAttachmentName,
  getAttachmentSize,
  normalizeAttachments,
} from "./attachments";

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

  return {
    id: String(id),
    noteId: noteId ? String(noteId) : null,
    title: draft.title || "",
    content: draft.content || "",
    updatedAt: draft.updatedAt || fallback.updatedAt || new Date().toISOString(),
    attachments,
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
  return saveLocalDrafts([normalized, ...loadLocalDrafts()]);
}

export function removeLocalDraftsForNote(noteId) {
  return saveLocalDrafts(
    loadLocalDrafts().filter((draft) => draft.noteId !== String(noteId)),
  );
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
