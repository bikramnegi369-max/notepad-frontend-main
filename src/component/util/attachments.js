import { getApiRootUrl } from "../api/api";

export const ATTACHMENT_CONFIG = {
  maxFileSizeMb: 20,
  maxFiles: 10,
};

export function buildAttachmentUrl(attachment) {
  if (!attachment) return null;

  const raw =
    typeof attachment === "string"
      ? attachment
      : attachment.url ||
        attachment.secure_url ||
        attachment.path ||
        attachment.location ||
        attachment.href ||
        attachment.dataUrl ||
        "";

  if (!raw || typeof raw !== "string") return null;

  if (
    raw.startsWith("data:") ||
    /^blob:/i.test(raw) ||
    /^https?:\/\//i.test(raw)
  ) {
    return raw;
  }

  const base = getApiRootUrl().replace(/\/$/, "");
  const normalized = String(raw).replace(/^\/+/, "");
  if (normalized.startsWith("public/")) return `${base}/${normalized}`;
  return `${base}/public/attachments/${normalized}`;
}

export function getAttachmentName(attachment) {
  if (!attachment) return "Attachment";
  if (attachment instanceof File) return attachment.name;
  if (typeof attachment === "string")
    return attachment.split("/").pop() || "Attachment";
  return (
    attachment.name ||
    attachment.filename ||
    attachment.original_filename ||
    attachment.originalname ||
    attachment.key ||
    attachment.url?.split("/").pop() ||
    attachment.path?.split("/").pop() ||
    "Attachment"
  );
}

export function isImageAttachment(attachment) {
  if (!attachment) return false;
  const type = attachment.type || attachment.mimetype || "";
  if (typeof type === "string" && type.startsWith("image/")) return true;
  const name = getAttachmentName(attachment).toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico|tiff)$/.test(name);
}

export function getAttachmentSize(attachment) {
  return Number(attachment?.size || attachment?.bytes || 0);
}

export function getAttachmentIdentity(attachment) {
  if (!attachment) return "";

  let fileObj = null;
  if (attachment instanceof File) {
    fileObj = attachment;
  } else if (attachment?.file instanceof File) {
    fileObj = attachment.file;
  }

  if (fileObj) {
    // Generate a stable ID based on file metadata
    const name = fileObj.name || "file";
    const size = fileObj.size || 0;
    const modified = fileObj.lastModified || 0;
    return `file-${name}-${size}-${modified}`;
  }

  const id =
    attachment._id ||
    attachment.id ||
    attachment.public_id ||
    attachment.url ||
    attachment.path ||
    attachment.dataUrl ||
    "";

  return id ? String(id) : "";
}

export function formatAttachmentSize(size = 0) {
  if (!size) return "File";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

// Extract the raw File from any shape: raw File, normalized wrapper, or leave as-is
function extractFile(attachment) {
  if (attachment instanceof File) return attachment;
  if (attachment?.file instanceof File) return attachment.file;
  return null;
}

export function normalizeAttachment(attachment) {
  if (!attachment) return null;

  // Normalized wrapper holding a live File — pass through cleanly
  if (attachment?.file instanceof File) {
    return {
      kind: "file",
      file: attachment.file,
      name: attachment.name || attachment.file.name,
      type: attachment.type || attachment.file.type,
      size: attachment.size || attachment.file.size,
      url: null,
      dataUrl: null,
    };
  }

  if (attachment instanceof File) {
    return {
      kind: "file",
      file: attachment,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      url: null,
      dataUrl: null,
    };
  }

  const name = getAttachmentName(attachment);
  const url = buildAttachmentUrl(attachment);
  // dataUrl is only the base64 data: string, never a remote URL
  const dataUrl =
    typeof attachment.dataUrl === "string" &&
    attachment.dataUrl.startsWith("data:")
      ? attachment.dataUrl
      : null;

  return {
    kind: dataUrl ? "stored" : "remote",
    ...attachment,
    name,
    type: attachment.type || attachment.mimetype || "",
    size: getAttachmentSize(attachment),
    url,
    dataUrl,
  };
}

export function normalizeAttachments(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map(normalizeAttachment).filter(Boolean);
}

export function validateFiles(files, existingCount = 0) {
  const maxBytes = ATTACHMENT_CONFIG.maxFileSizeMb * 1024 * 1024;
  if (existingCount + files.length > ATTACHMENT_CONFIG.maxFiles) {
    return `You can attach up to ${ATTACHMENT_CONFIG.maxFiles} files.`;
  }

  const oversized = files.find((file) => file.size > maxBytes);
  if (oversized) {
    return `${oversized.name} must be ${ATTACHMENT_CONFIG.maxFileSizeMb} MB or less.`;
  }

  return "";
}

// Converts any attachment (File, wrapper, or remote object) to a stored { dataUrl } object.
// Non-File items (remote server attachments) are passed through unchanged.
export function filesToStoredAttachments(attachments) {
  return Promise.all(
    (attachments || []).map((attachment) => {
      const file = extractFile(attachment);

      if (file) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              kind: "stored",
              name: file.name,
              type: file.type,
              size: file.size,
              dataUrl: reader.result,
            });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      }

      // Already a plain object (remote/stored) — pass through
      return Promise.resolve(attachment);
    }),
  ).then((items) => items.filter(Boolean));
}

// Converts attachments to plain serializable references safe for localStorage / API.
// Call filesToStoredAttachments first for local Files so they have a dataUrl.
export function attachmentsToDraftReferences(attachments) {
  return (attachments || []).map((attachment) => {
    const file = extractFile(attachment);

    // Still a live File with no dataUrl — mark pending, metadata only
    if (file) {
      return {
        kind: "local-file",
        name: file.name,
        type: file.type,
        size: file.size,
        url: null,
        dataUrl: null,
        path: null,
        location: null,
        key: null,
        id: null,
        pendingUpload: true,
      };
    }

    // Stored (has dataUrl) or remote
    const dataUrl =
      attachment.dataUrl && attachment.dataUrl.startsWith("data:")
        ? attachment.dataUrl
        : null;
    const url =
      attachment.url && !/^(data:|blob:)/i.test(attachment.url)
        ? attachment.url
        : null;

    return {
      kind: dataUrl ? "stored" : attachment.kind || "remote",
      name: getAttachmentName(attachment),
      type: attachment.type || attachment.mimetype || "",
      size: getAttachmentSize(attachment),
      url,
      dataUrl,
      path: attachment.path || null,
      location: attachment.location || null,
      key: attachment.key || null,
      id: attachment.id || attachment._id || null,
      pendingUpload: false,
    };
  });
}

export function storedAttachmentToFile(attachment) {
  if (!attachment?.dataUrl) return null;

  try {
    const [meta, body] = attachment.dataUrl.split(",");
    const mime =
      meta?.match(/:(.*?);/)?.[1] ||
      attachment.type ||
      "application/octet-stream";
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], attachment.name || "attachment", { type: mime });
  } catch (error) {
    return null;
  }
}

export function restoreDraftAttachments(attachments) {
  return (attachments || [])
    .map((attachment) => {
      // Stored with dataUrl → restore to File
      if (attachment?.dataUrl) {
        const file = storedAttachmentToFile(attachment);
        if (file) return file;
      }
      // Local-file ref with no data — cannot restore, skip
      if (attachment?.pendingUpload || attachment?.kind === "local-file") {
        return null;
      }
      // Remote server attachment — return as-is
      return attachment || null;
    })
    .filter(Boolean);
}

export function splitAttachmentFiles(attachments) {
  return (attachments || []).reduce(
    (acc, attachment) => {
      const file = extractFile(attachment);
      if (file) {
        acc.files.push(file);
        return acc;
      }
      // Remote / server attachment with a resolvable URL
      if (buildAttachmentUrl(attachment)) {
        acc.existing.push(attachment);
        return acc;
      }
      // Local-file ref with no data — skip
      return acc;
    },
    { files: [], existing: [], pending: [] },
  );
}

export function appendAttachmentsToFormData(formData, attachments) {
  const { files, existing } = splitAttachmentFiles(attachments);

  files.forEach((file) => {
    formData.append("attachments", file);
  });

  existing.forEach((attachment) => {
    formData.append("existingAttachments", JSON.stringify(attachment));
  });

  return { files, existing };
}
