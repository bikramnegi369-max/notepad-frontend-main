import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Api_Url from "../api/api";
import {
  createDraftId,
  isLocalDraftId,
  loadLocalDrafts,
  normalizeServerDrafts,
  removeLocalDraftsForNote,
  replaceLocalDraftId,
  upsertLocalDraft,
} from "../util/drafts";
import {
  validateFiles,
  attachmentsToDraftReferences,
  filesToStoredAttachments,
  restoreDraftAttachments,
  appendAttachmentsToFormData,
  getAttachmentIdentity,
} from "../util/attachments";
import {
  IoChevronBackOutline,
  IoSaveOutline,
  IoCloudDoneOutline,
  IoAttach,
} from "react-icons/io5";
import AttachmentList from "../common/AttachmentList";

const EMPTY_BASELINE = { title: "", content: "", attachments: [] };

function getAttachmentSignature(attachments) {
  return (attachments || []).map(getAttachmentIdentity).join("|");
}

export default function UpdateNote() {
  const [updateNotedata, setUpdateNotedata] = useState({});
  const [savedBaseline, setSavedBaseline] = useState(EMPTY_BASELINE);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [originalAttachments, setOriginalAttachments] = useState([]);
  const draftIdRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [titleError, setTitleError] = useState("");
  const [contentError, setContentError] = useState("");
  const hasUserEditedRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  const hasUnsavedChanges = useMemo(() => {
    return (
      (updateNotedata.title || "") !== (savedBaseline.title || "") ||
      (updateNotedata.content || "") !== (savedBaseline.content || "") ||
      getAttachmentSignature(attachments) !==
        getAttachmentSignature(savedBaseline.attachments)
    );
  }, [attachments, savedBaseline, updateNotedata]);

  useEffect(() => {
    hasUserEditedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  const fetchNoteData = useCallback(async () => {
    try {
      const response = await Api_Url.get(`viewnote/${id}`);
      const serverData = response.data.data;

      const initialAttachments =
        serverData?.attachments || serverData?.attachment || [];
      const normalizedAttachments = Array.isArray(initialAttachments)
        ? initialAttachments
        : initialAttachments
          ? [initialAttachments]
          : [];
      setOriginalAttachments(normalizedAttachments);
      setSavedBaseline({
        title: serverData?.title || "",
        content: serverData?.content || "",
        attachments: normalizedAttachments,
      });

      const localDraft = loadLocalDrafts().find(
        (draft) =>
          draft.noteId === id ||
          (location.state?.draftId && draft.id === location.state.draftId),
      );

      let serverDraft = null;
      try {
        const draftRes = await Api_Url.get("draft");
        serverDraft = normalizeServerDrafts(draftRes.data.data).find(
          (draft) =>
            draft.noteId === id ||
            (location.state?.draftId && draft.id === location.state.draftId),
        );
      } catch (error) {
        console.error("Failed to fetch server drafts:", error);
      }

      // Check for attachments passed via location.state
      const resumedDraftAttachments = location.state?.draftAttachments;

      if (localDraft) {
        setUpdateNotedata({
          title: localDraft.title,
          content: localDraft.content,
        });
        setDraftId(localDraft.id);
        if (localDraft.attachments) {
          setAttachments(restoreDraftAttachments(localDraft.attachments));
        }
        draftIdRef.current = localDraft.id;
        hasUserEditedRef.current = true;
        toast.info("Restored unsaved changes");
      } else if (serverDraft) {
        setUpdateNotedata({
          title: serverDraft.title ?? serverData.title ?? "",
          content: serverDraft.content ?? serverData.content ?? "",
        });
        setDraftId(serverDraft.id);
        if (serverDraft.attachments) {
          setAttachments(restoreDraftAttachments(serverDraft.attachments));
        }
        draftIdRef.current = serverDraft.id;
        hasUserEditedRef.current = true;
        toast.info("Restored changes from cloud.");
      } else if (resumedDraftAttachments) {
        setAttachments(restoreDraftAttachments(resumedDraftAttachments));
        setUpdateNotedata({
          title: location.state?.draftTitle || serverData?.title || "",
          content: location.state?.draftContent || serverData?.content || "",
        });
        setDraftId(location.state?.draftId);
        draftIdRef.current = location.state?.draftId;
        hasUserEditedRef.current = true;
        toast.info("Restored unsaved changes from draft.");
      } else {
        setUpdateNotedata({
          title: serverData?.title || "",
          content: serverData?.content || "",
        });
        setAttachments(normalizedAttachments);
      }
    } catch (error) {
      toast.error("Failed to fetch the note data.");
      console.error("Fetch error:", error);
    }
  }, [
    id,
    location.state?.draftId,
    location.state?.draftAttachments,
    location.state?.draftTitle,
    location.state?.draftContent,
  ]);

  useEffect(() => {
    if (id) {
      fetchNoteData();
    }
  }, [id, fetchNoteData]);

  // Alert on tab change / page close if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUserEditedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (!hasUserEditedRef.current || !id) return;

    const timeoutId = setTimeout(async () => {
      setIsDraftSaving(true);
      try {
        const isContentEmpty =
          !updateNotedata.title?.trim() &&
          !updateNotedata.content?.trim() &&
          attachments.length === 0;

        if (isContentEmpty) {
          if (draftIdRef.current) {
            removeLocalDraftsForNote(id);
            if (!isLocalDraftId(draftIdRef.current)) {
              await Api_Url.delete(`draft/${draftIdRef.current}`);
              window.dispatchEvent(new Event("draftsUpdated"));
            }
            setDraftId(null);
          }
        } else {
          const currentDraftId = draftIdRef.current || createDraftId();
          const stored = await filesToStoredAttachments(attachments);
          const attachmentsData = attachmentsToDraftReferences(stored);
          upsertLocalDraft({
            id: currentDraftId,
            noteId: id,
            title: updateNotedata.title || "",
            content: updateNotedata.content || "",
            updatedAt: new Date().toISOString(),
            attachments: attachmentsData,
          });
          setDraftId(currentDraftId);

          const formData = new FormData();
          formData.append("title", updateNotedata.title || "");
          formData.append("content", updateNotedata.content || "");
          if (!isLocalDraftId(currentDraftId)) {
            formData.append("id", currentDraftId);
          }
          formData.append("noteId", id);

          appendAttachmentsToFormData(formData, attachments);

          const response = await Api_Url.post("draft", formData);
          if (response.data?.data?._id && isLocalDraftId(currentDraftId)) {
            const serverId = response.data.data._id;
            setDraftId(serverId);
            draftIdRef.current = serverId;
            replaceLocalDraftId(currentDraftId, serverId);
            window.dispatchEvent(new Event("draftsUpdated"));
          }
        }
      } catch (e) {
        console.error("Draft save failed", e);
        toast.error("Unable to sync draft to server.");
      } finally {
        setTimeout(() => setIsDraftSaving(false), 500);
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [updateNotedata, id, attachments]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    hasUserEditedRef.current = true;
    setUpdateNotedata((prevData) => ({ ...prevData, [name]: value }));
    if (name === "title") {
      setTitleError("");
    } else if (name === "content") {
      setContentError("");
    }
  };

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      return;
    }
    const validationError = validateFiles(files, attachments.length);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    hasUserEditedRef.current = true;
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachment = (indexToRemove) => {
    hasUserEditedRef.current = true;
    setAttachments((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleSave = async () => {
    if (isSaving) return;

    let isValid = true;
    if (updateNotedata.title?.length > 100) {
      setTitleError("Title is too long (max 100 characters)");
      isValid = false;
    }

    if (!updateNotedata.content || updateNotedata.content.trim() === "") {
      setContentError("Content cannot be empty");
      isValid = false;
    }

    if (!isValid) return;

    // Determine removed attachments
    const removedAttachmentIds = originalAttachments
      .filter(
        (originalAtt) =>
          !attachments.some(
            (att) =>
              getAttachmentIdentity(att) === getAttachmentIdentity(originalAtt),
          ),
      )
      .map((att) => getAttachmentIdentity(att))
      .filter(Boolean);

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", updateNotedata.title || "");
      formData.append("content", updateNotedata.content || "");

      appendAttachmentsToFormData(formData, attachments);
      if (removedAttachmentIds.length > 0) {
        formData.append(
          "removedAttachmentIds",
          JSON.stringify(removedAttachmentIds),
        );
      }

      const response = await Api_Url.put(`updatenote/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data?.status === "success") {
        toast.success(response.data.message || "Note updated.");
        removeLocalDraftsForNote(id);

        if (draftId && !isLocalDraftId(draftId)) {
          await Api_Url.delete(`draft/${draftId}`);
          setDraftId(null);
        }

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
            <button
              onClick={() => navigate(-1)}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <IoChevronBackOutline size={24} className="text-gray-500" />
            </button>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Editing Note
              </p>
              <h1 className="text-lg font-bold text-gray-950 hidden sm:block">
                Update Note
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {hasUnsavedChanges && (
              <span
                className="hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700 sm:inline-flex"
                role="status"
                aria-live="polite"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.14)]"></span>
                Unsaved
              </span>
            )}
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 sm:min-w-24 sm:text-right"
              role="status"
            >
              {isDraftSaving ? (
                <span className="flex items-center justify-end gap-1.5 text-indigo-500">
                  <span className="h-1 w-1 animate-ping rounded-full bg-indigo-500"></span>
                  Saving
                </span>
              ) : hasUnsavedChanges ? (
                <span className="flex items-center justify-end gap-1 text-slate-400">
                  <IoCloudDoneOutline size={14} />
                  Draft synced
                </span>
              ) : null}
            </span>

            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    removeLocalDraftsForNote(id);
                    if (draftId && !isLocalDraftId(draftId)) {
                      await Api_Url.delete(`draft/${draftId}`);
                    }

                    const response = await Api_Url.get(`viewnote/${id}`);
                    const serverData = response.data.data;

                    setUpdateNotedata({
                      title: serverData?.title || "",
                      content: serverData?.content || "",
                    });

                    const initialAttachments =
                      serverData?.attachments || serverData?.attachment || [];
                    const restoredAttachments = Array.isArray(
                      initialAttachments,
                    )
                      ? initialAttachments
                      : initialAttachments
                        ? [initialAttachments]
                        : [];
                    setAttachments(restoredAttachments);
                    setOriginalAttachments(restoredAttachments);
                    setSavedBaseline({
                      title: serverData?.title || "",
                      content: serverData?.content || "",
                      attachments: restoredAttachments,
                    });

                    setDraftId(null);
                    hasUserEditedRef.current = false;
                    window.dispatchEvent(new Event("draftsUpdated"));
                    toast.info(
                      "Unsaved changes discarded. Restored original content.",
                    );
                  } catch (error) {
                    toast.error("Failed to restore original content.");
                  }
                }}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-red-600 active:scale-95 sm:h-10"
              >
                Discard
              </button>
            )}

            <button
              className={`relative inline-flex h-9 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-lg transition-all active:scale-95 sm:h-10 ${
                isSaving || !hasUnsavedChanges
                  ? "cursor-not-allowed bg-slate-200 shadow-none"
                  : "bg-slate-900 ring-4 ring-amber-400/10 hover:bg-slate-800 hover:shadow-slate-200"
              }`}
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
            >
              {hasUnsavedChanges && !isSaving && (
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-500"></span>
              )}
              <IoSaveOutline size={18} />
              {isSaving ? "Saving..." : "Update Changes"}
            </button>
          </div>
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

            {attachments.length > 0 && (
              <div className="mt-10 border-t border-slate-100 pt-8">
                <AttachmentList
                  attachments={attachments}
                  onRemove={removeAttachment}
                />
              </div>
            )}

            <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-50 pt-8 sm:flex-row">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                <IoCloudDoneOutline size={14} />
                Auto-synced to cloud
              </div>
              <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:border-indigo-200 hover:bg-slate-50 active:scale-95">
                <IoAttach size={18} />
                Attach Files
                {attachments.length > 0 && (
                  <span className="ml-1 rounded-md bg-slate-900 px-1.5 py-0.5 text-[9px] text-white">
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
