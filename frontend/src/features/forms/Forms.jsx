import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import OnlyOfficeEditor from "@/components/onlyoffice/OnlyOfficeEditor";
import formService from "@/services/form.service";
import folderService from "@/services/folder.service";
import { useLang } from "@/app/providers/LanguageProvider";

const templateIcons = {
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  receipt: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  ),
  star: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  clipboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
};

const workflowActions = [
  { value: "fill" },
  { value: "review" },
  { value: "approve" },
  { value: "sign" },
];

const workflowIcons = {
  fill: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  review: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  approve: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  sign: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
};

const statusConfig = {
  active: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  draft: { bg: "bg-slate-100 dark:bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" },
  completed: { bg: "bg-indigo-50 dark:bg-indigo-500/10", text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" },
  cancelled: { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
};

const categoryOptions = [
  { value: "general", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg> },
  { value: "hr", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { value: "finance", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { value: "legal", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg> },
  { value: "operations", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
];

const stepStatusConfig = {
  completed: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-2 ring-emerald-500/30", border: "border-emerald-200 dark:border-emerald-500/30", badge: "bg-emerald-500", icon: <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> },
  in_progress: { bg: "bg-indigo-50 dark:bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", ring: "ring-2 ring-indigo-500/30", border: "border-indigo-200 dark:border-indigo-500/30", badge: "bg-indigo-500", icon: <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3" /></svg> },
  pending: { bg: "bg-slate-50 dark:bg-slate-500/10", text: "text-slate-400 dark:text-slate-500", ring: "", border: "border-slate-200 dark:border-slate-700", badge: "bg-slate-400", icon: null },
  skipped: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "", border: "border-amber-200 dark:border-amber-500/30", badge: "bg-amber-500", icon: null },
};

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "File" },
];

function CustomSelect({ value, options, onChange, placeholder, renderValue, renderOption, dropUp }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-left text-sm flex items-center justify-between gap-2 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-slate-900 dark:text-white">
        {value ? renderValue(value) : <span className="text-slate-400 text-xs">{placeholder}</span>}
        <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className={`absolute ${dropUp ? "bottom-full mb-1" : "top-full mt-1"} left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto`}>
          {options.map((opt, i) => (
            <button key={opt.value || opt.id || i} type="button" onClick={() => { onChange(opt); setOpen(false); }} className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-sm transition-colors">
              {renderOption(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Forms() {
  const { t } = useLang();
  const [activeSection, setActiveSection] = useState("templates");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showNewTemplateChoice, setShowNewTemplateChoice] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [editorConfig, setEditorConfig] = useState(null);
  const [editorDocName, setEditorDocName] = useState("");
  const [editorTemplateId, setEditorTemplateId] = useState(null);
  const [editorMode, setEditorMode] = useState("edit");
  const [editorDocId, setEditorDocId] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [orgUsers, setOrgUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(false);

  const [newForm, setNewForm] = useState({
    name: "",
    formId: "",
    startDate: "",
    dueDate: "",
    workflowSteps: [{ id: Date.now(), userId: "", action: "" }],
  });

  // Legacy JSON-schema template
  const [newTemplate, setNewTemplate] = useState({
    title: "",
    description: "",
    icon: "document",
    category: "general",
    fields: [{ label: "", type: "text", required: false }],
  });

  const [uploadTemplate, setUploadTemplate] = useState({
    title: "",
    description: "",
    icon: "document",
    category: "general",
    file: null,
  });

  const [blankTemplate, setBlankTemplate] = useState({
    title: "",
    description: "",
    icon: "document",
    category: "general",
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [createdTemplate, setCreatedTemplate] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    title: "", description: "", icon: "document", category: "general", folderId: null, notes: "",
  });

  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [showEditMetaModal, setShowEditMetaModal] = useState(false);
  const [editMetaForm, setEditMetaForm] = useState({
    title: "", description: "", icon: "document", category: "general",
  });
  const [editMetaId, setEditMetaId] = useState(null);

  const [folders, setFolders] = useState([]);

  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: null, id: null, name: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tplRes, instRes, usersRes, foldersRes] = await Promise.all([
        formService.getTemplates(),
        formService.getInstances(),
        formService.getUsers(),
        folderService.getAllFolders().catch(() => ({ success: false })),
      ]);
      if (tplRes.success) setTemplates(tplRes.data);
      if (instRes.success) setInstances(instRes.data);
      if (usersRes.success) setOrgUsers(usersRes.data);
      if (foldersRes.success) setFolders(foldersRes.data || []);
    } catch (err) {
      console.error("Failed to fetch forms data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.title) return;
    try {
      const schema = {
        fields: newTemplate.fields.filter(f => f.label.trim()).map((f, i) => ({
          id: `field_${i}`,
          label: f.label,
          type: f.type,
          required: f.required,
        })),
      };
      const res = await formService.createTemplate({
        title: newTemplate.title,
        description: newTemplate.description,
        icon: newTemplate.icon,
        category: newTemplate.category,
        schema,
      });
      if (res.success) {
        setTemplates(prev => [res.data, ...prev]);
        setShowTemplateModal(false);
        setNewTemplate({ title: "", description: "", icon: "document", category: "general", fields: [{ label: "", type: "text", required: false }] });
      }
    } catch (err) {
      console.error("Create template error:", err);
    }
  };

  // Create blank document template → show settings modal after creation
  const handleCreateBlankTemplate = async () => {
    setTemplateLoading(true);
    try {
      const title = blankTemplate.title?.trim() || `Untitled Template ${new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      const res = await formService.createBlankTemplate({ ...blankTemplate, title });
      if (res.success) {
        const tpl = res.data.template;
        setTemplates(prev => [tpl, ...prev]);
        setShowNewTemplateChoice(false);
        setBlankTemplate({ title: "", description: "", icon: "document", category: "general" });
        setCreatedTemplate(tpl);
        setSettingsForm({
          title: tpl.title, description: tpl.description || "", icon: tpl.icon || "document",
          category: tpl.category || "general", folderId: null, notes: "",
        });
        setShowSettingsModal(true);
      }
    } catch (err) {
      console.error("Create blank template error:", err);
    } finally {
      setTemplateLoading(false);
    }
  };

  // Upload file as template (PDF→DOCX) → show settings modal after creation
  const handleUploadTemplate = async () => {
    if (!uploadTemplate.file) return;
    setTemplateLoading(true);
    try {
      const res = await formService.uploadFileTemplate(uploadTemplate.file, {
        title: uploadTemplate.title || uploadTemplate.file.name.replace(/\.[^.]+$/, ''),
        description: uploadTemplate.description,
        icon: uploadTemplate.icon,
        category: uploadTemplate.category,
      });
      if (res.success) {
        const tpl = res.data.template;
        setTemplates(prev => [tpl, ...prev]);
        setShowUploadModal(false);
        setUploadTemplate({ title: "", description: "", icon: "document", category: "general", file: null });
        setCreatedTemplate(tpl);
        setSettingsForm({
          title: tpl.title, description: tpl.description || "", icon: tpl.icon || "document",
          category: tpl.category || "general", folderId: null, notes: "",
        });
        setShowSettingsModal(true);
      }
    } catch (err) {
      console.error("Upload template error:", err);
    } finally {
      setTemplateLoading(false);
    }
  };

  // Save post-creation settings and optionally continue editing
  const handleSaveSettings = async (continueEditing = false) => {
    if (!createdTemplate) return;
    try {
      await formService.updateTemplate(createdTemplate.id, {
        title: settingsForm.title,
        description: settingsForm.description,
        icon: settingsForm.icon,
        category: settingsForm.category,
      });
      if (settingsForm.folderId && createdTemplate.schema?.documentId) {
        await folderService.moveDocument(createdTemplate.schema.documentId, settingsForm.folderId).catch(() => {});
      }
      setTemplates(prev => prev.map(t => t.id === createdTemplate.id
        ? { ...t, title: settingsForm.title, description: settingsForm.description, icon: settingsForm.icon, category: settingsForm.category }
        : t
      ));
      setShowSettingsModal(false);
      if (continueEditing) {
        await openTemplateInEditor(createdTemplate.id);
      }
      setCreatedTemplate(null);
    } catch (err) {
      console.error("Save settings error:", err);
    }
  };

  const openTemplateInEditor = async (templateId, mode = 'edit') => {
    try {
      const res = await formService.getTemplateDocument(templateId, mode);
      if (res.success) {
        setEditorConfig(res.data.config);
        setEditorDocName(res.data.templateTitle || res.data.document.originalFilename);
        setEditorDocId(res.data.document?.id || null);
        setEditorTemplateId(templateId);
        setEditorMode(mode);
        setSelectedTemplate(null); // close detail modal if open
      }
    } catch (err) {
      console.error("Open template in editor error:", err);
    }
  };

  const closeEditor = () => {
    setEditorConfig(null);
    setEditorDocName("");
    setEditorTemplateId(null);
    setEditorDocId(null);
    setEditorMode("edit");
    fetchData(); // Refresh data after editing
  };

  const handleTemplateClick = (tpl) => {
    setSelectedTemplate(tpl);
  };

  const handleEditMeta = (tpl, e) => {
    if (e) e.stopPropagation();
    setEditMetaId(tpl.id);
    setEditMetaForm({
      title: tpl.title, description: tpl.description || "",
      icon: tpl.icon || "document", category: tpl.category || "general",
    });
    setSelectedTemplate(null);
    setShowEditMetaModal(true);
  };

  const handleSaveMetaEdit = async () => {
    if (!editMetaId) return;
    try {
      const res = await formService.updateTemplate(editMetaId, editMetaForm);
      if (res.success) {
        setTemplates(prev => prev.map(t => t.id === editMetaId ? { ...t, ...editMetaForm } : t));
        setShowEditMetaModal(false);
        setEditMetaId(null);
      }
    } catch (err) {
      console.error("Update template metadata error:", err);
    }
  };

  const handleUseTemplate = (template) => {
    setNewForm({ ...newForm, formId: template.id, name: `${template.title} - ${new Date().toLocaleDateString()}` });
    setShowCreateModal(true);
  };

  const handleCreateForm = async () => {
    if (!newForm.name || !newForm.formId) return;
    try {
      const payload = {
        name: newForm.name,
        formId: newForm.formId,
        startDate: newForm.startDate || null,
        dueDate: newForm.dueDate || null,
        workflowSteps: newForm.workflowSteps
          .filter(s => s.userId && s.action)
          .map(s => ({ userId: s.userId, action: s.action })),
      };
      const res = await formService.createInstance(payload);
      if (res.success) {
        await fetchData();
        setShowCreateModal(false);
        setNewForm({ name: "", formId: "", startDate: "", dueDate: "", workflowSteps: [{ id: Date.now(), userId: "", action: "" }] });
        setActiveSection("created");
      }
    } catch (err) {
      console.error("Create form error:", err);
    }
  };

  const handleDeleteInstance = (id, name) => {
    setDeleteConfirm({ show: true, type: 'instance', id, name: name || t("forms.deleteModal.thisForm") });
  };

  const handleDeleteTemplate = (id, name, e) => {
    if (e) e.stopPropagation();
    setDeleteConfirm({ show: true, type: 'template', id, name: name || t("forms.deleteModal.thisTemplate") });
  };

  const confirmDelete = async () => {
    const { type, id } = deleteConfirm;
    try {
      if (type === 'template') {
        await formService.deleteTemplate(id);
        setTemplates(prev => prev.filter(t => t.id !== id));
      } else if (type === 'instance') {
        await formService.deleteInstance(id);
        setInstances(prev => prev.filter(i => i.id !== id));
      }
    } catch (err) {
      console.error(`Delete ${type} error:`, err);
    } finally {
      setDeleteConfirm({ show: false, type: null, id: null, name: '' });
    }
  };

  const addWorkflowStep = () => {
    setNewForm(prev => ({ ...prev, workflowSteps: [...prev.workflowSteps, { id: Date.now(), userId: "", action: "" }] }));
  };
  const removeWorkflowStep = (id) => {
    setNewForm(prev => ({ ...prev, workflowSteps: prev.workflowSteps.filter(s => s.id !== id) }));
  };
  const updateWorkflowStep = (id, field, value) => {
    setNewForm(prev => ({
      ...prev,
      workflowSteps: prev.workflowSteps.map(s => s.id === id ? { ...s, [field]: typeof value === "object" ? value.value || value.id : value } : s),
    }));
  };

  const addField = () => {
    setNewTemplate(prev => ({ ...prev, fields: [...prev.fields, { label: "", type: "text", required: false }] }));
  };
  const removeField = (idx) => {
    setNewTemplate(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }));
  };
  const updateField = (idx, key, val) => {
    setNewTemplate(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === idx ? { ...f, [key]: val } : f),
    }));
  };

  const sections = [
    { id: "templates", label: t("forms.sections.templates"), count: templates.length },
    { id: "created", label: t("forms.sections.created"), count: instances.length },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <PageHeader
          className="mb-6 sm:mb-8"
          eyebrow={t("forms.header.eyebrow")}
          title={t("forms.header.title")}
          subtitle={t("forms.header.subtitle")}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          actions={
            <>
              <button onClick={() => setShowNewTemplateChoice(true)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t("forms.header.newTemplate")}
              </button>
              <button onClick={() => setShowCreateModal(true)} className="px-4 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white text-sm font-semibold shadow-lg shadow-accent transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t("forms.header.createForm")}
              </button>
            </>
          }
        />

        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6 w-fit">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                activeSection === s.id ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}>
              {s.label}
              <span className={`px-2 py-0.5 rounded-full text-xs ${activeSection === s.id ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-slate-200 dark:bg-slate-700 text-slate-500"}`}>
                {s.count}
              </span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && activeSection === "templates" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">{t("forms.templatesEmpty.title")}</h3>
                <p className="text-sm text-slate-500">{t("forms.templatesEmpty.subtitle")}</p>
              </div>
            ) : (
              templates.map((tpl, idx) => (
                <motion.div key={tpl.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card
                    onClick={() => tpl.schema?.documentId ? openTemplateInEditor(tpl.id, 'view') : handleTemplateClick(tpl)}
                    className="group relative overflow-hidden border border-slate-200 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-xl hover:shadow-accent transition-all duration-300 p-5 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          {templateIcons[tpl.icon] || templateIcons.document}
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${
                          tpl.schema?.type === 'document-template'
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {tpl.schema?.type === 'document-template' ? t("forms.badge.document") : t("forms.badge.schema")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUseTemplate(tpl); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 transition-all"
                          title={t("forms.card.assignTask")}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        </button>
                        <button
                          onClick={(e) => handleEditMeta(tpl, e)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-violet-50 dark:hover:bg-violet-500/10 text-slate-400 hover:text-violet-500 transition-all"
                          title={t("forms.card.editTemplate")}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id, tpl.title, e); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">{tpl.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 min-h-[2.5rem]">{tpl.description || t("forms.card.noDescription")}</p>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {tpl.schema?.type === 'document-template' ? (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            {t("forms.badge.docx")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                            {tpl.schema?.fields?.length || 0} {t("forms.card.fields")}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                          {tpl.usageCount || 0} {t("forms.card.uses")}
                        </span>
                      </div>
                      {tpl.category && (
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">{tpl.category}</span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}

        {!loading && activeSection === "created" && (
          <div className="space-y-3">
            {instances.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">{t("forms.createdEmpty.title")}</h3>
                <p className="text-sm text-slate-500">{t("forms.createdEmpty.subtitle")}</p>
              </div>
            ) : (
              instances.map((form, idx) => {
                const st = statusConfig[form.status] || statusConfig.draft;
                return (
                  <motion.div key={form.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                    <Card className="p-4 sm:p-5 border border-slate-200 dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-500/20 transition-all">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {statusConfig[form.status] ? t(`forms.status.${form.status}`) : t("forms.status.draft")}
                            </span>
                            <span className="text-xs text-slate-400">{t("forms.instance.basedOn")} {form.templateName || t("forms.instance.unknown")}</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{form.name}</h3>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                            {form.startDate && (
                              <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {t("forms.instance.start")} {new Date(form.startDate).toLocaleDateString()}
                              </div>
                            )}
                            {form.dueDate && (
                              <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {t("forms.instance.due")} {new Date(form.dueDate).toLocaleDateString()}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              {form.workflow?.filter(s => s.status === "completed").length || 0}/{form.workflow?.length || 0} {t("forms.instance.stepsDone")}
                            </div>
                          </div>
                        </div>

                        {form.workflow && form.workflow.length > 0 && (
                          <div className="flex items-center gap-1">
                            {form.workflow.map((step, i) => {
                              const ss = stepStatusConfig[step.status] || stepStatusConfig.pending;
                              const icon = workflowIcons[step.action] || workflowIcons.fill;
                              return (
                                <div key={step.id || i} className="flex items-center">
                                  <div className="relative group">
                                    <div className={`w-10 h-10 rounded-full ${ss.bg} ${ss.ring} border ${ss.border} flex items-center justify-center transition-all duration-200 hover:scale-110`}>
                                      <span className={ss.text}>{icon}</span>
                                    </div>
                                    {step.status !== "pending" && (
                                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${ss.badge} flex items-center justify-center shadow-sm`}>
                                        {ss.icon}
                                      </div>
                                    )}
                                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10 shadow-xl">
                                      <div className="font-semibold">{step.user || t("forms.instance.unassigned")}</div>
                                      <div className="text-slate-400 capitalize flex items-center gap-1.5 mt-0.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${step.status === "completed" ? "bg-emerald-400" : step.status === "in_progress" ? "bg-indigo-400" : "bg-slate-400"}`} />
                                        {step.action} &bull; {(step.status || "pending").replace(/_/g, " ")}
                                      </div>
                                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rotate-45 bg-slate-900 dark:bg-slate-700" />
                                    </div>
                                  </div>
                                  {i < form.workflow.length - 1 && (
                                    <div className="relative w-8 h-[2px] mx-0.5">
                                      <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 rounded-full" />
                                      <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                                        step.status === "completed" ? "bg-emerald-500 w-full" : step.status === "in_progress" ? "bg-indigo-500 w-1/2" : "w-0"
                                      }`} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDeleteInstance(form.id, form.name)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-rose-500 text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
                            {t("common.delete")}
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreateModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("forms.createModal.title")}</h2>
                    <p className="text-sm text-slate-500">{t("forms.createModal.subtitle")}</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("forms.createModal.formName")}</label>
                  <input type="text" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder={t("forms.createModal.formNamePlaceholder")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent transition-all outline-none text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("forms.createModal.template")}</label>
                  <CustomSelect
                    value={templates.find(tp => tp.id === newForm.formId)}
                    options={templates}
                    onChange={(tp) => setNewForm({ ...newForm, formId: tp.id })}
                    placeholder={t("forms.createModal.selectTemplate")}
                    renderValue={(tp) => <span className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-indigo-500" /><span className="truncate">{tp.title}</span></span>}
                    renderOption={(tp) => (
                      <>
                        <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">{templateIcons[tp.icon] || templateIcons.document}</span>
                        <div className="flex-1 min-w-0"><div className="font-medium text-slate-900 dark:text-white text-sm">{tp.title}</div><div className="text-xs text-slate-500 truncate">{tp.description || t("forms.createModal.noDescription")}</div></div>
                      </>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("forms.createModal.startDate")}</label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <input type="date" value={newForm.startDate} onChange={(e) => setNewForm({ ...newForm, startDate: e.target.value })} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:border-accent focus:ring-2 focus:ring-accent focus:bg-white dark:focus:bg-slate-800 dark:focus:bg-slate-800 transition-all outline-none text-sm dark:[color-scheme:dark] appearance-none [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-datetime-edit]:text-slate-900 dark:[&::-webkit-datetime-edit]:text-white [&::-webkit-datetime-edit-text]:text-slate-900 dark:[&::-webkit-datetime-edit-text]:text-white [&::-webkit-datetime-edit-month-field]:text-slate-900 dark:[&::-webkit-datetime-edit-month-field]:text-white [&::-webkit-datetime-edit-day-field]:text-slate-900 dark:[&::-webkit-datetime-edit-day-field]:text-white [&::-webkit-datetime-edit-year-field]:text-slate-900 dark:[&::-webkit-datetime-edit-year-field]:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("forms.createModal.dueDate")}</label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <input type="date" value={newForm.dueDate} onChange={(e) => setNewForm({ ...newForm, dueDate: e.target.value })} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:border-accent focus:ring-2 focus:ring-accent focus:bg-white dark:focus:bg-slate-800 dark:focus:bg-slate-800 transition-all outline-none text-sm dark:[color-scheme:dark] appearance-none [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-datetime-edit]:text-slate-900 dark:[&::-webkit-datetime-edit]:text-white [&::-webkit-datetime-edit-text]:text-slate-900 dark:[&::-webkit-datetime-edit-text]:text-white [&::-webkit-datetime-edit-month-field]:text-slate-900 dark:[&::-webkit-datetime-edit-month-field]:text-white [&::-webkit-datetime-edit-day-field]:text-slate-900 dark:[&::-webkit-datetime-edit-day-field]:text-white [&::-webkit-datetime-edit-year-field]:text-slate-900 dark:[&::-webkit-datetime-edit-year-field]:text-white" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t("forms.createModal.workflowSteps")}</label>
                    <button type="button" onClick={addWorkflowStep} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-700 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      {t("forms.createModal.addStep")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {newForm.workflowSteps.map((step, index) => (
                      <motion.div key={step.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow">{index + 1}</div>
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <CustomSelect
                            value={orgUsers.find(u => u.id === step.userId)}
                            options={orgUsers}
                            onChange={(u) => updateWorkflowStep(step.id, "userId", u.id)}
                            placeholder={t("forms.createModal.selectUser")}
                            dropUp={true}
                            renderValue={(u) => <span className="flex items-center gap-1 text-xs"><span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold shrink-0">{u.avatar}</span><span className="truncate">{u.name}</span></span>}
                            renderOption={(u) => (
                              <>
                                <span className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">{u.avatar}</span>
                                <div className="flex-1 min-w-0"><div className="font-medium text-slate-900 dark:text-white text-sm">{u.name}</div><div className="text-xs text-slate-500">{u.role}</div></div>
                              </>
                            )}
                          />
                          <CustomSelect
                            value={workflowActions.find(a => a.value === step.action)}
                            options={workflowActions}
                            onChange={(a) => updateWorkflowStep(step.id, "action", a.value)}
                            placeholder={t("forms.createModal.action")}
                            dropUp={true}
                            renderValue={(a) => <span className="text-xs">{t(`forms.workflowActions.${a.value}`)}</span>}
                            renderOption={(a) => <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{t(`forms.workflowActions.${a.value}`)}</span>}
                          />
                        </div>
                        {newForm.workflowSteps.length > 1 && (
                          <button type="button" onClick={() => removeWorkflowStep(step.id)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">{t("common.cancel")}</button>
                <button onClick={handleCreateForm} disabled={!newForm.name || !newForm.formId} className="flex-1 px-4 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white font-semibold shadow-lg shadow-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm">{t("forms.header.createForm")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTemplateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowTemplateModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("forms.templateModal.title")}</h2>
                    <p className="text-sm text-slate-500">{t("forms.templateModal.subtitle")}</p>
                  </div>
                </div>
                <button onClick={() => setShowTemplateModal(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("forms.templateModal.templateName")}</label>
                  <input type="text" value={newTemplate.title} onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })} placeholder={t("forms.templateModal.templateNamePlaceholder")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent transition-all outline-none text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("common.description")}</label>
                  <textarea value={newTemplate.description} onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })} placeholder={t("forms.templateModal.descriptionPlaceholder")} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent transition-all outline-none text-sm resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("forms.templateModal.icon")}</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {Object.keys(templateIcons).map(key => (
                        <button key={key} type="button" onClick={() => setNewTemplate({ ...newTemplate, icon: key })}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${newTemplate.icon === key ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600" : "border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300"}`}>
                          {templateIcons[key]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("forms.templateModal.category")}</label>
                    <CustomSelect
                      value={categoryOptions.find(c => c.value === newTemplate.category)}
                      options={categoryOptions}
                      onChange={(opt) => setNewTemplate({ ...newTemplate, category: opt.value })}
                      placeholder={t("forms.templateModal.selectCategory")}
                      renderValue={(c) => <span className="flex items-center gap-2 text-sm"><span>{c.icon}</span>{t(`forms.categories.${c.value}`)}</span>}
                      renderOption={(c) => <span className="flex items-center gap-2"><span>{c.icon}</span><span className="font-medium text-slate-700 dark:text-slate-200">{t(`forms.categories.${c.value}`)}</span></span>}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t("forms.templateModal.formFields")}</label>
                    <button type="button" onClick={addField} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-700 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      {t("forms.templateModal.addField")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {newTemplate.fields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <input type="text" value={field.label} onChange={(e) => updateField(idx, "label", e.target.value)} placeholder="Field label" className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-accent" />
                        <div className="w-32 shrink-0">
                          <CustomSelect
                            value={FIELD_TYPE_OPTIONS.find(o => o.value === field.type)}
                            options={FIELD_TYPE_OPTIONS}
                            onChange={(opt) => updateField(idx, "type", opt.value)}
                            placeholder="Type"
                            renderValue={(o) => <span className="text-sm text-slate-900 dark:text-white">{o.label}</span>}
                            renderOption={(o) => <span className="text-sm text-slate-700 dark:text-slate-200">{o.label}</span>}
                          />
                        </div>
                        <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer whitespace-nowrap">
                          <input type="checkbox" checked={field.required} onChange={(e) => updateField(idx, "required", e.target.checked)} className="rounded border-slate-300" />
                          Req
                        </label>
                        {newTemplate.fields.length > 1 && (
                          <button type="button" onClick={() => removeField(idx)} className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
                <button onClick={() => setShowTemplateModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                <button onClick={handleCreateTemplate} disabled={!newTemplate.title} className="flex-1 px-4 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white font-semibold shadow-lg shadow-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm">Create Template</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewTemplateChoice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowNewTemplateChoice(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create New Template</h2>
                  <button onClick={() => setShowNewTemplateChoice(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Choose how you'd like to start</p>
              </div>

              <div className="px-6 pb-4 space-y-3">
                <button
                  onClick={handleCreateBlankTemplate}
                  disabled={templateLoading}
                  className="w-full p-5 rounded-2xl border-2 border-indigo-100 dark:border-indigo-500/20 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-500/5 dark:to-blue-500/5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-lg hover:shadow-accent text-left transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Blank Document</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Start fresh with an empty document. Opens directly in the editor.</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-500 group-hover:translate-x-0.5 transition-transform shrink-0 mt-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => { setShowNewTemplateChoice(false); setShowUploadModal(true); }}
                  disabled={templateLoading}
                  className="w-full p-5 rounded-2xl border-2 border-violet-100 dark:border-violet-500/20 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/5 dark:to-purple-500/5 hover:border-violet-300 dark:hover:border-violet-500/40 hover:shadow-lg hover:shadow-accent text-left transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-violet-100 dark:border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-105 transition-transform shrink-0">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Upload File</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Upload a DOCX or PDF file. PDF will be auto-converted for editing.</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-violet-500 group-hover:translate-x-0.5 transition-transform shrink-0 mt-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </button>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700" /></div>
                  <div className="relative flex justify-center"><span className="px-3 bg-white dark:bg-slate-900 text-xs text-slate-400 uppercase tracking-wider">or</span></div>
                </div>

                <button
                  onClick={() => { setShowNewTemplateChoice(false); setShowTemplateModal(true); }}
                  className="w-full p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Form Schema Template</h3>
                      <p className="text-xs text-slate-400">Define form fields manually (no document)</p>
                    </div>
                  </div>
                </button>
              </div>

              {templateLoading && (
                <div className="px-6 pb-5">
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">Creating blank template...</span>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUploadModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => { if (!templateLoading) setShowUploadModal(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-slate-200/50 dark:border-slate-700/50" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upload Template</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Upload a DOCX or PDF file as template</p>
                    </div>
                  </div>
                  <button onClick={() => { if (!templateLoading) setShowUploadModal(false); }} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div className="mx-6 my-3 border-t border-slate-100 dark:border-slate-800" />

              <div className="px-6 pb-4 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <div className={`relative border-2 border-dashed rounded-2xl transition-all cursor-pointer ${uploadTemplate.file ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5' : 'border-slate-300 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500/40 hover:bg-violet-50/30 dark:hover:bg-violet-500/5'}`}>
                    {uploadTemplate.file ? (
                      <div className="p-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${uploadTemplate.file.type.includes('pdf') ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                            {uploadTemplate.file.type.includes('pdf') ? (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            ) : (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{uploadTemplate.file.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">{(uploadTemplate.file.size / 1024).toFixed(1)} KB</span>
                              {uploadTemplate.file.type.includes('pdf') && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                  Will convert to DOCX
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setUploadTemplate({ ...uploadTemplate, file: null }); }} className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">File ready to upload</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-violet-500 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Click to browse or drag & drop</p>
                        <p className="text-xs text-slate-400">Supports DOCX, PDF, DOC, ODT (max 50MB)</p>
                        <div className="flex items-center justify-center gap-3 mt-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-xs text-blue-600 dark:text-blue-400 font-medium">DOCX</span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400 font-medium">PDF</span>
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".docx,.pdf,.doc,.odt,.rtf"
                      onChange={(e) => { if (e.target.files?.[0]) setUploadTemplate({ ...uploadTemplate, file: e.target.files[0], title: uploadTemplate.title || e.target.files[0].name.replace(/\.[^.]+$/, '') }); }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Template Name</label>
                  <input type="text" value={uploadTemplate.title} onChange={(e) => setUploadTemplate({ ...uploadTemplate, title: e.target.value })} placeholder="Auto-filled from filename" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description <span className="normal-case font-normal">(optional)</span></label>
                  <textarea value={uploadTemplate.description} onChange={(e) => setUploadTemplate({ ...uploadTemplate, description: e.target.value })} placeholder="What is this template for?" rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Icon</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Object.keys(templateIcons).map(key => (
                        <button key={key} type="button" onClick={() => setUploadTemplate({ ...uploadTemplate, icon: key })}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-200 ${uploadTemplate.icon === key ? "border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 shadow-sm shadow-accent" : "border-transparent bg-slate-50 dark:bg-slate-800 text-slate-400 hover:border-slate-200 dark:hover:border-slate-600 hover:text-slate-600 dark:hover:text-slate-300"}`}>
                          {templateIcons[key]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Category</label>
                    <CustomSelect
                      value={categoryOptions.find(c => c.value === uploadTemplate.category)}
                      options={categoryOptions}
                      onChange={(opt) => setUploadTemplate({ ...uploadTemplate, category: opt.value })}
                      placeholder="Select category..."
                      renderValue={(c) => <span className="flex items-center gap-2 text-sm"><span>{c.icon}</span>{t(`forms.categories.${c.value}`)}</span>}
                      renderOption={(c) => <span className="flex items-center gap-2"><span>{c.icon}</span><span className="font-medium text-slate-700 dark:text-slate-200">{t(`forms.categories.${c.value}`)}</span></span>}
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
                <button onClick={() => { if (!templateLoading) setShowUploadModal(false); }} disabled={templateLoading} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium hover:bg-white dark:hover:bg-slate-800 transition-colors text-sm disabled:opacity-50">Cancel</button>
                <button onClick={handleUploadTemplate} disabled={!uploadTemplate.file || templateLoading} className="flex-1 px-4 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white font-semibold shadow-lg shadow-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2">
                  {templateLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {uploadTemplate.file?.type?.includes('pdf') ? 'Converting...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Upload Template
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettingsModal && createdTemplate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-slate-200/50 dark:border-slate-700/50" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-2 shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Template Created!</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Configure your template settings before you start</p>
                  </div>
                </div>
              </div>

              <div className="mx-6 my-2 border-t border-slate-100 dark:border-slate-800" />

              <div className="px-6 pb-4 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Template Name</label>
                  <input type="text" value={settingsForm.title} onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })} placeholder="Enter template name..." className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description <span className="normal-case font-normal">(optional)</span></label>
                  <textarea value={settingsForm.description} onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })} placeholder="What is this template for?" rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm resize-none" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Store in Folder <span className="normal-case font-normal">(optional)</span></label>
                  <CustomSelect
                    value={folders.find(f => f.id === settingsForm.folderId) || { id: null, name: "Root (no folder)" }}
                    options={[{ id: null, name: "Root (no folder)" }, ...folders]}
                    onChange={(opt) => setSettingsForm({ ...settingsForm, folderId: opt.id })}
                    placeholder="Select folder..."
                    renderValue={(f) => <span className="flex items-center gap-2 text-sm"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>{f.name}</span>}
                    renderOption={(f) => <span className="flex items-center gap-2"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg><span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{f.name}</span></span>}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Notes <span className="normal-case font-normal">(optional)</span></label>
                  <textarea value={settingsForm.notes} onChange={(e) => setSettingsForm({ ...settingsForm, notes: e.target.value })} placeholder="Internal notes about this template..." rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Icon</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Object.keys(templateIcons).map(key => (
                        <button key={key} type="button" onClick={() => setSettingsForm({ ...settingsForm, icon: key })}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-200 ${settingsForm.icon === key ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shadow-sm shadow-accent" : "border-transparent bg-slate-50 dark:bg-slate-800 text-slate-400 hover:border-slate-200 dark:hover:border-slate-600 hover:text-slate-600 dark:hover:text-slate-300"}`}>
                          {templateIcons[key]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Category</label>
                    <CustomSelect
                      value={categoryOptions.find(c => c.value === settingsForm.category)}
                      options={categoryOptions}
                      onChange={(opt) => setSettingsForm({ ...settingsForm, category: opt.value })}
                      placeholder="Select category..."
                      renderValue={(c) => <span className="flex items-center gap-2 text-sm"><span>{c.icon}</span>{t(`forms.categories.${c.value}`)}</span>}
                      renderOption={(c) => <span className="flex items-center gap-2"><span>{c.icon}</span><span className="font-medium text-slate-700 dark:text-slate-200">{t(`forms.categories.${c.value}`)}</span></span>}
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
                <button onClick={() => handleSaveSettings(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium hover:bg-white dark:hover:bg-slate-800 transition-colors text-sm">
                  Save & Close
                </button>
                {createdTemplate?.schema?.documentId && (
                  <button onClick={() => handleSaveSettings(true)} className="flex-1 px-4 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white font-semibold shadow-lg shadow-accent transition-all text-sm flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Continue Editing
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTemplate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedTemplate(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    {templateIcons[selectedTemplate.icon] || templateIcons.document}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{selectedTemplate.title}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{selectedTemplate.description || "No description"}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${
                        selectedTemplate.schema?.type === 'document-template'
                          ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}>
                        {selectedTemplate.schema?.type === 'document-template' ? 'Document' : 'Schema'}
                      </span>
                      <span className="text-xs text-slate-400">{selectedTemplate.usageCount || 0} uses</span>
                      {selectedTemplate.category && <span className="text-xs text-slate-400 capitalize">{selectedTemplate.category}</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 space-y-2">
                {selectedTemplate.schema?.documentId && (
                  <button
                    onClick={() => openTemplateInEditor(selectedTemplate.id, 'edit')}
                    className="w-full p-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Document</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Open in editor to modify content</p>
                      </div>
                    </div>
                  </button>
                )}

                {selectedTemplate.schema?.documentId && (
                  <button
                    onClick={() => openTemplateInEditor(selectedTemplate.id, 'view')}
                    className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-600 dark:bg-slate-500 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">View Document</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Open read-only preview</p>
                      </div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => handleEditMeta(selectedTemplate)}
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0 group-hover:scale-105 transition-transform">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Metadata</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Change name, description, category</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => { handleUseTemplate(selectedTemplate); setSelectedTemplate(null); }}
                  className="w-full p-4 rounded-2xl border-2 border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:shadow-md text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Assign Task</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Create a new form and assign to users</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-center"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditMetaModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowEditMetaModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50 dark:border-slate-700/50" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Template</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Update template details</p>
                    </div>
                  </div>
                  <button onClick={() => setShowEditMetaModal(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div className="mx-6 my-3 border-t border-slate-100 dark:border-slate-800" />

              <div className="px-6 pb-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Template Name</label>
                  <input type="text" value={editMetaForm.title} onChange={(e) => setEditMetaForm({ ...editMetaForm, title: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:border-accent focus:ring-2 focus:ring-accent focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea value={editMetaForm.description} onChange={(e) => setEditMetaForm({ ...editMetaForm, description: e.target.value })} rows={3} placeholder="What is this template for?" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Icon</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Object.keys(templateIcons).map(key => (
                        <button key={key} type="button" onClick={() => setEditMetaForm({ ...editMetaForm, icon: key })}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-200 ${editMetaForm.icon === key ? "border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 shadow-sm shadow-accent" : "border-transparent bg-slate-50 dark:bg-slate-800 text-slate-400 hover:border-slate-200 dark:hover:border-slate-600 hover:text-slate-600 dark:hover:text-slate-300"}`}>
                          {templateIcons[key]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Category</label>
                    <CustomSelect
                      value={categoryOptions.find(c => c.value === editMetaForm.category)}
                      options={categoryOptions}
                      onChange={(opt) => setEditMetaForm({ ...editMetaForm, category: opt.value })}
                      placeholder="Select category..."
                      renderValue={(c) => <span className="flex items-center gap-2 text-sm"><span>{c.icon}</span>{t(`forms.categories.${c.value}`)}</span>}
                      renderOption={(c) => <span className="flex items-center gap-2"><span>{c.icon}</span><span className="font-medium text-slate-700 dark:text-slate-200">{t(`forms.categories.${c.value}`)}</span></span>}
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button onClick={() => setShowEditMetaModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium hover:bg-white dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                <button onClick={handleSaveMetaEdit} disabled={!editMetaForm.title} className="flex-1 px-4 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white font-semibold shadow-lg shadow-accent transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm.show && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={() => setDeleteConfirm({ show: false, type: null, id: null, name: '' })}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.15 }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200/50 dark:border-slate-700/50" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-1">
                  Delete {deleteConfirm.type === 'template' ? 'Template' : 'Form'}?
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-1">
                  Are you sure you want to delete
                </p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center mb-4 px-4 truncate">
                  "{deleteConfirm.name}"
                </p>
                <p className="text-xs text-rose-500 dark:text-rose-400 text-center bg-rose-50 dark:bg-rose-500/10 rounded-lg py-2 px-3">
                  This action cannot be undone.
                </p>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button onClick={() => setDeleteConfirm({ show: false, type: null, id: null, name: '' })} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium hover:bg-white dark:hover:bg-slate-800 transition-colors text-sm">
                  Cancel
                </button>
                <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-lg shadow-rose-500/25 transition-all text-sm flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {editorConfig && (
        <OnlyOfficeEditor
          key={`${editorDocId}_${editorMode}`}
          config={editorConfig}
          onClose={closeEditor}
          documentName={editorDocName}
          documentId={editorDocId}
          onSwitchToEdit={editorMode === 'view' && editorTemplateId ? () => openTemplateInEditor(editorTemplateId, 'edit') : undefined}
        />
      )}
    </DashboardLayout>
  );
}