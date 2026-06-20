import { useCallback, useEffect, useState } from "react";
import { CiEdit } from "react-icons/ci";
import Api_Url from "../api/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ViewNotes from "./ViewNotes";
import { Link } from "react-router-dom";
import useAuth from "../../contexts/Auth";
import { useNavigate } from "react-router-dom";
import {
  IoAdd,
  IoSearch,
  IoDocumentTextOutline,
  IoCloseCircle,
  IoRefreshOutline,
} from "react-icons/io5";

export default function Allnotes() {
  const [allNotes, setAllNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(""); // New state for date filter
  const { logout } = useAuth();
  const navigate = useNavigate();

  const fetchNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (selectedDate) {
        params.append("date", selectedDate);
        // params.append("timezoneOffset", new Date().getTimezoneOffset());
      }

      const response = await Api_Url.get(`getNotes?${params.toString()}`);
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
  }, [searchTerm, selectedDate, logout, navigate]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      fetchNotes();
    }, 400); // Debounce all inputs for a smoother experience

    return () => clearTimeout(timeoutId);
  }, [fetchNotes]);

  const truncateContent = (content = "", wordLimit) => {
    const words = content.trim().split(/\s+/).filter(Boolean);
    return words.length > wordLimit
      ? `${words.slice(0, wordLimit).join(" ")} ...`
      : content;
  };

  const attachmentCount = (note) => {
    return note?.attachments?.length || 0;
  };

  const handleSearch = async (e) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedDate("");
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const hasActiveFilters = searchTerm || selectedDate;

  // const isCurrentDate = (noteDate) => {
  //   const today = dateFormat(new Date(), "yyyy-mm-dd");
  //   const noteCreationDate = dateFormat(noteDate, "yyyy-mm-dd");
  //   return today === noteCreationDate;
  // };
  
  const isCurrentDate = (noteDate) => {
  const todayInNY = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());

  const noteDateInNY = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date(noteDate));

  return todayInNY === noteDateInNY;
};

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 pb-24 px-4 py-6 sm:px-6">
      <ToastContainer />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5 lg:p-6">
          <div>
            <p className="text-sm font-medium text-gray-500">Workspace</p>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-950 sm:text-2xl">
                All Notes
              </h1>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                >
                  <IoRefreshOutline size={12} />
                  Reset
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <IoSearch
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                size={18}
              />
              <input
                type="search"
                className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm text-gray-950 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-500/10 sm:w-72"
                placeholder="Search notes"
                value={searchTerm}
                onChange={handleSearch}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                >
                  <IoCloseCircle size={18} />
                </button>
              )}
            </div>
            <div className="relative flex-1 sm:w-48">
              <input
                type="date"
                className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-950 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-500/10"
                value={selectedDate}
                onChange={handleDateChange}
                aria-label="Filter by date"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                >
                  <IoCloseCircle size={18} />
                </button>
              )}
            </div>
            <Link
              to="/"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-green-600 px-3 sm:px-4 text-sm font-semibold text-white shadow-sm shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg active:scale-95 sm:w-auto"
            >
              <IoAdd size={20} />
              <span className="hidden sm:inline">New note</span>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-600 shadow-sm">
            Loading notes...
          </div>
        ) : allNotes?.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-gray-950">
              No notes found
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasActiveFilters
                ? "Try adjusting your search or filters."
                : "Create your first note to see it here."}
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-green-600 px-6 text-sm font-bold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg active:scale-95"
            >
              <IoAdd size={20} />
              Add note
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2 bg-white rounded-2xl border border-gray-200 p-2 shadow-sm">
            {/* Table Header for Desktop */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <div className="col-span-7 lg:col-span-8">Note Details</div>
              <div className="col-span-2 text-center">Date Created</div>
              <div className="col-span-1 text-center">Attachments</div>
              <div className="col-span-2 lg:col-span-1 text-right">Actions</div>
            </div>

            {/* Note Rows */}
            <div className="flex flex-col gap-1.5">
              {allNotes?.map((note) => (
                <div
                  key={note?._id}
                  className="group grid grid-cols-1 md:grid-cols-12 items-center gap-3 md:gap-4 rounded-xl border border-transparent hover:border-green-100 hover:bg-green-50/20 p-2.5 transition-all duration-200 md:px-6"
                >
                  {/* Title & Preview column */}
                  <div className="col-span-1 md:col-span-7 lg:col-span-8 flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 transition-colors group-hover:bg-green-100">
                      <IoDocumentTextOutline size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-800 group-hover:text-green-700 transition-colors">
                          {note?.title || "Untitled Note"}
                        </h3>
                        {/* Mobile attachment badge */}
                        {attachmentCount(note) > 0 && (
                          <span className="inline-flex md:hidden items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            <IoDocumentTextOutline size={10} />
                            {attachmentCount(note)}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-400 mt-0.5">
                        {truncateContent(note?.content || "Empty note", 12)}
                      </p>
                    </div>
                  </div>

                  {/* Date Created column */}
                  <div className="col-span-1 md:col-span-2 flex items-center md:justify-center text-xs text-slate-500 md:text-slate-600 font-medium">
                    <span className="md:hidden text-slate-400 mr-1.5">Created:</span>
                    {note?.createdAt
                      // ? dateFormat(note.createdAt, "dd mmm yyyy")
                      ? new Intl.DateTimeFormat("en-US", {
                        timeZone: "America/New_York",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(note?.createdAt))
                      : "No date"}
                  </div>

                  {/* Attachments column (desktop) */}
                  <div className="hidden md:flex md:col-span-1 justify-center">
                    {attachmentCount(note) > 0 ? (
                      <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 border border-slate-100">
                        <IoDocumentTextOutline size={12} className="text-slate-500" />
                        <span>{attachmentCount(note)}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </div>

                  {/* Actions column */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-1 flex items-center justify-end gap-1.5 border-t border-slate-50 pt-2.5 md:border-t-0 md:pt-0">
                    <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5 border border-slate-100 group-hover:bg-white transition-colors">
                      <ViewNotes id={note?._id} />
                      {isCurrentDate(note?.createdAt) ? (
                        <Link
                          to={`/update/${note?._id}`}
                          className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-all hover:bg-slate-100 hover:text-green-600"
                          aria-label="Edit note"
                        >
                          <CiEdit size={20} />
                        </Link>
                      ) : (
                        <div className="w-9 h-9" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button for Mobile */}
      <Link
        to="/"
        className="fixed bottom-8 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/30 transition-transform active:scale-90 sm:hidden z-30"
        aria-label="Create new note"
      >
        <IoAdd size={32} />
      </Link>
    </div>
  );
}
