import { getApiRootUrl } from "../api/api";

export const ATTACHMENT_CONFIG = {
  maxFileSizeMb: 20,
  maxFiles: 10,
};

export function buildAttachmentUrl(attachment) {
  const raw =
    typeof attachment === "string"
      ? attachment
      : attachment?.url ||
        attachment?.secure_url ||
        attachment?.path ||
        attachment?.location ||
        attachment?.dataUrl ||
        attachment?.href ||
        "";

  if (!raw) return null;
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
  const type = attachment?.type || attachment?.mimetype || "";
  if (type.startsWith("image/")) return true;
  const name = getAttachmentName(attachment).toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|avif|svg)$/.test(name);
}

export function getAttachmentSize(attachment) {
  return Number(attachment?.size || attachment?.bytes || 0);
}

export function getAttachmentIdentity(attachment) {
  if (!attachment) return "";
  if (attachment instanceof File) {
    return `${attachment.name}-${attachment.size}-${attachment.lastModified}`;
  }

  return String(
    attachment._id ||
      attachment.id ||
      attachment.public_id ||
      attachment.asset_id ||
      attachment.url ||
      attachment.secure_url ||
      attachment.path ||
      attachment.location ||
      attachment.key ||
      attachment.dataUrl ||
      getAttachmentName(attachment),
  );
}

export function formatAttachmentSize(size = 0) {
  if (!size) return "File";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function normalizeAttachment(attachment) {
  if (!attachment) return null;
  if (attachment instanceof File) {
    return {
      kind: "file",
      file: attachment,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      url: null,
    };
  }

  const name = getAttachmentName(attachment);
  return {
    kind: attachment.dataUrl ? "stored" : "remote",
    ...attachment,
    name,
    type: attachment.type || attachment.mimetype || "",
    size: getAttachmentSize(attachment),
    url: buildAttachmentUrl(attachment),
    dataUrl: attachment.dataUrl,
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

export function filesToStoredAttachments(files) {
  return Promise.all(
    (files || []).map(
      (file) =>
        new Promise((resolve) => {
          if (!(file instanceof File)) {
            resolve(file);
            return;
          }

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
        }),
    ),
  ).then((items) => items.filter(Boolean));
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
  return normalizeAttachments(attachments).map((attachment) => {
    const restoredFile = storedAttachmentToFile(attachment);
    return restoredFile || attachment;
  });
}

export function splitAttachmentFiles(attachments) {
  return (attachments || []).reduce(
    (acc, attachment) => {
      if (attachment instanceof File) {
        acc.files.push(attachment);
      } else if (attachment?.file instanceof File) {
        acc.files.push(attachment.file);
      } else {
        acc.existing.push(attachment);
      }
      return acc;
    },
    { files: [], existing: [] },
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
