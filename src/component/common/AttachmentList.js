import { useEffect, useMemo, useState, useRef, useLayoutEffect } from "react";
import {
  IoClose,
  IoCloudDownloadOutline,
  IoDocumentTextOutline,
  IoEyeOutline,
} from "react-icons/io5";
import {
  buildAttachmentUrl,
  formatAttachmentSize,
  getAttachmentIdentity,
  getAttachmentName,
  getAttachmentSize,
  isImageAttachment,
  normalizeAttachments,
} from "../util/attachments";

export default function AttachmentList({
  attachments,
  onRemove,
  compact = false,
  readOnly = false,
}) {
  const items = useMemo(() => normalizeAttachments(attachments), [attachments]);
  const [urls, setUrls] = useState(new Map());
  const fileUrlMapRef = useRef(new Map()); // Maps File objects to their Blob URLs

  // Create blob URLs for new files and cleanup old ones
  useLayoutEffect(() => {
    const currentFileUrlMap = fileUrlMapRef.current;
    const nextFileUrlMap = new Map();
    const activeFiles = new Set();
    let hasChanged = false;

    items.forEach((attachment) => {
      if (attachment?.file instanceof File) {
        const file = attachment.file;
        activeFiles.add(file);

        if (currentFileUrlMap.has(file)) {
          nextFileUrlMap.set(file, currentFileUrlMap.get(file));
        } else {
          const url = URL.createObjectURL(file);
          nextFileUrlMap.set(file, url);
          hasChanged = true;
        }
      }
    });

    // Clean up URLs for files that were removed
    currentFileUrlMap.forEach((url, file) => {
      if (!activeFiles.has(file)) {
        URL.revokeObjectURL(url);
        hasChanged = true;
      }
    });

    if (hasChanged) {
      fileUrlMapRef.current = nextFileUrlMap;
      setUrls(new Map(nextFileUrlMap));
    }
  }, [items]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      fileUrlMapRef.current.forEach((url) => URL.revokeObjectURL(url));
      fileUrlMapRef.current.clear();
    };
  }, []);

  const getPreviewUrl = (attachment, index) => {
    if (attachment?.file instanceof File) {
      return urls.get(attachment.file);
    }
    return buildAttachmentUrl(attachment);
  };

  if (items.length === 0) return null;

  return (
    <div
      className={`grid gap-3 ${
        compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {items.map((attachment, index) => {
        const name = getAttachmentName(attachment);
        const size = formatAttachmentSize(getAttachmentSize(attachment));
        const idFromMetadata = getAttachmentIdentity(attachment);
        const href = getPreviewUrl(attachment, index);
        const isImage = isImageAttachment(attachment);

        return (
          <div
            key={idFromMetadata || `item-${index}`}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-100 hover:shadow-md"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-50 text-slate-500">
              {isImage && href ? (
                <img src={href} alt="" className="h-full w-full object-cover" />
              ) : (
                <IoDocumentTextOutline size={22} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">
                {name}
              </p>
              <p className="text-xs font-medium text-slate-400">{size}</p>
            </div>

            {href && (
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"
                  aria-label={`Open ${name}`}
                >
                  <IoEyeOutline size={18} />
                </a>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  download={name}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"
                  aria-label={`Download ${name}`}
                >
                  <IoCloudDownloadOutline size={18} />
                </a>
              </div>
            )}

            {!readOnly && onRemove && (
              <button
                type="button"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${name}`}
              >
                <IoClose size={18} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
