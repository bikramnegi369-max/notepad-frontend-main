import { useCallback, useEffect, useState } from "react";
import { CiEdit } from "react-icons/ci";
import { MdDeleteOutline } from "react-icons/md";
import Api_Url from "../api/api";
import dateFormat from "dateformat";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ViewNotes from "./ViewNotes";
import { Link } from "react-router-dom";
import useAuth from "../../contexts/Auth";
import { useNavigate } from "react-router-dom";
import { IoAdd, IoSearch, IoDocumentTextOutline } from "react-icons/io5";

export default function Allnotes() {
  const [allNotes, setAllNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  // axios will include auth token via setAuthToken in `AuthProvider`

  const getAllNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await Api_Url.get("getNotes");
      setAllNotes(response.data.data || []);
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        logout();
        navigate("/login");
        return;
      }
      toast.error("Failed to load notes.");
    } finally {
      setIsLoading(false);
    }
  }, [logout, navigate]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      getAllNotes();
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsLoading(true);
        const response = await Api_Url.get(
          `search/${encodeURIComponent(searchTerm.trim())}`,
        );
        setAllNotes(response.data.data || []);
      } catch (error) {
        toast.error("Failed to search notes.");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [getAllNotes, searchTerm]);

  const handleDelete = async (id) => {
    if (!id || isDeleting) return;

    try {
      setIsDeleting(true);
      const response = await Api_Url.delete(`deletenote/${id}`);
      if (response.data.status === "success") {
        toast.success(response.data.message);
        setDeleteId(null);
        getAllNotes();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        logout();
        navigate("/login");
        return;
      }
      toast.error("Failed to delete note.");
    } finally {
      setIsDeleting(false);
    }
  };

  const truncateContent = (content = "", wordLimit) => {
    const words = content.trim().split(/\s+/).filter(Boolean);
    return words.length > wordLimit
      ? `${words.slice(0, wordLimit).join(" ")} ...`
      : content;
  };

  const attachmentCount = (note) => {
    const raw = note?.attachments || note?.attachment || [];
    if (!raw) return 0;
    return Array.isArray(raw) ? raw.filter(Boolean).length : 1;
  };

  const handleSearch = async (e) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 sm:px-6">
      <ToastContainer />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-medium text-gray-500">Workspace</p>
            <h1 className="text-2xl font-semibold text-gray-950">All Notes</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <IoSearch
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                size={18}
              />
              <input
                type="search"
                className="min-h-11 w-full rounded-lg border border-gray-300 bg-gray-50 pl-10 pr-3 text-sm text-gray-950 outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:bg-white focus:ring-2 focus:ring-gray-200 sm:w-72"
                placeholder="Search notes"
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <IoAdd size={20} />
              New note
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600 shadow-sm">
            Loading notes...
          </div>
        ) : allNotes?.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-gray-950">
              No notes found
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm
                ? "Try a different search term."
                : "Create your first note to see it here."}
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <IoAdd size={20} />
              Add note
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {allNotes?.map((note) => (
              <div
                key={note?._id}
                className="flex min-h-48 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {note?.createdAt
                      ? dateFormat(note.createdAt, "dd mmm yyyy")
                      : "No date"}
                  </p>
                  <div className="flex items-center gap-2">
                    {attachmentCount(note) > 0 && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        <IoDocumentTextOutline size={14} />
                        <span>{attachmentCount(note)}</span>
                      </div>
                    )}
                    <ViewNotes id={note?._id} />
                  </div>
                </div>
                <p className="mt-3 line-clamp-5 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">
                  {truncateContent(note?.content || "Empty note", 32)}
                </p>
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                  <Link
                    to={`/update/${note?._id}`}
                    className="grid h-10 w-10 place-items-center rounded-full text-gray-700 transition hover:bg-gray-100"
                    aria-label="Edit note"
                  >
                    <CiEdit size={22} />
                  </Link>
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-full text-red-700 transition hover:bg-red-50"
                    onClick={() => setDeleteId(note?._id)}
                    aria-label="Delete note"
                  >
                    <MdDeleteOutline size={22} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteId && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-3 sm:items-center"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-950">
              Delete note?
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              This action cannot be undone.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-100"
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
                onClick={() => handleDelete(deleteId)}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
