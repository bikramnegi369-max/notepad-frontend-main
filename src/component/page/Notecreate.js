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
  IoSaveOutline,
} from "react-icons/io5";

const DRAFT_STORAGE_KEY = "note-create-drafts";
const EMPTY_NOTE = { content: "" };

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
    content: Yup.string()
      .trim()
      .min(3, "Write something meaningful")
      .required("Content is required"),
  });

  const formik = useFormik({
    initialValues: {
      content: resumedContent || "",
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values, { setSubmitting, setErrors, resetForm }) => {
      try {
        const formData = new FormData();
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
      content: draft.content || "",
    });
    hasUserEditedRef.current = false;
  }, []);

  const hasNoteContent = formik.values.content?.trim() !== "";
  const isSaveDisabled = formik.isSubmitting || !hasNoteContent;

  const syncDraftToStorage = useCallback(
    async (draft, draftAttachments) => {
      const content = draft?.content?.trim();

      if (!content) {
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
      const content = values.content?.trim();
      const currentAttachments = attachments || [];

      if (!content && currentAttachments.length === 0) {
        syncDraftToStorage(values, []);
        return;
      }

      await syncDraftToStorage(values, currentAttachments);
      try {
        setIsDraftSaving(true);
        const formData = new FormData();
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

    if (!formik.values.content?.trim()) {
      syncDraftToStorage({ content: "" });
      return;
    }

    const timeoutId = setTimeout(() => {
      saveDraft(formik.values);
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [formik.values, saveDraft, syncDraftToStorage]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (
        !savedRef.current &&
        (formik.values.content.trim() || attachments.length > 0)
      ) {
        // include attachments when syncing on unload
        syncDraftToStorage({ content: formik.values.content }, attachments);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [formik.values.content, syncDraftToStorage, attachments]);

  const handleAttachmentChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // No file-size or count limit — accept all selected files and append
    setAttachments((currentFiles) => {
      return [...currentFiles, ...files];
    });

    event.target.value = "";
  };

  const handleContentChange = (event) => {
    hasUserEditedRef.current = true;
    formik.handleChange(event);
  };

  const removeAttachment = (indexToRemove) => {
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
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 sm:px-6">
      <ToastContainer />
      <form
        onSubmit={formik.handleSubmit}
        className="mx-auto flex min-h-[75vh] w-full max-w-5xl flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300"
      >
        <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-t-xl border-b border-gray-200 bg-white/80 px-4 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-gray-950 sm:text-2xl">
              Create Note
            </h1>
            {hasSavedDraft &&
              !shouldResumeDraft &&
              !hasUserEditedRef.current && (
                <Link
                  to="/draft"
                  className="mt-1 inline-block text-sm font-medium text-green-700 hover:text-green-800 hover:underline"
                >
                  View unsaved draft
                </Link>
              )}
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <span
              className="flex-1 text-xs font-medium text-gray-400 sm:min-w-20 sm:text-right"
              role="status"
              aria-live="polite"
            >
              {isDraftSaving ? (
                <span className="flex items-center justify-end gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400"></span>{" "}
                  Saving...
                </span>
              ) : hasUserEditedRef.current ? (
                "Changes cached"
              ) : (
                ""
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className={`inline-flex h-10 min-w-[100px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white shadow-sm transition-all active:scale-95 sm:h-11 sm:min-w-28 ${
                  isSaveDisabled
                    ? "cursor-not-allowed bg-gray-300"
                    : "bg-green-600 hover:bg-green-700 hover:shadow-green-100"
                }`}
                disabled={isSaveDisabled}
              >
                <IoSaveOutline size={18} />
                {formik.isSubmitting ? "Saving" : "Save"}
              </button>
              {(hasSavedDraft || hasNoteContent) && (
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
                    setFormikValuesRef.current({ content: "" });
                    toast.info("Draft discarded");
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Discard
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
          <textarea
            className="min-h-[50vh] w-full flex-1 resize-none border-none bg-transparent p-0 text-base leading-7 text-gray-950 outline-none transition placeholder:text-gray-400 sm:min-h-[60vh] sm:text-lg"
            placeholder="Write without limits..."
            onChange={handleContentChange}
            name="content"
            value={formik.values.content}
          />
          {formik.touched.content && formik.errors.content && (
            <p className="mt-2 text-sm text-red-600">{formik.errors.content}</p>
          )}

          {attachments.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {attachments.map((file, index) => (
                <div
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <IoDocumentTextOutline
                    className="shrink-0 text-gray-600"
                    size={22}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-500 transition hover:bg-gray-200 hover:text-gray-900"
                    onClick={() => removeAttachment(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <IoClose size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-5 text-gray-500">
              Attach any file type. Large notes are supported by the editor.
            </p>
            <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 sm:w-auto">
              <IoAttach size={20} />
              <span className="inline-flex items-center gap-2">
                <span>Attach files</span>
                {attachments.length > 0 && (
                  <span className="ml-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {attachments.length}
                  </span>
                )}
              </span>
              <input
                className="hidden"
                type="file"
                aria-label="Attach files"
                name="attachments"
                multiple
                onChange={handleAttachmentChange}
              />
            </label>
          </div>
        </div>
      </form>
    </div>
  );
}
