import { useCallback, useEffect, useRef, useState } from "react";
import Api_Url, { setAuthToken } from "../api/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../contexts/Auth";
import {
  IoAttach,
  IoClose,
  IoDocumentTextOutline,
  IoCloudDoneOutline,
  IoSaveOutline,
} from "react-icons/io5";

const DRAFT_STORAGE_KEY = "note-create-drafts-v2";
const EMPTY_NOTE = { title: "", content: "" };

export default function Notecreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cookies } = useAuth();
  const [attachments, setAttachments] = useState([]);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [draftId, setDraftId] = useState(location.state?.draftId || null);
  const savedRef = useRef(false);
  const hasUserEditedRef = useRef(false);

  // Extract content if passed from the Draft page directly
  const resumedContent = location.state?.draftContent;
  const resumedDraftId = location.state?.draftId;
  const shouldResumeDraft =
    location.state?.resumeDraft === true || !!resumedContent;

  const loadLocalDrafts = () => {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch (error) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return [];
    }
  };

  // Convert File objects to serializable data URLs for storage
  const filesToDataUrls = (files) => {
    return Promise.all(
      (files || []).map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                dataUrl: reader.result,
              });
            };
            reader.onerror = () => {
              resolve(null);
            };
            reader.readAsDataURL(file);
          }),
      ),
    ).then((arr) => arr.filter(Boolean));
  };

  // Convert stored dataUrl back to a File object
  const dataUrlToFile = (dataUrl, name, type) => {
    try {
      const arr = dataUrl.split(",");
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime =
        (mimeMatch && mimeMatch[1]) || type || "application/octet-stream";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      return new File([u8arr], name, { type: mime });
    } catch (e) {
      return null;
    }
  };

  // Fetch a remote URL and convert to data URL
  const fetchUrlToDataUrl = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  };

  const saveDraftsToStorage = (drafts) => {
    if (!drafts || drafts.length === 0) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  };

  const createDraftId = () =>
    `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
        attachments.forEach((file) => {
          formData.append("attachments", file);
        });

        const response = await Api_Url.post("addnotes", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            // optional: calculate percent
          },
        });

        if (response.data?.status === "success") {
          savedRef.current = true;
          toast.success(response.data.message || "Note saved");

          // clear draft on server if present
          try {
            await Api_Url.delete("draft");
          } catch (e) {}

          const remainingDrafts = loadLocalDrafts().filter(
            (item) => item.id !== draftId,
          );
          saveDraftsToStorage(remainingDrafts);
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

  const applyDraftValues = useCallback((draft) => {
    setFormikValuesRef.current({
      title: draft.title || "",
      content: draft.content || "",
    });
    hasUserEditedRef.current = false;
  }, []);

  const hasNoteContent =
    formik.values.content?.trim() !== "" || formik.values.title?.trim() !== "";
  const isSaveDisabled = formik.isSubmitting || !hasNoteContent;

  const syncDraftToStorage = useCallback(
    async (draft, draftAttachments) => {
      const title = draft?.title?.trim();
      const content = draft?.content?.trim();
      const hasAttachments = draftAttachments && draftAttachments.length > 0;

      if (!content && !title && !hasAttachments) {
        if (!draftId) {
          setHasSavedDraft(loadLocalDrafts().length > 0);
          return;
        }

        const nextDrafts = loadLocalDrafts().filter(
          (item) => item.id !== draftId,
        );
        saveDraftsToStorage(nextDrafts);
        setHasSavedDraft(nextDrafts.length > 0);
        setDraftId(null);
        return nextDrafts;
      }

      const id = draftId || createDraftId();
      let attachmentsData = [];
      if (draftAttachments && draftAttachments.length > 0) {
        // assume draftAttachments are File objects or already-serialized objects
        const needConvert = draftAttachments[0] instanceof File;
        attachmentsData = needConvert
          ? await filesToDataUrls(draftAttachments)
          : draftAttachments;
      }

      const nextDraft = {
        id,
        title,
        content,
        updatedAt: new Date().toISOString(),
        attachments: attachmentsData,
      };

      const drafts = loadLocalDrafts();
      const existingIndex = drafts.findIndex((item) => item.id === id);

      if (existingIndex > -1) {
        drafts[existingIndex] = nextDraft;
      } else {
        drafts.unshift(nextDraft);
      }

      saveDraftsToStorage(drafts);
      setHasSavedDraft(true);
      setDraftId(id);
      return drafts;
    },
    [draftId],
  );

  const saveDraft = useCallback(
    async (values) => {
      const title = values.title?.trim();
      const content = values.content?.trim();
      const currentAttachments = attachments || [];

      if (!content && !title && currentAttachments.length === 0) {
        await syncDraftToStorage(values, []);
        try {
          setIsDraftSaving(true);
          await Api_Url.delete("draft");
        } catch (error) {
          // Silent fail for auto-cleanup
        } finally {
          setIsDraftSaving(false);
        }
        return;
      }

      await syncDraftToStorage(values, currentAttachments);
      try {
        setIsDraftSaving(true);
        const formData = new FormData();
        formData.append("title", title);
        formData.append("content", content);
        // append current attachments as files
        currentAttachments.forEach((file) => {
          if (file instanceof File) {
            formData.append("attachments", file);
          }
        });

        await Api_Url.post("draft", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => {
            // optional: progress
          },
        });
      } catch (error) {
        toast.error("Unable to sync draft to server.");
      } finally {
        setTimeout(() => setIsDraftSaving(false), 500);
      }
    },
    [syncDraftToStorage, attachments],
  );

  useEffect(() => {
    if (resumedContent) return; // Already loaded from state

    const storedDrafts = loadLocalDrafts();
    if (storedDrafts.length > 0) {
      setHasSavedDraft(true);
      if (shouldResumeDraft && resumedDraftId) {
        const matched = storedDrafts.find(
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
        const draftData = response.data.data;
        const normalizedDrafts = Array.isArray(draftData)
          ? draftData
          : draftData
            ? [draftData]
            : [];

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

            // If server provided attachments with URLs, fetch them and store as dataUrls
            if (
              Array.isArray(draft.attachments) &&
              draft.attachments.length > 0
            ) {
              const attData = [];
              for (const att of draft.attachments) {
                if (att.dataUrl) {
                  attData.push({
                    name: att.name,
                    type: att.type,
                    size: att.size || 0,
                    dataUrl: att.dataUrl,
                  });
                } else if (att.url) {
                  const dataUrl = await fetchUrlToDataUrl(att.url);
                  const name = att.name || att.url.split("/").pop() || "file";
                  if (dataUrl)
                    attData.push({
                      name,
                      type: att.type || "",
                      size: 0,
                      dataUrl,
                    });
                }
              }
              drafts.push({ ...base, attachments: attData });
            } else {
              drafts.push(base);
            }
          }

          saveDraftsToStorage(drafts);
          setHasSavedDraft(true);

          if (shouldResumeDraft && resumedDraftId) {
            const matched = drafts.find((item) => item.id === resumedDraftId);
            if (matched) {
              applyDraftValues(matched);
              setDraftId(resumedDraftId);
            }
          }
        } else {
          setHasSavedDraft(false);
        }
      } catch (error) {
        // remote draft restore failed; local drafts will be used instead
      }
    };
    loadDraft();
  }, [applyDraftValues, resumedContent, resumedDraftId, shouldResumeDraft]);

  useEffect(() => {
    if (!hasUserEditedRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      saveDraft(formik.values);
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [formik.values, saveDraft, attachments]);

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
    if (files.length === 0) return;
    hasUserEditedRef.current = true;

    // No file-size or count limit — accept all selected files and append
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

  // When applying a draft, restore attachments (convert dataUrls back to File objects)
  useEffect(() => {
    if (resumedContent) return;
    const storedDrafts = loadLocalDrafts();
    if (storedDrafts.length === 0) return;
    const currentId = draftId;
    if (!currentId) return;
    const matched = storedDrafts.find((d) => d.id === currentId);
    if (!matched || !matched.attachments) return;
    const restored = matched.attachments
      .map((att) => dataUrlToFile(att.dataUrl, att.name, att.type))
      .filter(Boolean);
    if (restored.length > 0) setAttachments(restored);
  }, [draftId, resumedContent]);

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
                  Restore Draft
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
                      await Api_Url.delete("draft");
                    } catch (e) {}

                    const remainingDrafts = draftId
                      ? loadLocalDrafts().filter((item) => item.id !== draftId)
                      : loadLocalDrafts();
                    saveDraftsToStorage(remainingDrafts);
                    setDraftId(null);
                    setHasSavedDraft(remainingDrafts.length > 0);
                    setAttachments([]);
                    formik.resetForm({ values: EMPTY_NOTE });
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

            {/* Attachments Section Inside Content Card */}
            {attachments.length > 0 && (
              <div className="mt-10 grid gap-3 border-t border-slate-50 pt-8 sm:grid-cols-2 lg:grid-cols-3">
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="group relative flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition hover:border-indigo-100 hover:bg-white hover:shadow-md"
                  >
                    <div className="text-slate-400 group-hover:text-indigo-500">
                      <IoDocumentTextOutline size={20} />
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="truncate font-bold text-slate-700">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {(file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-slate-300 hover:text-red-500"
                      onClick={() => removeAttachment(index)}
                    >
                      <IoClose size={16} />
                    </button>
                  </div>
                ))}
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
