import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PiEye } from "react-icons/pi";
import dateFormat from "dateformat";
import Api_Url from "../api/api";
import { toast } from "react-toastify";
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
        className="grid h-10 w-10 place-items-center rounded-full text-green-700 transition hover:bg-green-50"
        aria-label="View note"
      >
        <PiEye size={22} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <section
            className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-note-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-4 sm:px-6">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {data?.createdAt
                    ? dateFormat(data.createdAt, "dd mmm yyyy, h:MM TT")
                    : "Note details"}
                </p>
                <h2
                  id="view-note-title"
                  className="text-xl font-semibold text-gray-950"
                >
                  View Note
                </h2>
              </div>
              <button
                type="button"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-950"
                onClick={() => setOpen(false)}
                aria-label="Close note"
              >
                <IoClose size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {isLoading ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-gray-600">
                  Loading note...
                </div>
              ) : (
                <>
                  <div className="min-h-64 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left text-base leading-7 text-gray-900">
                    <p className="whitespace-pre-wrap break-words">
                      {data?.content || "Empty note"}
                    </p>
                  </div>

                  {attachments.filter(Boolean).length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-gray-950">
                        Attachments
                      </h3>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {attachments
                          .filter(Boolean)
                          .map((attachment, index) => {
                            const name = getAttachmentName(attachment);
                            const href =
                              typeof attachment === "string"
                                ? attachment
                                : attachment?.url ||
                                  attachment?.path ||
                                  attachment?.location ||
                                  null;

                            return (
                              <div
                                key={`${name}-${index}`}
                                className="flex min-w-0 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                              >
                                <IoDocumentTextOutline
                                  className="shrink-0 text-gray-600"
                                  size={22}
                                />
                                {href ? (
                                  <a
                                    className="truncate text-sm font-medium text-gray-900 hover:underline"
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {name}
                                  </a>
                                ) : (
                                  <span className="truncate text-sm font-medium text-gray-900">
                                    {name}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-100"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
              <Link
                to={`/update/${id}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-gray-800"
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
