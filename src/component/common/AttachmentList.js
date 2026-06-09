import { useEffect, useMemo, useState } from "react";
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
  const [previewUrls, setPreviewUrls] = useState(() => new Map());

  useEffect(() => {
    const urls = new Map();
    items.forEach((attachment) => {
      if (attachment?.file instanceof File) {
        urls.set(
          getAttachmentIdentity(attachment),
          URL.createObjectURL(attachment.file),
        );
      }
    });

    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [items]);

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
        const identity = getAttachmentIdentity(attachment);
        const href =
          previewUrls.get(identity) || buildAttachmentUrl(attachment);
        const isImage = isImageAttachment(attachment);

        return (
          <div
            key={`${identity}-${index}`}
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
