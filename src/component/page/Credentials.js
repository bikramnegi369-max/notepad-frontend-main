import { useCallback, useEffect, useRef, useState } from "react";
import Api_Url from "../api/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import {
  appendAttachmentsToFormData,
  validateFiles,
  getAttachmentIdentity,
} from "../util/attachments";
import {
  IoAttach,
  IoChevronBack,
  IoCloudDoneOutline,
  IoCloudOfflineOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import AttachmentList from "../common/AttachmentList";

export default function Credentials() {
  const navigate = useNavigate();
  const [noteId, setNoteId] = useState(null);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [originalAttachments, setOriginalAttachments] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  const hasUserEditedRef = useRef(false);
  const isInitialMount = useRef(true);

  // 1. Fetch the existing Credentials note on mount
  const CREDENTIALS_LOCAL_STORAGE_KEY = "credentials_draft";

  const saveLocalCredentials = useCallback((data, unsynced = true) => {
    try {
      const dataToStore = {
        ...data,
        isUnsynced: unsynced,
        lastModified: new Date().toISOString(),
      };
      localStorage.setItem(
        CREDENTIALS_LOCAL_STORAGE_KEY,
        JSON.stringify(dataToStore),
      );
    } catch (e) {
      console.error("Failed to save credentials to local storage:", e);
    }
  }, []);

  const loadLocalCredentials = useCallback(() => {
    try {
      const stored = localStorage.getItem(CREDENTIALS_LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error("Failed to load credentials from local storage:", e);
      return null;
    }
  }, []);

  const fetchCredentials = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsOffline(false); // Assume online initially

      const localData = loadLocalCredentials();
      let apiData = null;
      let apiFetchError = false;

      try {
        const response = await Api_Url.get("getcredentialnote");
        apiData = response.data.data;
      } catch (error) {
        apiFetchError = true;
        console.error("Failed to fetch credentials from API:", error);
        setIsOffline(true);
        toast.warn(
          "Working offline. Changes will sync when connection is restored.",
        );
      }

      if (localData && localData.isUnsynced) {
        // Local changes exist and haven't been synced, prioritize them
        setNoteId(localData._id || null);
        setContent(localData.content || "");
        setAttachments(localData.attachments || []);
        setOriginalAttachments(localData.attachments || []);
        toast.info("Restored unsynced local changes.");
      } else if (apiData) {
        // API data is available and no unsynced local changes, use API data
        setNoteId(apiData._id);
        setContent(apiData.content || "");
        const normalizedAtts = Array.isArray(apiData.attachments)
          ? apiData.attachments
          : apiData.attachment
            ? [apiData.attachment]
            : [];
        setAttachments(normalizedAtts);
        setOriginalAttachments(normalizedAtts);
        saveLocalCredentials(
          { ...apiData, attachments: normalizedAtts },
          false,
        ); // Save API data locally, marked as synced
      } else if (localData) {
        // API failed, but local data exists (and was synced or no API data existed before)
        setNoteId(localData._id || null);
        setContent(localData.content || "");
        setAttachments(localData.attachments || []);
        setOriginalAttachments(localData.attachments || []);
      }
    } catch (error) {
      console.error("Failed to load credentials:", error);
      toast.error("Failed to load credentials. Please check your connection.");
    } finally {
      setIsLoading(false);
      isInitialMount.current = false;
    }
  }, []);
  // Removed fetchCredentials from useEffect dependencies to prevent infinite loop
  // It's called once on mount.
  useEffect(() => {
    fetchCredentials();
  }, []);

  // 2. Persistent Auto-save Logic
  const persistChanges = useCallback(async () => {
    if (!hasUserEditedRef.current) return;

    // Save to local storage immediately
    saveLocalCredentials({ _id: noteId, content, attachments });

    try {
      setIsSaving(true);
      setSaveError(false);
      const formData = new FormData();
      formData.append("content", content || " "); // Ensure content isn't empty for API

      if (noteId) {
        formData.append("id", noteId);
      }

      appendAttachmentsToFormData(formData, attachments);

      // Handle removals if updating
      if (noteId) {
        const removedIds = originalAttachments
          .filter(
            (orig) =>
              !attachments.some(
                (curr) =>
                  getAttachmentIdentity(curr) === getAttachmentIdentity(orig),
              ),
          )
          .map((att) => getAttachmentIdentity(att))
          .filter(Boolean);

        if (removedIds.length > 0) {
          formData.append("removedAttachmentIds", JSON.stringify(removedIds));
        }
      }

      const response = await Api_Url.post("addcredentialnotes", formData);
      if (response.data?.status === "success" && !noteId) {
        setNoteId(response.data.data?._id || null);
      }

      saveLocalCredentials({ _id: noteId, content, attachments }, false); // Mark as synced
      setLastSynced(new Date());
      hasUserEditedRef.current = false;
    } catch (error) {
      setSaveError(true);
      toast.error("Auto-save failed. Please check your internet connection.");
      console.error("Auto-save failed:", error);
    } finally {
      setIsSaving(false);
    }
  }, [noteId, content, attachments, originalAttachments]);

  useEffect(() => {
    if (isInitialMount.current) return; // Don't auto-save on initial mount

    const timeoutId = setTimeout(() => {
      persistChanges();
    }, 2000); // Debounce for 2 seconds

    return () => clearTimeout(timeoutId);
  }, [content, attachments, persistChanges]);

  // 3. Event Handlers
  const handleContentChange = (e) => {
    hasUserEditedRef.current = true;
    saveLocalCredentials({ _id: noteId, content: e.target.value, attachments }); // Save to local storage on every change
    setContent(e.target.value);
  };

  const handleAttachmentChange = (e) => {
    // Note: Actual file objects cannot be stored in localStorage. Only metadata will persist.
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validationError = validateFiles(files, attachments.length);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    hasUserEditedRef.current = true;
    const newAttachments = [...attachments, ...files];
    setAttachments(newAttachments);
    saveLocalCredentials({ _id: noteId, content, attachments: newAttachments });
    e.target.value = "";
  };

  const removeAttachment = (index) => {
    hasUserEditedRef.current = true;
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
    saveLocalCredentials({ _id: noteId, content, attachments: newAttachments });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600 mx-auto mb-4"></div>
          <p className="text-sm font-medium text-slate-500">
            Accessing Vault...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white sm:bg-slate-50/50 px-0 py-0 sm:px-6 sm:py-10">
      <ToastContainer />
      <div className="mx-auto flex min-h-screen sm:min-h-[90vh] w-full max-w-4xl flex-col sm:rounded-3xl sm:border border-slate-200 bg-slate-50 sm:shadow-2xl sm:shadow-slate-200/60 transition-all duration-300">
        {/* Header Section */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur-xl sm:rounded-t-3xl sm:px-8 sm:py-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors sm:hidden"
            >
              <IoChevronBack size={24} className="text-gray-500" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
                <IoShieldCheckmarkOutline size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest leading-none">
                  Secure Vault
                </p>
                <h1 className="text-lg font-black text-slate-900 tracking-tight">
                  Credentials
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">
              {isSaving ? (
                <span className="flex items-center gap-1.5 text-indigo-600">
                  <span className="h-1 w-1 animate-ping rounded-full bg-indigo-600"></span>
                  Syncing...
                </span>
              ) : isOffline ? (
                <span className="flex items-center gap-1 text-orange-500">
                  <IoCloudOfflineOutline size={14} /> Working Offline
                </span>
              ) : saveError ? (
                <span className="flex items-center gap-1 text-red-500">
                  <IoCloudOfflineOutline size={14} />
                  Sync Failed
                </span>
              ) : lastSynced ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <IoCloudDoneOutline size={14} />
                  Last saved{" "}
                  {lastSynced.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : (
                "Vault Ready"
              )}
            </p>
          </div>
        </div>

        {/* Editor Section */}
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
          {/* Content Area */}
          <div className="group flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/5 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-indigo-600">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 group-focus-within:bg-indigo-500"></span>
                Protected Content
              </span>
              <span className="text-[10px] font-bold text-slate-300 tabular-nums">
                {content.length} characters
              </span>
            </div>

            <textarea
              className="min-h-[50vh] w-full flex-1 resize-none border-none bg-transparent p-0 text-lg font-medium leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-200 focus:ring-0 sm:text-xl font-mono"
              placeholder="Store your sensitive information here. It saves automatically as you type..."
              value={content}
              onChange={handleContentChange}
            />

            {attachments.length > 0 && (
              <div className="mt-10 border-t border-slate-100 pt-8">
                <AttachmentList
                  attachments={attachments}
                  onRemove={removeAttachment}
                />
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-50 pt-8 sm:flex-row">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <IoShieldCheckmarkOutline
                  size={14}
                  className="text-indigo-500"
                />
                Encrypted storage enabled
              </div>

              <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:border-indigo-200 hover:bg-slate-50 active:scale-95">
                <IoAttach size={20} />
                Secure Attachments
                {attachments.length > 0 && (
                  <span className="ml-1 rounded-md bg-indigo-600 px-1.5 py-0.5 text-[9px] text-white">
                    {attachments.length}
                  </span>
                )}
                <input
                  className="hidden"
                  type="file"
                  multiple
                  onChange={handleAttachmentChange}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
