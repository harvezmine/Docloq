import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import folderService from "@/services/folder.service";
import documentService from "@/services/document.service";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useLang } from "@/app/providers/LanguageProvider";

function buildTree(flat) {
  const map = {};
  const roots = [];
  flat.forEach((f) => { map[f.id] = { ...f, children: [] }; });
  flat.forEach((f) => {
    if (f.parentId && map[f.parentId]) map[f.parentId].children.push(map[f.id]);
    else roots.push(map[f.id]);
  });
  const sort = (nodes) => {
    nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return { roots, map };
}

function countAll(nodes) {
  return nodes.reduce((s, n) => s + 1 + countAll(n.children), 0);
}

function getMaxDepth(nodes, d = 1) {
  if (!nodes.length) return 0;
  return Math.max(...nodes.map((n) => (n.children.length ? getMaxDepth(n.children, d + 1) : d)));
}

function countEmpty(nodes) {
  return nodes.reduce((s, n) => s + ((n.documentCount || 0) === 0 ? 1 : 0) + countEmpty(n.children), 0);
}

function filterTree(nodes, q) {
  if (!q) return nodes;
  const lower = q.toLowerCase();
  return nodes.reduce((acc, node) => {
    const children = filterTree(node.children, q);
    if (node.name.toLowerCase().includes(lower) || children.length) {
      acc.push({ ...node, children });
    }
    return acc;
  }, []);
}

function getFileTypeLabel(mimeType, filename) {
  const ext = (filename || "").split(".").pop().toLowerCase();
  if (ext === "pdf" || mimeType?.includes("pdf")) return "PDF";
  if (["docx", "doc"].includes(ext) || mimeType?.includes("word")) return "DOCX";
  if (["xlsx", "xls"].includes(ext) || mimeType?.includes("sheet")) return "XLSX";
  if (["pptx", "ppt"].includes(ext) || mimeType?.includes("presentation")) return "PPTX";
  if (mimeType?.includes("image")) return "IMG";
  return ext.toUpperCase() || "FILE";
}

function getFileTypeColor(label) {
  const map = {
    PDF: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    DOCX: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    XLSX: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    PPTX: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    IMG: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  };
  return map[label] || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ChevronRight = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
);
const FolderIcon = ({ className = "w-4 h-4", style }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
);
const DocIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
);
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
);
const TrashIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);
const EditIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
);
const DownloadIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
);
const ExternalLinkIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
);
const SearchIcon = () => (
  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const XIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
);
const SpinnerIcon = ({ className = "w-5 h-5" }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
);

// Recursive tree node; supports drag & drop.
function FolderTreeItem({ folder, depth = 0, expanded, onToggle, onAddSub, onDelete, onRename, onViewDocs, onOpenInDocuments, dragItem, dropTargetId, onDragStart, onDragEnd, onDragEnterFolder, onDragLeaveFolder, onDropOnFolder }) {
  const { t } = useLang();
  const hasChildren = folder.children?.length > 0;
  const isExpanded = expanded.has(folder.id);
  const docCount = folder.documentCount || 0;
  const color = folder.color || "#6366f1";
  const isDragging = dragItem && dragItem.id === folder.id;
  const isDropTarget = dropTargetId === folder.id;

  return (
    <div className={`transition-all duration-200 ${isDragging ? "opacity-40 scale-[0.97]" : ""}`}>
      <div
        className={`relative group flex items-center gap-2 py-2.5 pr-3 rounded-xl transition-all duration-200 cursor-grab active:cursor-grabbing ${isDropTarget ? "bg-indigo-50 dark:bg-indigo-500/10 ring-2 ring-indigo-500 ring-inset shadow-md shadow-accent" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"} ${isExpanded && !isDropTarget ? "bg-slate-50/50 dark:bg-slate-800/30" : ""}`}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(e, folder);
        }}
        onDragEnd={(e) => { e.stopPropagation(); onDragEnd(); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); onDragEnterFolder(folder.id); }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) onDragLeaveFolder();
        }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropOnFolder(folder.id); }}
      >
        <button
          draggable="false"
          onClick={(e) => { e.stopPropagation(); hasChildren && onToggle(folder.id); }}
          className={`w-5 h-5 flex items-center justify-center rounded transition-all flex-shrink-0 ${hasChildren ? "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" : "invisible"}`}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
        </button>

        <div draggable="false" className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
          <FolderIcon style={{ color }} className="w-4 h-4" />
        </div>

        <div draggable="false" className="flex-1 min-w-0 cursor-pointer" onClick={() => hasChildren ? onToggle(folder.id) : onViewDocs(folder)}>
          <span className="text-sm font-medium text-slate-900 dark:text-white truncate block">{folder.name}</span>
          {folder.description && <span className="text-[11px] text-slate-400 truncate block">{folder.description}</span>}
        </div>

        {docCount > 0 && (
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 font-semibold flex-shrink-0" title={`${docCount} ${docCount > 1 ? t("folders.docCountTitlePlural") : t("folders.docCountTitleSingular")}`}>
            {docCount}
          </span>
        )}

        {hasChildren && (
          <span className="px-1.5 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 flex-shrink-0">
            {folder.children.length}
          </span>
        )}

        <div draggable="false" className={`flex items-center gap-0.5 transition-opacity flex-shrink-0 ${dragItem ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"}`}>
          <button draggable="false" onClick={(e) => { e.stopPropagation(); onViewDocs(folder); }} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title={t("folders.titleViewDocuments")}>
            <DocIcon />
          </button>
          <button draggable="false" onClick={(e) => { e.stopPropagation(); onOpenInDocuments(folder.id); }} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title={t("folders.titleOpenInDocuments")}>
            <ExternalLinkIcon />
          </button>
          <button draggable="false" onClick={(e) => { e.stopPropagation(); onAddSub(folder.id); }} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title={t("folders.titleAddSubfolder")}>
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
          <button draggable="false" onClick={(e) => { e.stopPropagation(); onRename(folder); }} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors" title={t("folders.titleRename")}>
            <EditIcon />
          </button>
          <button draggable="false" onClick={(e) => { e.stopPropagation(); onDelete(folder.id, folder.name); }} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title={t("folders.titleDelete")}>
            <TrashIcon />
          </button>
        </div>

        {isDropTarget && dragItem && dragItem.id !== folder.id && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold shadow-lg pointer-events-none z-10">
            {t("folders.dropHere")}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {folder.children.map((child) => (
              <FolderTreeItem
                key={child.id}
                folder={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onAddSub={onAddSub}
                onDelete={onDelete}
                onRename={onRename}
                onViewDocs={onViewDocs}
                onOpenInDocuments={onOpenInDocuments}
                dragItem={dragItem}
                dropTargetId={dropTargetId}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragEnterFolder={onDragEnterFolder}
                onDragLeaveFolder={onDragLeaveFolder}
                onDropOnFolder={onDropOnFolder}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FolderHierarchy() {
  const { t } = useLang();
  const navigate = useNavigate();

  const [flatFolders, setFlatFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState(new Set());

  const [showAddModal, setShowAddModal] = useState(false);
  const [addParentId, setAddParentId] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6366f1");

  // Custom modal, replaces native window.confirm().
  const [confirmState, setConfirmState] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const runConfirm = useCallback(async () => {
    if (!confirmState?.onConfirm) return;
    setConfirmLoading(true);
    try { await confirmState.onConfirm(); setConfirmState(null); }
    finally { setConfirmLoading(false); }
  }, [confirmState]);

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameName, setRenameName] = useState("");

  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderDocs, setFolderDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  const FOLDER_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"];

  const fetchFolders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await folderService.getAllFolders();
      setFlatFolders(res.data || []);
      setError(null);
    } catch (err) {
      setError(t("folders.loadError"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const { roots: tree, map: folderMap } = useMemo(() => buildTree(flatFolders), [flatFolders]);
  const filteredTree = useMemo(() => filterTree(tree, searchQuery), [tree, searchQuery]);

  const stats = useMemo(() => ({
    rootFolders: tree.length,
    totalFolders: flatFolders.length,
    maxDepth: tree.length ? getMaxDepth(tree) : 0,
    emptyFolders: countEmpty(tree),
    totalDocs: flatFolders.reduce((s, f) => s + (f.documentCount || 0), 0),
  }), [tree, flatFolders]);

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const expandAll = () => setExpanded(new Set(flatFolders.map((f) => f.id)));
  const collapseAll = () => setExpanded(new Set());

  const handleCreate = async () => {
    if (!newFolderName.trim() || actionLoading) return;
    try {
      setActionLoading(true);
      await folderService.createFolder({ name: newFolderName.trim(), parentId: addParentId, color: newFolderColor });
      if (addParentId) setExpanded((prev) => new Set([...prev, addParentId]));
      setShowAddModal(false);
      setAddParentId(null);
      setNewFolderName("");
      setNewFolderColor("#6366f1");
      await fetchFolders();
    } catch (err) {
      console.error("Create folder error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (id, name) => {
    setConfirmState({
      title: t("docs.confirmDeleteFolderTitle"),
      message: `${t("docs.confirmDeleteFolderMessagePrefix")}${name}${t("docs.confirmDeleteFolderMessageSuffix")}`,
      confirmLabel: t("docs.confirmDeleteFolderConfirm"),
      variant: "danger",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await folderService.deleteFolder(id);
          await fetchFolders();
        } catch (err) {
          console.error("Delete folder error:", err);
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const openRename = (folder) => {
    setRenameTarget(folder);
    setRenameName(folder.name);
    setShowRenameModal(true);
  };

  const handleRename = async () => {
    if (!renameName.trim() || !renameTarget || actionLoading) return;
    try {
      setActionLoading(true);
      await folderService.updateFolder(renameTarget.id, { name: renameName.trim() });
      setShowRenameModal(false);
      setRenameTarget(null);
      setRenameName("");
      await fetchFolders();
    } catch (err) {
      console.error("Rename folder error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDocs = async (folder) => {
    setSelectedFolder(folder);
    setShowDocsModal(true);
    setDocsLoading(true);
    setFolderDocs([]);
    try {
      const res = await folderService.getFolder(folder.id);
      setFolderDocs(res.data?.documents || []);
    } catch (err) {
      console.error("Fetch docs error:", err);
      setFolderDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      await documentService.downloadDocument(doc.id, doc.originalFilename);
    } catch {
      setError(t("folders.downloadDocError"));
    }
  };

  const openInDocuments = (folderId) => {
    navigate(`/documents?folder=${folderId}`);
  };

  const [dragItem, setDragItem] = useState(null);          // { id, data }
  const [dropTargetId, setDropTargetId] = useState(null);  // folder id being hovered
  const [dragToast, setDragToast] = useState(null);        // { msg, type }
  const dragGhostRef = useRef(null);
  const dragItemRef = useRef(null);

  const showDragToast = useCallback((msg, type = "success") => {
    setDragToast({ msg, type });
    setTimeout(() => setDragToast(null), 2500);
  }, []);

  const createDragGhost = useCallback((label) => {
    if (dragGhostRef.current) { document.body.removeChild(dragGhostRef.current); dragGhostRef.current = null; }
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-1000px;left:-1000px;padding:8px 14px;background:#4f46e5;color:#fff;border-radius:12px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;box-shadow:0 8px 24px rgba(0,0,0,.25);white-space:nowrap;z-index:9999;max-width:220px;overflow:hidden;text-overflow:ellipsis;";
    ghost.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg><span style="overflow:hidden;text-overflow:ellipsis">${label}</span>`;
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    return ghost;
  }, []);

  const removeDragGhost = useCallback(() => {
    if (dragGhostRef.current) { document.body.removeChild(dragGhostRef.current); dragGhostRef.current = null; }
  }, []);

  const handleDragStart = useCallback((e, folder) => {
    const item = { id: folder.id, data: folder };
    setDragItem(item);
    dragItemRef.current = item;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "folder", id: folder.id }));
    const ghost = createDragGhost(folder.name || "Folder");
    e.dataTransfer.setDragImage(ghost, 24, 24);
    // Collapse the folder being dragged if expanded
    if (expanded.has(folder.id)) {
      setExpanded((prev) => { const next = new Set(prev); next.delete(folder.id); return next; });
    }
  }, [createDragGhost, expanded]);

  const handleDragEnd = useCallback(() => {
    setDragItem(null);
    dragItemRef.current = null;
    setDropTargetId(null);
    removeDragGhost();
  }, [removeDragGhost]);

  const handleDragEnterFolder = useCallback((folderId) => {
    setDropTargetId(folderId);
  }, []);

  const handleDragLeaveFolder = useCallback(() => {
    setDropTargetId(null);
  }, []);

  const handleDropOnFolder = useCallback(async (targetFolderId) => {
    setDropTargetId(null);
    const item = dragItemRef.current;
    if (!item || item.id === targetFolderId) return;

    try {
      setActionLoading(true);
      await folderService.moveFolder(item.id, targetFolderId);
      showDragToast(`"${item.data?.name}" ${t("folders.movedSuffix")}`);
      await fetchFolders();
      // Auto-expand parent to show the moved folder
      if (targetFolderId) setExpanded((prev) => new Set([...prev, targetFolderId]));
    } catch (err) {
      console.error("Move folder error:", err);
      showDragToast(err?.response?.data?.message || t("docs.moveFailed"), "error");
    } finally {
      setActionLoading(false);
      setDragItem(null);
      dragItemRef.current = null;
      removeDragGhost();
    }
  }, [showDragToast, fetchFolders, removeDragGhost]);

  // Lock scroll on modal
  useEffect(() => {
    const open = showAddModal || showRenameModal || showDocsModal;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showAddModal, showRenameModal, showDocsModal]);

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow={t("folders.eyebrow")}
        title={t("folders.title")}
        subtitle={t("folders.subtitle")}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: t("folders.statRootFolders"), value: stats.rootFolders, color: "from-indigo-500 to-purple-600", icon: <FolderIcon className="w-5 h-5" /> },
          { label: t("folders.statTotalFolders"), value: stats.totalFolders, color: "from-emerald-500 to-teal-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
          { label: t("folders.statMaxDepth"), value: stats.maxDepth, color: "from-amber-500 to-orange-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
          { label: t("folders.statEmptyFolders"), value: stats.emptyFolders, color: "from-rose-500 to-pink-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg> },
          { label: t("folders.statTotalDocuments"), value: stats.totalDocs, color: "from-cyan-500 to-blue-600", icon: <DocIcon className="w-5 h-5" /> },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="p-4" hover>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white flex-shrink-0`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="relative">
          <SearchIcon />
          <input
            type="text"
            placeholder={t("folders.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          {flatFolders.length > 0 && (
            <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button onClick={expandAll} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all" title={t("folders.expandAll")}>
                {t("folders.expand")}
              </button>
              <button onClick={collapseAll} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all" title={t("folders.collapseAll")}>
                {t("folders.collapse")}
              </button>
            </div>
          )}
          <button
            onClick={() => { setAddParentId(null); setShowAddModal(true); }}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-accent-gradient hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-accent hover:shadow-accent transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{t("folders.addRootFolder")}</span>
            <span className="sm:hidden">{t("folders.add")}</span>
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("folders.folderStructure")}</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {filteredTree.length} {filteredTree.length !== 1 ? t("folders.rootFolderSuffixPlural") : t("folders.rootFolderSuffixSingular")}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <SpinnerIcon className="w-8 h-8 text-indigo-500" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-500 mb-3">{error}</p>
              <Button onClick={fetchFolders}>{t("common.retry")}</Button>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <FolderIcon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                {searchQuery ? t("folders.noFoldersMatch") : t("folders.noFoldersYet")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {searchQuery ? t("folders.tryDifferentSearch") : t("folders.createToStart")}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => { setAddParentId(null); setShowAddModal(true); }}
                  className="px-4 py-2 rounded-xl bg-accent-gradient hover:brightness-110 text-white text-sm font-medium transition-colors"
                >
                  {t("folders.createFirstFolder")}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {dragItem && (
                <div
                  className={`flex items-center gap-2 py-2 px-3 rounded-xl border-2 border-dashed mb-2 transition-all duration-200 ${dropTargetId === "root" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-300 dark:border-slate-600"}`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; }}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDropTargetId("root"); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTargetId(null); }}
                  onDrop={async (e) => {
                    e.preventDefault(); e.stopPropagation();
                    setDropTargetId(null);
                    const item = dragItemRef.current;
                    if (!item) return;
                    try {
                      setActionLoading(true);
                      await folderService.moveFolder(item.id, null);
                      showDragToast(`"${item.data?.name}" ${t("folders.movedToRootSuffix")}`);
                      await fetchFolders();
                    } catch (err) {
                      showDragToast(err?.response?.data?.message || t("docs.moveFailed"), "error");
                    } finally {
                      setActionLoading(false);
                      setDragItem(null); dragItemRef.current = null; removeDragGhost();
                    }
                  }}
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t("folders.dropToRoot")}</span>
                </div>
              )}
              {filteredTree.map((folder) => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  onAddSub={(parentId) => { setAddParentId(parentId); setShowAddModal(true); }}
                  onDelete={handleDelete}
                  onRename={openRename}
                  onViewDocs={handleViewDocs}
                  onOpenInDocuments={openInDocuments}
                  dragItem={dragItem}
                  dropTargetId={dropTargetId}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragEnterFolder={handleDragEnterFolder}
                  onDragLeaveFolder={handleDragLeaveFolder}
                  onDropOnFolder={handleDropOnFolder}
                />
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {addParentId ? t("folders.addSubfolder") : t("folders.addRootFolder")}
                </h2>
                <button onClick={() => { setShowAddModal(false); setAddParentId(null); setNewFolderName(""); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <XIcon />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("docs.folderName")}</label>
                  <input
                    type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder={t("docs.folderNamePlaceholder")}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                    autoFocus onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("docs.color")}</label>
                  <div className="flex gap-2 flex-wrap">
                    {FOLDER_COLORS.map((c) => (
                      <button key={c} onClick={() => setNewFolderColor(c)}
                        className={`w-8 h-8 rounded-lg transition-all ${newFolderColor === c ? "ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900 scale-110" : "hover:scale-105"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>

                {addParentId && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t("folders.addingSubfolderTo")} <span className="font-semibold text-slate-900 dark:text-white">{folderMap[addParentId]?.name || t("folders.unknown")}</span>
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowAddModal(false); setAddParentId(null); setNewFolderName(""); }}>
                    {t("common.cancel")}
                  </Button>
                  <Button className="flex-1" onClick={handleCreate} disabled={!newFolderName.trim() || actionLoading}>
                    {actionLoading ? <SpinnerIcon className="w-4 h-4" /> : t("folders.createFolder")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRenameModal && renameTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("docs.renameFolder")}</h2>
                <button onClick={() => { setShowRenameModal(false); setRenameTarget(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <XIcon />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("docs.newName")}</label>
                  <input
                    type="text" value={renameName} onChange={(e) => setRenameName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                    autoFocus onKeyDown={(e) => e.key === "Enter" && handleRename()}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowRenameModal(false); setRenameTarget(null); }}>
                    {t("common.cancel")}
                  </Button>
                  <Button className="flex-1" onClick={handleRename} disabled={!renameName.trim() || renameName.trim() === renameTarget.name || actionLoading}>
                    {actionLoading ? <SpinnerIcon className="w-4 h-4" /> : t("common.rename")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDocsModal && selectedFolder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 max-h-[80vh] overflow-hidden flex flex-col">

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${selectedFolder.color || "#6366f1"}20` }}>
                    <FolderIcon className="w-5 h-5" style={{ color: selectedFolder.color || "#6366f1" }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedFolder.name}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {docsLoading ? t("folders.loadingEllipsis") : `${folderDocs.length} ${folderDocs.length !== 1 ? t("folders.documentsCountPlural") : t("folders.documentsCountSingular")}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openInDocuments(selectedFolder.id)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-colors" title={t("folders.openInDocumentsPageTitle")}>
                    <ExternalLinkIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setShowDocsModal(false); setSelectedFolder(null); setFolderDocs([]); }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    <XIcon />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {docsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <SpinnerIcon className="w-6 h-6 text-indigo-500" />
                  </div>
                ) : folderDocs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                      <DocIcon className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">{t("folders.noDocuments")}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t("folders.folderEmpty")}</p>
                    <button onClick={() => openInDocuments(selectedFolder.id)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                      {t("folders.openInDocumentsToUpload")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {folderDocs.map((doc, idx) => {
                      const typeLabel = getFileTypeLabel(doc.mimeType, doc.originalFilename);
                      return (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${getFileTypeColor(typeLabel)}`}>
                            {typeLabel}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{doc.originalFilename}</p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>{formatFileSize(doc.fileSize)}</span>
                              <span>·</span>
                              <span>{formatDate(doc.createdAt)}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-all"
                            title={t("folders.titleDownload")}
                          >
                            <DownloadIcon />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => openInDocuments(selectedFolder.id)}>
                  {t("folders.openInDocuments")}
                </Button>
                <Button className="flex-1" onClick={() => { setShowDocsModal(false); setSelectedFolder(null); setFolderDocs([]); }}>
                  {t("common.close")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dragToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 ${dragToast.type === "error" ? "bg-red-600 text-white" : "bg-slate-900 dark:bg-white text-white dark:text-slate-900"}`}
          >
            {dragToast.type === "error" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            )}
            {dragToast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dragItem && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium shadow-2xl flex items-center gap-2 pointer-events-none"
          >
            <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            {t("folders.dropOnFolderToMove")} "{dragItem.data?.name || t("folders.folderFallback")}"
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title || ""}
        message={confirmState?.message || ""}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        loading={confirmLoading}
        onConfirm={runConfirm}
        onCancel={() => !confirmLoading && setConfirmState(null)}
      />
    </DashboardLayout>
  );
}
