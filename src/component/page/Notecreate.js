import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Api_Url } from "../api/api";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useFormik } from "formik";
import { useNavigate } from "react-router-dom";
import useAuth from "../../contexts/Auth";
import { IoAttach, IoClose, IoDocumentTextOutline, IoSaveOutline } from "react-icons/io5";

const DRAFT_STORAGE_KEY = "note-create-draft";

export default function Notecreate() {
    const navigate = useNavigate();
    const { cookies } = useAuth();
    const [attachments, setAttachments] = useState([]);
    const [isDraftSaving, setIsDraftSaving] = useState(false);
    const savedRef = useRef(false);
    const authHeaders = useMemo(() => ({
        'Authorization': `Bearer ${cookies?.token}`
    }), [cookies?.token]);

    const formik = useFormik({
        initialValues: {
            title: '',
            content: ''
        },
        onSubmit: async (values, { setSubmitting, setErrors, resetForm }) => {
            try {
                const formData = new FormData();
                formData.append('title', values.title);
                formData.append('content', values.content);
                attachments.forEach((file) => {
                    formData.append('attachments', file);
                });

                const response = await Api_Url.post('addnotes', formData, {
                    headers: {
                        ...authHeaders,
                    }
                });
                if (response.data.status === 'success') {
                    savedRef.current = true;
                    toast.success(response.data.message);

                    await Api_Url.delete('draft', {
                        headers: {
                            ...authHeaders,
                            'Content-Type': 'application/json',
                        }
                    });

                    localStorage.removeItem(DRAFT_STORAGE_KEY);
                    setAttachments([]);
                    resetForm();

                    setTimeout(() => {
                        navigate('/allnotes');
                    }, 3000);
                } else {
                    toast.error(response.data.message);
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
            title: draft.title || '',
            content: draft.content || ''
        });
    }, []);

    const hasNoteContent = formik.values.title.trim() !== '' || formik.values.content.trim() !== '';
    const isSaveDisabled = formik.isSubmitting || !hasNoteContent;

    const saveDraft = useCallback(async (values) => {
        if (!values.title.trim() && !values.content.trim()) {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            return;
        }
        try {
            setIsDraftSaving(true);
            const response = await Api_Url.post('draft', 
                { title: values.title, content: values.content }, 
                {
                    headers: {
                        ...authHeaders,
                        'Content-Type': 'application/json',
                    }
                }
            );
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(response.data.data || values));
        } catch (error) {
            console.error("Error saving draft:", error);
        } finally {
            setIsDraftSaving(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        const storedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (storedDraft) {
            try {
                const parsedDraft = JSON.parse(storedDraft);
                applyDraftValues(parsedDraft);
                return;
            } catch (error) {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
            }
        }

        const loadDraft = async () => {
            try {
                const response = await Api_Url.get('draft', {
                    headers: {
                        ...authHeaders,
                        'Content-Type': 'application/json',
                    }
                });
                const draft = response.data.data;
                if (draft) {
                    applyDraftValues(draft);
                    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
                }
            } catch (error) {
                console.error(error);
            }
        };
        loadDraft();
    }, [applyDraftValues, authHeaders]);

    useEffect(() => {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formik.values));

        const timeoutId = setTimeout(() => {
            saveDraft(formik.values);
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [formik.values, saveDraft]);

    useEffect(() => {
        return () => {
            if (!savedRef.current && hasNoteContent) {
                localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formik.values));
                saveDraft(formik.values);
            }
        };
    }, [formik.values, hasNoteContent, saveDraft]);

    const handleAttachmentChange = (event) => {
        const files = Array.from(event.target.files || []);
        setAttachments((currentFiles) => [...currentFiles, ...files]);
        event.target.value = '';
    };

    const removeAttachment = (indexToRemove) => {
        setAttachments((currentFiles) => currentFiles.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="min-h-[calc(100vh-7rem)] bg-[#f3f4f6] px-3 py-4 sm:px-5 lg:px-8">
            <ToastContainer />
            <form onSubmit={formik.handleSubmit} className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-5xl flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                        <p className="text-sm font-medium text-gray-500">New note</p>
                        <h1 className="text-2xl font-semibold text-gray-950">Add Notes</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="min-w-20 text-right text-xs text-gray-500">
                            {isDraftSaving ? "Saving draft" : "Draft ready"}
                        </span>
                        <button
                            type="submit"
                            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition ${isSaveDisabled ? 'cursor-not-allowed bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                            disabled={isSaveDisabled}
                        >
                            <IoSaveOutline size={18} />
                            {formik.isSubmitting ? "Saving" : "Save"}
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
                    <input
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-lg font-semibold text-gray-950 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-200"
                        type="text"
                        placeholder="Note title"
                        onChange={formik.handleChange}
                        name="title"
                        value={formik.values.title}
                    />

                    <textarea
                        className="min-h-[55vh] w-full flex-1 resize-y rounded-lg border border-gray-200 bg-gray-50 p-4 text-base leading-7 text-gray-950 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-200"
                        placeholder="Write without limits..."
                        onChange={formik.handleChange}
                        name="content"
                        value={formik.values.content}
                    />

                    {attachments.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {attachments.map((file, index) => (
                                <div key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                    <IoDocumentTextOutline className="shrink-0 text-gray-600" size={22} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
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

                    <div className="flex flex-col gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-500">Attach any file type. Large notes are supported by the editor.</p>
                        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-100">
                            <IoAttach size={20} />
                            Attach files
                            <input
                                className="hidden"
                                type="file"
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
