import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Api_Url from "../api/api";
import { IoChevronBackOutline, IoSaveOutline } from "react-icons/io5";

export default function UpdateNote() {
  const [updateNotedata, setUpdateNotedata] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [contentError, setContentError] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const response = await Api_Url.get(`viewnote/${id}`);
        setUpdateNotedata(response.data.data);
      } catch (error) {
        toast.error("Failed to fetch the note data.");
      }
    };

    if (id) {
      fetchNote();
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUpdateNotedata((prevData) => ({ ...prevData, [name]: value }));
    if (name === "title") {
      setTitleError("");
    } else if (name === "content") {
      setContentError("");
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    let isValid = true;
    if (!updateNotedata.title || updateNotedata.title.trim() === "") {
      setTitleError("Title cannot be empty");
      isValid = false;
    } else if (updateNotedata.title.length > 100) {
      setTitleError("Title is too long (max 100 characters)");
      isValid = false;
    }

    if (!updateNotedata.content || updateNotedata.content.trim() === "") {
      setContentError("Content cannot be empty");
      isValid = false;
    }

    if (!isValid) return;

    setIsSaving(true);
    try {
      const response = await Api_Url.put(`updatenote/${id}`, updateNotedata, {
        headers: { "Content-Type": "application/json" },
      });
      if (response.data?.status === "success") {
        toast.success(response.data.message || "Note updated.");
        navigate("/allnotes");
      } else {
        toast.error(response.data?.message || "Failed to update note.");
      }
    } catch (error) {
      const message = error.response?.data?.message || "Failed to update note.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white sm:bg-slate-50/50 px-0 py-0 sm:px-6 sm:py-10">
      <ToastContainer />
      <div className="mx-auto flex min-h-screen sm:min-h-[90vh] w-full max-w-4xl flex-col sm:rounded-3xl sm:border border-slate-200 bg-slate-50 sm:shadow-2xl sm:shadow-slate-200/60 transition-all duration-300">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur-xl sm:rounded-t-3xl sm:px-8 sm:py-5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1">
              <IoChevronBackOutline size={24} className="text-gray-500" />
            </button>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Editing Note
              </p>
              <h1 className="text-xl font-bold text-gray-950">Update Note</h1>
            </div>
          </div>
          <button
            className={`inline-flex h-9 min-w-[80px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-lg transition-all active:scale-95 sm:h-10 sm:min-w-[100px] ${
              isSaving
                ? "cursor-not-allowed bg-slate-200 shadow-none"
                : "bg-slate-900 hover:bg-slate-800 hover:shadow-slate-200"
            }`}
            onClick={handleSave}
            disabled={isSaving}
          >
            <IoSaveOutline size={18} />
            {isSaving ? "Saving..." : "Update Changes"}
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
          {/* Panel 1: Title Card */}
          <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/5 sm:p-8">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-indigo-600">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 group-focus-within:bg-indigo-500"></span>
                Document Title
              </span>
              <span
                className={`text-[10px] font-bold tracking-widest ${
                  updateNotedata.title?.length > 90
                    ? "text-red-500"
                    : "text-slate-300"
                }`}
              >
                {updateNotedata.title?.length || 0} / 100
              </span>
            </div>
            <input
              type="text"
              name="title"
              id="note-title"
              placeholder="Give your note a name..."
              className="w-full border-none bg-transparent p-0 text-xl font-bold tracking-tight text-slate-900 outline-none placeholder:text-slate-200 transition-all focus:ring-0 sm:text-2xl"
              value={updateNotedata.title || ""}
              onChange={handleChange}
              maxLength={100}
            />
            {titleError && (
              <p className="mt-2 text-sm text-red-600">{titleError}</p>
            )}
          </div>
          {/* Panel 2: Content Card */}
          <div className="group flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/5 sm:p-8">
            <div className="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-indigo-600">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 group-focus-within:bg-indigo-500"></span>
              Note Body
            </div>
            <textarea
              className="min-h-[40vh] w-full flex-1 resize-none border-none bg-transparent p-0 text-lg font-medium leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-200 focus:ring-0 sm:text-xl"
              placeholder="Start typing your thoughts..."
              onChange={handleChange}
              name="content"
              value={updateNotedata.content || ""}
            />
            {contentError && (
              <p className="mt-2 text-sm text-red-600">{contentError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
