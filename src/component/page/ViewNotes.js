import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PiEye } from "react-icons/pi";
import dateFormat from "dateformat";
import Api_Url from "../api/api";
import { toast } from "react-toastify";
import {
  buildAttachmentUrl,
  formatAttachmentSize,
  isImageAttachment,
} from "../util/attachments";
import {
  IoClose,
  IoCreateOutline,
  IoDocumentTextOutline,
} from "react-icons/io5";

export default function ViewNotes({ id }) {
  const [isOpen, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleNote = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const response = await Api_Url.get(`viewnote/${id}`);
      setData(response.data.data);
    } catch (error) {
      setData(null);
      toast.error("Failed to load note.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isOpen) {
      handleNote();
    }
  }, [handleNote, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const attachments = useMemo(() => {
    const rawAttachments = data?.attachments || data?.attachment || [];
    return Array.isArray(rawAttachments) ? rawAttachments : [rawAttachments];
  }, [data]);

  const getAttachmentName = (attachment) => {
    if (!attachment) return "Attachment";
    if (typeof attachment === "string") return attachment.split("/").pop();
    return attachment.name || attachment.filename || "Attachment";
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900"
        aria-label="View note"
      >
        <PiEye size={20} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <section
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-t-[2.5rem] border border-slate-200 bg-white shadow-2xl sm:rounded-[2.5rem] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-note-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-white/50 px-6 py-6 backdrop-blur-md sm:px-10 sm:py-8">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600/80">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500"></span>
                  {data?.createdAt
                    ? dateFormat(data.createdAt, "dd mmm yyyy • h:MM TT")
                    : "Note details"}
                </div>
                <h2
                  id="view-note-title"
                  className="text-xl font-bold tracking-tight text-gray-950 sm:text-2xl"
                >
                  {isLoading ? "Loading..." : data?.title || "Untitled Note"}
                </h2>
              </div>
              <button
                type="button"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500"
                onClick={() => setOpen(false)}
                aria-label="Close note"
              >
                <IoClose size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white px-6 py-8 sm:px-10">
              {isLoading ? (
                <div className="flex h-40 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 mb-2"></div>
                  Loading note...
                </div>
              ) : (
                <>
                  <div className="group rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-8">
                    <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                      Note Content
                    </div>
                    <p className="whitespace-pre-wrap break-words text-lg leading-relaxed text-slate-700">
                      {data?.content || "Empty note"}
                    </p>
                  </div>

                  {attachments.filter(Boolean).length > 0 && (
                    <div className="mt-8">
                      <h3 className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        <span className="h-px w-4 bg-slate-200"></span>
                        Attachments
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {attachments
                          .filter(Boolean)
                          .map((attachment, index) => {
                            const name = getAttachmentName(attachment);
                            const size = formatAttachmentSize(
                              attachment?.size || 0,
                            );
                            const href = buildAttachmentUrl(attachment);
                            const isImg = isImageAttachment(attachment);

                            return (
                              <div
                                key={`${name}-${index}`}
                                className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-all hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10"
                              >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                                  {isImg && href ? (
                                    <img
                                      src={href}
                                      alt="Preview"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <IoDocumentTextOutline size={24} />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  {href ? (
                                    <a
                                      className="block truncate text-sm font-bold text-slate-800 transition-colors hover:text-indigo-600 hover:underline"
                                      href={href}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {name}
                                    </a>
                                  ) : (
                                    <span className="block truncate text-sm font-bold text-slate-800">
                                      {name}
                                    </span>
                                  )}
                                  <p className="text-[10px] text-slate-400">
                                    {size}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/30 px-6 py-6 sm:flex-row sm:justify-end sm:px-10">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-slate-200 px-8 text-sm font-bold text-slate-600 transition-all hover:bg-white hover:shadow-sm active:scale-95"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
              <Link
                to={`/update/${id}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-8 text-sm font-bold text-white shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 active:scale-95"
              >
                <IoCreateOutline size={18} />
                Edit note
              </Link>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
