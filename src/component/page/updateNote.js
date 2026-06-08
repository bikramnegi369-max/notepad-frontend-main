import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Api_Url from "../api/api";
import { IoChevronBackOutline, IoSaveOutline } from "react-icons/io5";

export default function UpdateNote() {
  const [updateNotedata, setUpdateNotedata] = useState({});
  const [isSaving, setIsSaving] = useState(false);
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
    setUpdateNotedata({ ...updateNotedata, [name]: value });
    console.log(name, value);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const note = updateNotedata;
      if (!note?.content || !note.content.trim()) {
        toast.error("Content cannot be empty");
        setIsSaving(false);
        return;
      }
      const response = await Api_Url.put(`updatenote/${id}`, note, {
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
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 sm:px-6">
      <ToastContainer />
      <div className="mx-auto flex min-h-[75vh] w-full max-w-5xl flex-col rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-gray-200 bg-white/80 px-4 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <IoChevronBackOutline size={20} />
            </button>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Editing Note
              </p>
              <h1 className="text-xl font-bold text-gray-950">Update Note</h1>
            </div>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-700 active:scale-95 sm:h-11 disabled:opacity-60"
            onClick={handleSave}
            disabled={isSaving}
          >
            <IoSaveOutline size={18} />
            {isSaving ? "Saving..." : "Update Changes"}
          </button>
        </div>

        <div className="flex-1 px-4 py-6 sm:px-10">
          <textarea
            className="min-h-[50vh] w-full flex-1 resize-none border-none bg-transparent p-0 text-base leading-7 text-gray-950 outline-none transition placeholder:text-gray-400 sm:min-h-[60vh] sm:text-lg"
            placeholder="Start typing your thoughts..."
            onChange={handleChange}
            name="content"
            value={updateNotedata.content || ""}
          />
        </div>
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-3">
          <p className="text-xs text-gray-400">
            All changes are strictly saved to the server upon clicking Update.
          </p>
        </div>
      </div>
    </div>
  );
}
