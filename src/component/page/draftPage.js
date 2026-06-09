import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MdDeleteOutline } from "react-icons/md";
import {
  IoAdd,
  IoCreateOutline,
  IoDocumentAttachOutline,
} from "react-icons/io5";
import useAuth from "../../contexts/Auth";
import Api_Url from "../api/api";
import dateFormat from "dateformat";
import {
  isLocalDraftId,
  loadLocalDrafts,
  normalizeServerDrafts,
  saveLocalDrafts,
} from "../util/drafts";
import AttachmentList from "../common/AttachmentList";

export default function DraftPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const loadDraft = useCallback(async () => {
    setIsLoading(true);

    const localDrafts = loadLocalDrafts();

    try {
      const response = await Api_Url.get("draft");
      const normalizedDrafts = normalizeServerDrafts(response.data.data);

      if (normalizedDrafts.length > 0) {
        // Source of truth is the server, but keep local-only drafts
        const merged = [...normalizedDrafts];
        localDrafts.forEach((ld) => {
          const exists = normalizedDrafts.some(
            (sd) => sd.id === ld.id || (ld.noteId && sd.noteId === ld.noteId),
          );
          if (!exists) merged.push(ld);
        });

        const savedDrafts = saveLocalDrafts(merged);
        setDrafts(savedDrafts);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      // remote draft fetch failed; continue with local drafts
    }

    setDrafts(localDrafts);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const handleDeleteDraft = async () => {
    try {
      setIsDeleting(true);
      const remaining =
        deleteId === "all" ? [] : drafts.filter((item) => item.id !== deleteId);

      // Determine which draft(s) to delete from the backend
      if (deleteId === "all") {
        await Api_Url.delete("draft"); // Backend endpoint to delete all drafts for the user
      } else {
        // If it's a specific draft, send its ID to the backend
        const draftToDelete = drafts.find((item) => item.id === deleteId);
        if (draftToDelete && !isLocalDraftId(draftToDelete.id)) {
          await Api_Url.delete(`draft/${draftToDelete.id}`);
        }
      }

      saveLocalDrafts(remaining);
      setDrafts(remaining);

      setDeleteId(null);
      toast.success("Draft deleted.");
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        logout();
        navigate("/login");
        return;
      }
      toast.error("Failed to delete draft.");
    } finally {
      setIsDeleting(false);
    }
  };

  const resumeDraft = (draft) => {
    const targetPath = draft.noteId ? `/update/${draft.noteId}` : "/"; // Correctly routes to update page for existing notes
    navigate(targetPath, {
      state: {
        resumeDraft: true,
        draftId: draft.id,
        draftTitle: draft.title,
        draftContent: draft.content,
        draftAttachments: draft.attachments || [],
      },
    });
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 sm:px-6">
      <ToastContainer />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-medium text-gray-500">Unsaved work</p>
            <h1 className="text-2xl font-semibold text-gray-950">Drafts</h1>
          </div>
          {drafts.length > 0 && (
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-red-50 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-100 hover:text-red-700"
              onClick={() => setDeleteId("all")}
              aria-label="Discard all drafts"
            >
              Discard all
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600 shadow-sm">
            Loading draft...
          </div>
        ) : drafts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-gray-950">Clean slate</h2>
            <p className="mt-1 text-sm text-gray-500">
              No unsaved notes found. You're all caught up!
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <IoAdd size={20} />
              New note
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {drafts.map((d, index) => (
              <div
                key={d.id || index}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Last edited{" "}
                    {d.updatedAt
                      ? dateFormat(d.updatedAt, "h:MM TT")
                      : "Just now"}
                  </span>
                  {d.attachments?.length > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 ring-1 ring-indigo-100">
                      <IoDocumentAttachOutline size={12} />
                      {d.attachments.length}
                    </span>
                  )}
                </div>
                {d.title && (
                  <h3 className="mb-2 truncate text-base font-bold text-slate-800">
                    {d.title}
                  </h3>
                )}
                <div className="max-h-40 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                  <p className="whitespace-pre-wrap break-words">{d.content}</p>
                </div>
                {d.attachments?.length > 0 && (
                  <div className="mt-4">
                    <AttachmentList
                      attachments={d.attachments}
                      compact
                      readOnly
                    />
                  </div>
                )}
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    onClick={() => setDeleteId(d.id)}
                  >
                    <MdDeleteOutline size={20} />
                    Discard
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700"
                    onClick={() => resumeDraft(d)}
                  >
                    <IoCreateOutline size={20} />
                    Continue writing
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">
              Discard changes?
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              This will permanently delete your unsaved work. This action cannot
              be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                onClick={handleDeleteDraft}
                disabled={isDeleting}
              >
                {isDeleting ? "Discarding..." : "Discard Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
