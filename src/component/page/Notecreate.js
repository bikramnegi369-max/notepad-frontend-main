import { useCallback, useEffect, useRef, useState } from "react";
import Api_Url, { setAuthToken } from "../api/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../contexts/Auth";
import {
  createDraftId,
  isLocalDraftId,
  loadLocalDrafts,
  normalizeServerDrafts,
  replaceLocalDraftId,
  saveLocalDrafts,
  upsertLocalDraft,
} from "../util/drafts";
import {
  appendAttachmentsToFormData,
  attachmentsToDraftReferences,
  filesToStoredAttachments,
  validateFiles,
  restoreDraftAttachments,
} from "../util/attachments";
import {
  IoAttach,
  IoClose,
  IoCloudDoneOutline,
  IoSaveOutline,
} from "react-icons/io5";
import AttachmentList from "../common/AttachmentList";

const EMPTY_NOTE = { title: "", content: "" };

export default function Notecreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cookies } = useAuth();
  const [attachments, setAttachments] = useState([]);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [draftId, setDraftId] = useState(location.state?.draftId || null);
  const draftIdRef = useRef(location.state?.draftId || null);
  const savedRef = useRef(false);
  const hasUserEditedRef = useRef(false);

  // Keep ref in sync with state for API calls without triggering re-renders
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  // Extract content if passed from the Draft page directly
  const resumedContent = location.state?.draftContent;
  const resumedDraftId = location.state?.draftId;
  const shouldResumeDraft =
    location.state?.resumeDraft === true || !!resumedContent;

  useEffect(() => {
    // Sync token with axios defaults whenever cookie changes
    setAuthToken(cookies?.token);
  }, [cookies?.token]);

  const validationSchema = Yup.object({
    title: Yup.string().trim().max(100, "Title is too long"),
    content: Yup.string()
      .trim()
      .min(3, "Write something meaningful")
      .required("Content is required"),
  });

  const formik = useFormik({
    initialValues: {
      title: location.state?.draftTitle || "",
      content: resumedContent || "",
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values, { setSubmitting, setErrors, resetForm }) => {
      try {
        const formData = new FormData();
        formData.append("title", values.title);
        formData.append("content", values.content);
        appendAttachmentsToFormData(formData, attachments);

        const response = await Api_Url.post("addnotes", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            // optional: calculate percent
          },
        });

        if (response.data?.status === "success") {
          savedRef.current = true;
          toast.success(response.data.message || "Note saved");

          // Clear specific draft on server if present
          if (draftIdRef.current) {
            try {
              await Api_Url.delete(`draft/${draftIdRef.current}`);
            } catch (e) {
              console.error("Failed to clear server draft", e);
            }
          }

          const remainingDrafts = loadLocalDrafts().filter(
            (item) => item.id !== draftIdRef.current,
          );
          saveLocalDrafts(remainingDrafts);
          setDraftId(null);
          setHasSavedDraft(remainingDrafts.length > 0);
          setAttachments([]);
          resetForm({ values: EMPTY_NOTE });

          navigate("/allnotes");
        } else {
          toast.error(response.data?.message || "Failed to save note");
        }
      } catch (err) {
        const message = err.response?.data?.message || "Failed to save note.";
        toast.error(message);
        setErrors({ api: message });
      } finally {
        setSubmitting(false);
      }
    },
  });
  const setFormikValuesRef = useRef(formik.setValues);

  useEffect(() => {
    setFormikValuesRef.current = formik.setValues;
  }, [formik.setValues]);

  // Handle attachments passed via location.state when resuming a draft
  useEffect(() => {
    if (shouldResumeDraft && location.state?.draftAttachments) {
      setAttachments(restoreDraftAttachments(location.state.draftAttachments));
    }
  }, [shouldResumeDraft, location.state?.draftAttachments]);
  const applyDraftValues = useCallback((draft) => {
    setFormikValuesRef.current({
      title: draft.title || "",
      content: draft.content || "",
    });
    // Restore attachments when applying a draft
    if (draft.attachments) {
      setAttachments(restoreDraftAttachments(draft.attachments));
    } else {
      setAttachments([]); // Clear attachments if the draft has none
    }
    hasUserEditedRef.current = false;
  }, []);

  const hasNoteContent =
    formik.values.content?.trim() !== "" || formik.values.title?.trim() !== "";
  const isSaveDisabled = formik.isSubmitting || !hasNoteContent;

  const syncDraftToStorage = useCallback(async (draft, draftAttachments) => {
    const title = draft?.title?.trim() || "";
    const content = draft?.content?.trim() || "";
    const hasAttachments = draftAttachments && draftAttachments.length > 0;

    if (!content && !title && !hasAttachments) {
      if (!draftIdRef.current) {
        setHasSavedDraft(loadLocalDrafts().length > 0);
        return;
      }
      const nextDrafts = loadLocalDrafts().filter(
        (item) => item.id !== draftIdRef.current,
      );
      saveLocalDrafts(nextDrafts);
      setHasSavedDraft(nextDrafts.length > 0);
      setDraftId(null);
      return nextDrafts;
    }

    const id = draftIdRef.current || createDraftId();
    let attachmentsData = [];
    if (draftAttachments && draftAttachments.length > 0) {
      const stored = await filesToStoredAttachments(draftAttachments);
      attachmentsData = attachmentsToDraftReferences(stored);
    }

    const nextDraft = {
      id,
      title,
      content,
      updatedAt: new Date().toISOString(),
      attachments: attachmentsData,
    };

    upsertLocalDraft(nextDraft);
    setHasSavedDraft(true);
    setDraftId(id);
    return id;
  }, []);

  const saveDraft = useCallback(
    async (values) => {
      const title = values.title?.trim();
      const content = values.content?.trim();
      const currentAttachments = attachments || [];
      const isContentEmpty =
        !content && !title && currentAttachments.length === 0;

      const currentId = await syncDraftToStorage(values, currentAttachments);

      // 2. Sync to Backend (either DELETE or POST/UPSERT)
      try {
        setIsDraftSaving(true);
        if (isContentEmpty) {
          // If draft is empty, delete it from the backend
          if (draftIdRef.current && !isLocalDraftId(draftIdRef.current)) {
            // Only delete if a draftId exists
            await Api_Url.delete(`draft/${draftIdRef.current}`);
            setDraftId(null); // Clear draftId after deletion
          }
        } else {
          // If not empty, save/update to the backend
          const formData = new FormData();
          formData.append("title", title);
          formData.append("content", content);
          if (draftIdRef.current && !isLocalDraftId(draftIdRef.current)) {
            formData.append("id", draftIdRef.current);
          }
          appendAttachmentsToFormData(formData, currentAttachments);
          const response = await Api_Url.post("draft", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          // If a new draft was created on the server (no draftId existed), update draftId state
          if (
            response.data?.data?._id &&
            (!currentId || isLocalDraftId(currentId))
          ) {
            const serverId = response.data.data._id;
            setDraftId(serverId);
            replaceLocalDraftId(currentId, serverId);
          }
        }
      } catch (error) {
        toast.error("Unable to sync draft to server.");
      } finally {
        setTimeout(() => setIsDraftSaving(false), 500);
      }
    },
    // Removed draftId from dependencies to fix the "double request" bug
    [attachments, syncDraftToStorage],
  );

  // Modified useEffect to call saveDraft
  useEffect(() => {
    if (!hasUserEditedRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      saveDraft(formik.values);
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [formik.values, saveDraft, attachments]);

  // Existing useEffect for beforeunload (no changes needed here as it calls syncDraftToStorage directly)

  useEffect(() => {
    if (resumedContent) return; // Already loaded from state

    const storedDrafts = loadLocalDrafts();
    const createDrafts = storedDrafts.filter((draft) => !draft.noteId);
    if (createDrafts.length > 0) {
      setHasSavedDraft(true);
      if (shouldResumeDraft && resumedDraftId) {
        const matched = createDrafts.find(
          (draft) => draft.id === resumedDraftId,
        );
        if (matched) {
          applyDraftValues(matched);
          setDraftId(resumedDraftId);
        }
      }
      return;
    }

    const loadDraft = async () => {
      try {
        const response = await Api_Url.get("draft");
        const normalizedDrafts = normalizeServerDrafts(
          response.data.data,
        ).filter((draft) => !draft.noteId);

        if (normalizedDrafts.length > 0) {
          const drafts = [];
          for (const draft of normalizedDrafts) {
            const id = draft.id || createDraftId();
            const base = {
              id,
              title: draft.title || "",
              content: draft.content,
              updatedAt: draft.updatedAt || new Date().toISOString(),
            };

            if (
              Array.isArray(draft.attachments) &&
              draft.attachments.length > 0
            ) {
              drafts.push({
                ...base,
                attachments: attachmentsToDraftReferences(draft.attachments),
              });
            } else {
              drafts.push(base);
            }
          }

          saveLocalDrafts([
            ...drafts,
            ...loadLocalDrafts().filter((draft) => draft.noteId),
          ]);
          setHasSavedDraft(true);

          if (shouldResumeDraft && resumedDraftId) {
            const matched = drafts.find((item) => item.id === resumedDraftId);
            if (matched) {
              applyDraftValues(matched);
              setDraftId(resumedDraftId);
            }
          }
        } else {
          setHasSavedDraft(loadLocalDrafts().length > 0);
        }
      } catch (error) {
        // remote draft restore failed; local drafts will be used instead
        setHasSavedDraft(loadLocalDrafts().length > 0);
      }
    };
    loadDraft();
  }, [applyDraftValues, resumedContent, resumedDraftId, shouldResumeDraft]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (
        !savedRef.current &&
        (formik.values.content.trim() ||
          formik.values.title.trim() ||
          attachments.length > 0)
      ) {
        // include attachments when syncing on unload
        syncDraftToStorage(
          { title: formik.values.title, content: formik.values.content },
          attachments,
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [
    formik.values.content,
    syncDraftToStorage,
    attachments,
    formik.values.title,
  ]);

  const handleAttachmentChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }
    hasUserEditedRef.current = true;

    const validationError = validateFiles(files, attachments.length);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setAttachments((currentFiles) => {
      return [...currentFiles, ...files];
    });

    event.target.value = "";
  };

  const handleTitleChange = (event) => {
    hasUserEditedRef.current = true;
    formik.handleChange(event);
  };

  const handleContentChange = (event) => {
    hasUserEditedRef.current = true;
    formik.handleChange(event);
  };

  const removeAttachment = (indexToRemove) => {
    hasUserEditedRef.current = true;
    setAttachments((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove),
    );
  };

  return (
    <div className="min-h-screen bg-white sm:bg-slate-50/50 px-0 py-0 sm:px-6 sm:py-10">
      <ToastContainer />
      <form
        onSubmit={formik.handleSubmit}
        className="mx-auto flex min-h-screen sm:min-h-[90vh] w-full max-w-4xl flex-col sm:rounded-3xl sm:border border-slate-200 bg-slate-50 sm:shadow-2xl sm:shadow-slate-200/60 transition-all duration-300"
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur-xl sm:rounded-t-3xl sm:px-8 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
              <h1 className="text-sm font-bold tracking-tight text-slate-800 uppercase">
                New Note
              </h1>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="sm:hidden p-1"
            >
              <IoClose size={24} className="text-gray-500" />
            </button>
            {hasSavedDraft &&
              !shouldResumeDraft &&
              !hasUserEditedRef.current && (
                <Link
                  to="/draft"
                  className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100"
                >
                  View Drafts
                </Link>
              )}
          </div>
          <div className="flex items-center gap-5">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 sm:min-w-24 sm:text-right"
              role="status"
              aria-live="polite"
            >
              {isDraftSaving ? (
                <span className="flex items-center justify-end gap-1.5 text-indigo-500">
                  <span className="h-1 w-1 animate-ping rounded-full bg-indigo-500"></span>{" "}
                  Saving
                </span>
              ) : hasUserEditedRef.current ? (
                <span className="flex items-center justify-end gap-1">
                  <IoCloudDoneOutline size={14} className="text-slate-400" />
                  Synced
                </span>
              ) : (
                ""
              )}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                className={`inline-flex h-9 min-w-[80px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-lg transition-all active:scale-95 sm:h-10 sm:min-w-[100px] ${
                  isSaveDisabled
                    ? "cursor-not-allowed bg-slate-200 shadow-none"
                    : "bg-slate-900 hover:bg-slate-800 hover:shadow-slate-200"
                }`}
                disabled={isSaveDisabled}
              >
                <IoSaveOutline size={18} />
                {formik.isSubmitting ? "Saving" : "Save"}
              </button>
              {hasNoteContent && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await Api_Url.delete(
                        `draft${draftIdRef.current ? `/${draftIdRef.current}` : ""}`,
                      );
                    } catch (e) {}

                    const remainingDrafts = draftIdRef.current
                      ? loadLocalDrafts().filter(
                          (item) => item.id !== draftIdRef.current,
                        )
                      : loadLocalDrafts();
                    saveLocalDrafts(remainingDrafts);
                    setDraftId(null);
                    setHasSavedDraft(remainingDrafts.length > 0);
                    setAttachments([]);
                    hasUserEditedRef.current = false;
                    
                    // Reset the form values to empty
                    formik.resetForm({ values: EMPTY_NOTE });

                    // Clear navigation state to prevent enableReinitialize from restoring old values
                    navigate(location.pathname, { replace: true, state: {} });

                    toast.info("Draft discarded");
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-red-600 sm:w-auto sm:px-4 sm:text-sm sm:font-bold"
                >
                  <IoClose className="sm:hidden" size={20} />
                  <span className="hidden sm:inline">Discard</span>
                </button>
              )}
            </div>
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
                  formik.values.title.length > 90
                    ? "text-red-500"
                    : "text-slate-300"
                }`}
              >
                {formik.values.title.length} / 100
              </span>
            </div>
            <input
              type="text"
              name="title"
              id="note-title"
              placeholder="Give your note a name..."
              className="w-full border-none bg-transparent p-0 text-xl font-bold tracking-tight text-slate-900 outline-none placeholder:text-slate-200 transition-all focus:ring-0 sm:text-2xl"
              value={formik.values.title}
              onChange={handleTitleChange}
            />
          </div>

          {/* Panel 2: Content Card */}
          <div className="group flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/5 sm:p-8">
            <div className="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-indigo-600">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 group-focus-within:bg-indigo-500"></span>
              Note Body
            </div>
            <textarea
              className="min-h-[40vh] w-full flex-1 resize-none border-none bg-transparent p-0 text-lg font-medium leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-200 focus:ring-0 sm:text-xl"
              placeholder="Write your content here..."
              onChange={handleContentChange}
              name="content"
              value={formik.values.content}
            />
            {formik.touched.content && formik.errors.content && (
              <p className="mt-2 text-sm text-red-600">
                {formik.errors.content}
              </p>
            )}

            {attachments.length > 0 && (
              <div className="mt-10 border-t border-slate-100 pt-8">
                <AttachmentList
                  attachments={attachments}
                  onRemove={removeAttachment}
                />
              </div>
            )}

            {/* Card Footer Actions */}
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
      </form>
    </div>
  );
}
