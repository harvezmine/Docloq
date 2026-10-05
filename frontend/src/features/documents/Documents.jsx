import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { useDebounce } from "@/hooks/useDebounce";
import documentService from "@/services/document.service";
import folderService from "@/services/folder.service";
import OnlyOfficeEditor from "@/components/onlyoffice/OnlyOfficeEditor";
import CommentModal from "@/components/documents/CommentModal";
import ShareModal from "@/features/documents/ShareModal";
import { Share2 } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import blockchainService from "@/services/blockchain.service";
import osintService from "@/services/osint.service";
import useAuthStore from "@/app/store/auth.store";
import useFeatureFlags from "@/app/store/featureFlags.store";
import { useTheme } from "@/app/providers/ThemeProvider";
import { useLang } from "@/app/providers/LanguageProvider";

function getFileTypeFromMime(mimeType) {
  if (!mimeType) return "document";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("word") || mimeType.includes("document")) return "docx";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "xlsx";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "pptx";
  if (mimeType.includes("image")) return "image";
  if (mimeType.includes("text")) return "txt";
  return "document";
}

const FileIconPdf = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" fill="#EF4444" opacity="0.15" />
    <path d="M14 2l6 6h-4a2 2 0 01-2-2V2z" fill="#EF4444" opacity="0.3" />
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" stroke="#EF4444" strokeWidth="1.5" fill="none" />
    <text x="7" y="17" fontSize="6" fontWeight="700" fill="#EF4444" fontFamily="system-ui">PDF</text>
  </svg>
);
const FileIconDocx = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" fill="#3B82F6" opacity="0.15" />
    <path d="M14 2l6 6h-4a2 2 0 01-2-2V2z" fill="#3B82F6" opacity="0.3" />
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" stroke="#3B82F6" strokeWidth="1.5" fill="none" />
    <text x="5.5" y="17" fontSize="5.5" fontWeight="700" fill="#3B82F6" fontFamily="system-ui">DOC</text>
  </svg>
);
const FileIconXlsx = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" fill="#22C55E" opacity="0.15" />
    <path d="M14 2l6 6h-4a2 2 0 01-2-2V2z" fill="#22C55E" opacity="0.3" />
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" stroke="#22C55E" strokeWidth="1.5" fill="none" />
    <text x="5.5" y="17" fontSize="5.5" fontWeight="700" fill="#22C55E" fontFamily="system-ui">XLS</text>
  </svg>
);
const FileIconPptx = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" fill="#F97316" opacity="0.15" />
    <path d="M14 2l6 6h-4a2 2 0 01-2-2V2z" fill="#F97316" opacity="0.3" />
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" stroke="#F97316" strokeWidth="1.5" fill="none" />
    <text x="5.5" y="17" fontSize="5.5" fontWeight="700" fill="#F97316" fontFamily="system-ui">PPT</text>
  </svg>
);
const FileIconImage = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" fill="#8B5CF6" opacity="0.15" />
    <path d="M14 2l6 6h-4a2 2 0 01-2-2V2z" fill="#8B5CF6" opacity="0.3" />
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" stroke="#8B5CF6" strokeWidth="1.5" fill="none" />
    <circle cx="9" cy="13" r="1.5" fill="#8B5CF6" opacity="0.6" />
    <path d="M7 18l3-4 2 2 3-4 2 6H7z" fill="#8B5CF6" opacity="0.4" />
  </svg>
);
const FileIconTxt = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" fill="#64748B" opacity="0.15" />
    <path d="M14 2l6 6h-4a2 2 0 01-2-2V2z" fill="#64748B" opacity="0.3" />
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" stroke="#64748B" strokeWidth="1.5" fill="none" />
    <text x="5.5" y="17" fontSize="5.5" fontWeight="700" fill="#64748B" fontFamily="system-ui">TXT</text>
  </svg>
);
const FileIconGeneric = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" fill="#6366F1" opacity="0.15" />
    <path d="M14 2l6 6h-4a2 2 0 01-2-2V2z" fill="#6366F1" opacity="0.3" />
    <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6z" stroke="#6366F1" strokeWidth="1.5" fill="none" />
    <path d="M8 13h8M8 16h5" stroke="#6366F1" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
  </svg>
);

const FILE_ICON_COMPONENTS = { pdf: FileIconPdf, docx: FileIconDocx, xlsx: FileIconXlsx, pptx: FileIconPptx, image: FileIconImage, txt: FileIconTxt };
const getFileIcon = (type, className) => {
  const Icon = FILE_ICON_COMPONENTS[type] || FileIconGeneric;
  return <Icon className={className} />;
};

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatTimeAgo(dateString) {
  if (!dateString) return "Unknown";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diffMs / 86400000);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const FOLDER_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"];
const FILE_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word" },
  { value: "xlsx", label: "Excel" },
  { value: "pptx", label: "PowerPoint" },
  { value: "image", label: "Image" },
];

const IconDoc = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconUpload = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);
const IconFolder = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);
const IconSearch = () => (
  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IconChevDown = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const IconChevRight = () => (
  <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const IconX = ({ className = "w-4 h-4 text-slate-500" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconCheck = ({ className = "w-5 h-5 text-white" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
const IconEye = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const IconEdit = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IconMessage = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
const IconDownload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);
const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconFolderSolid = ({ color = "#6366f1" }) => (
  <svg className="w-6 h-6" style={{ color }} fill="currentColor" viewBox="0 0 24 24">
    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
  </svg>
);
const IconHome = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
  </svg>
);
const IconGrid = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const IconList = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const IconShield = () => (
  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const IconLock = () => (
  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const IconCloud = () => (
  <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);
const IconFolderMove = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);
const IconFolderOutline = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);
const IconInfo = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconChain = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);
const IconVerified = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

function getDownloadFormats(mimeType, t) {
  const type = getFileTypeFromMime(mimeType);
  let original;
  if (type === 'image') {
    original = mimeType?.includes('jpeg') || mimeType?.includes('jpg') ? 'jpg' : 'png';
  } else {
    original = { docx: 'docx', xlsx: 'xlsx', pptx: 'pptx', pdf: 'pdf', txt: 'txt' }[type] || 'docx';
  }

  const base = [
    { format: original, label: original.toUpperCase(), desc: t('docs.formatDesc.original'), fileType: type },
  ];

  const allExtras = {
    docx: [
      { format: 'pdf',  label: 'PDF',  desc: t('docs.formatDesc.portable'), fileType: 'pdf' },
      { format: 'png',  label: 'PNG',  desc: t('docs.formatDesc.image'),       fileType: 'image' },
      { format: 'jpg',  label: 'JPG',  desc: t('docs.formatDesc.compressed'),   fileType: 'image' },
    ],
    xlsx: [
      { format: 'pdf',  label: 'PDF',  desc: t('docs.formatDesc.portable'), fileType: 'pdf' },
      { format: 'csv',  label: 'CSV',  desc: t('docs.formatDesc.csv'),   fileType: 'xlsx' },
      { format: 'png',  label: 'PNG',  desc: t('docs.formatDesc.image'),       fileType: 'image' },
      { format: 'jpg',  label: 'JPG',  desc: t('docs.formatDesc.compressed'),   fileType: 'image' },
    ],
    pptx: [
      { format: 'pdf',  label: 'PDF',  desc: t('docs.formatDesc.portable'), fileType: 'pdf' },
      { format: 'png',  label: 'PNG',  desc: t('docs.formatDesc.image'),       fileType: 'image' },
      { format: 'jpg',  label: 'JPG',  desc: t('docs.formatDesc.compressed'),   fileType: 'image' },
    ],
    pdf: [
      { format: 'docx', label: 'DOCX', desc: t('docs.formatDesc.word'),     fileType: 'docx' },
      { format: 'png',  label: 'PNG',  desc: t('docs.formatDesc.image'),       fileType: 'image' },
      { format: 'jpg',  label: 'JPG',  desc: t('docs.formatDesc.compressed'),   fileType: 'image' },
    ],
    image: [
      { format: 'pdf',  label: 'PDF',  desc: t('docs.formatDesc.portable'), fileType: 'pdf' },
      { format: 'jpg',  label: 'JPG',  desc: t('docs.formatDesc.compressed'),   fileType: 'image' },
      { format: 'png',  label: 'PNG',  desc: t('docs.formatDesc.image'),       fileType: 'image' },
    ],
    txt: [
      { format: 'pdf',  label: 'PDF',  desc: t('docs.formatDesc.portable'), fileType: 'pdf' },
      { format: 'docx', label: 'DOCX', desc: t('docs.formatDesc.word'),     fileType: 'docx' },
    ],
  };

  const extras = (allExtras[type] || [{ format: 'pdf', label: 'PDF', desc: t('docs.formatDesc.portable'), fileType: 'pdf' }])
    .filter((e) => e.format !== original); // remove duplicate of the original format
  return [...base, ...extras];
}

function DownloadDropdown({ doc, variant = "icon" }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [converting, setConverting] = useState(null);
  const [toast, setToast] = useState(null); // { type: "success"|"error", msg }
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const btnRef = useRef(null);
  const formats = getDownloadFormats(doc.mimeType, t);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleMenu = (e) => {
    if (e) e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuH = formats.length * 36 + 40;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < menuH + 8;
      setMenuPos({
        top: openUpwards ? rect.top - menuH - 4 : rect.bottom + 4,
        left: Math.min(rect.right - 220, window.innerWidth - 230),
      });
    }
    setOpen(!open);
  };

  const handleDownload = async (fmt) => {
    setConverting(fmt.format);
    try {
      if (fmt === formats[0]) {
        await documentService.downloadDocument(doc.id, doc.originalFilename);
      } else {
        await documentService.downloadDocumentAs(doc.id, doc.originalFilename, fmt.format);
      }
      const baseName = doc.originalFilename.replace(/\.[^.]+$/, '');
      setToast({ type: "success", msg: `${baseName}.${fmt.format} ${t("docs.download.downloadedSuffix")}` });
    } catch (err) {
      console.error("Download error:", err);
      setToast({ type: "error", msg: err?.response?.data?.message || err.message || t("docs.download.genericFailed") });
    } finally {
      setConverting(null);
      setOpen(false);
    }
  };

  const menuContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 4, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-56 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 pb-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("docs.download.as")}</p>
          {formats.map((fmt) => (
            <button key={fmt.format} onClick={(e) => { e.stopPropagation(); handleDownload(fmt); }} disabled={!!converting}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50 text-left">
              <span className="w-5 h-5 flex-shrink-0">{getFileIcon(fmt.fileType, "w-5 h-5")}</span>
              <span className="flex-1">
                <span className="font-medium text-slate-700 dark:text-slate-200">{fmt.label}</span>
                <span className="block text-[11px] text-slate-400 dark:text-slate-500">{fmt.desc}</span>
              </span>
              {converting === fmt.format && <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Toast notification (fixed position, rendered from each instance)
  const toastElement = (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000 }}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md ${
            toast.type === "success"
              ? "bg-emerald-50/95 dark:bg-emerald-900/80 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50/95 dark:bg-red-900/80 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {toast.type === "success" ? (
            <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{toast.type === "success" ? t("docs.download.complete") : t("docs.download.failed")}</p>
            <p className="text-xs opacity-75 truncate max-w-[280px]">{toast.msg}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setToast(null); }} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (variant === "button") {
    return (
      <div className="relative">
        <button ref={btnRef} onClick={toggleMenu}
          className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
          <IconDownload /> {t("common.download")}
          <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {menuContent}
        {toastElement}
      </div>
    );
  }

  // Default: compact icon button (for grid/list views)
  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggleMenu}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors" title={t("common.download")}>
        <IconDownload />
      </button>
      {menuContent}
      {toastElement}
    </div>
  );
}

export default function Documents() {
  const { t } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [filterType, setFilterType] = useState("all");
  const [openDropdown, setOpenDropdown] = useState(null);

  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);

  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [renamingDoc, setRenamingDoc] = useState(false);
  const [renameDocValue, setRenameDocValue] = useState("");
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);

  const [uploadStep, setUploadStep] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [realFiles, setRealFiles] = useState([]);
  const [isUploadingReal, setIsUploadingReal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState([]);

  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6366f1");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const [showOnlyOffice, setShowOnlyOffice] = useState(false);
  const [onlyOfficeConfig, setOnlyOfficeConfig] = useState(null);
  const [onlyOfficeDoc, setOnlyOfficeDoc] = useState(null);
  const [onlyOfficeLockInfo, setOnlyOfficeLockInfo] = useState(null);

  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [commentingDocument, setCommentingDocument] = useState(null);

  const [saveToast, setSaveToast] = useState(null);

  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const [viewerDoc, setViewerDoc] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  useEffect(() => {
    if (!viewerDoc) { setViewerUrl(null); return; }
    let revoked = false;
    let url = null;
    setViewerLoading(true);
    documentService.getFileBlobUrl(viewerDoc.id, viewerDoc.mimeType)
      .then((u) => { if (revoked) { window.URL.revokeObjectURL(u); return; } url = u; setViewerUrl(u); })
      .catch(() => setToast({ type: "error", msg: t("docs.toastLoadPreviewFailed") }))
      .finally(() => setViewerLoading(false));
    return () => { revoked = true; if (url) window.URL.revokeObjectURL(url); };
  }, [viewerDoc]);

  // Replaces window.confirm with a styled modal
  const [confirmState, setConfirmState] = useState(null); // { title, message, confirmLabel, variant, onConfirm }
  const [confirmLoading, setConfirmLoading] = useState(false);
  const askConfirm = useCallback((opts) => setConfirmState(opts), []);
  const runConfirm = useCallback(async () => {
    if (!confirmState?.onConfirm) return;
    setConfirmLoading(true);
    try { await confirmState.onConfirm(); setConfirmState(null); }
    finally { setConfirmLoading(false); }
  }, [confirmState]);

  const [showBlockchainDetails, setShowBlockchainDetails] = useState(false);
  const [blockchainAnchor, setBlockchainAnchor] = useState(null);
  const [blockchainLoading, setBlockchainLoading] = useState(false);
  const [blockchainAction, setBlockchainAction] = useState(null); // 'anchor' | 'verify' | null
  const [blockchainResult, setBlockchainResult] = useState(null);
  const userRole = useAuthStore((s) => s.user?.role);
  const canBlockchain = userRole === 'owner'; // blockchain is an owner-only feature
  const blockchainEnabled = useFeatureFlags((s) => s.features.blockchain); // per-tenant feature flag

  const [trackingLoading, setTrackingLoading] = useState(false);
  const trackingFeature = useFeatureFlags((s) => s.features.osint);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const canTrack = (doc) => trackingFeature && doc && (userRole === 'owner' || userRole === 'admin' || doc.ownerId === currentUserId);

  const [qrDownloadLoading, setQrDownloadLoading] = useState(false);
  const qrFeature = useFeatureFlags((s) => s.features.qr);
  const canQrDownload = (doc) => qrFeature && doc && (userRole === 'owner' || userRole === 'admin' || doc.ownerId === currentUserId);
  const { theme } = useTheme();

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingDocument, setMovingDocument] = useState(null);

  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState("");

  const [dragItem, setDragItem] = useState(null);           // { type: 'document'|'folder', id, data }
  const [dropTargetId, setDropTargetId] = useState(null);   // folder id being hovered
  const [containerDragOver, setContainerDragOver] = useState(false); // Google-Drive-style overlay
  const hoverTimerRef = useRef(null);                        // timer for auto-navigate into folder
  const [dragToast, setDragToast] = useState(null);          // transient success/error toast
  const dragGhostRef = useRef(null);                         // custom drag image element
  const dragItemRef = useRef(null);                          // stable ref for current dragItem
  const containerDragCounter = useRef(0);                    // track enter/leave for overlay
  const currentFolderIdRef = useRef(currentFolderId);        // stable ref for container drop
  currentFolderIdRef.current = currentFolderId;              // keep in sync

  const [externalDragOver, setExternalDragOver] = useState(false);
  const externalDragCounter = useRef(0);
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const [directUploadProgress, setDirectUploadProgress] = useState(0);
  const [directUploadResults, setDirectUploadResults] = useState([]);
  const [showDirectUploadToast, setShowDirectUploadToast] = useState(false);

  const showDragToast = useCallback((msg, type = "success") => {
    setDragToast({ msg, type });
    setTimeout(() => setDragToast(null), 2500);
  }, []);

  const createDragGhost = useCallback((label, itemType = "document") => {
    if (dragGhostRef.current) { document.body.removeChild(dragGhostRef.current); dragGhostRef.current = null; }
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-1000px;left:-1000px;padding:8px 14px;background:#4f46e5;color:#fff;border-radius:12px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;box-shadow:0 8px 24px rgba(0,0,0,.25);white-space:nowrap;z-index:9999;max-width:220px;overflow:hidden;text-overflow:ellipsis;";
    const iconSvg = itemType === "folder"
      ? '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>'
      : '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>';
    ghost.innerHTML = `${iconSvg}<span style="overflow:hidden;text-overflow:ellipsis">${label}</span>`;
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    return ghost;
  }, []);

  const removeDragGhost = useCallback(() => {
    if (dragGhostRef.current) { document.body.removeChild(dragGhostRef.current); dragGhostRef.current = null; }
  }, []);

  const startDrag = useCallback((e, type, id, data) => {
    const item = { type, id, data };
    setDragItem(item);
    dragItemRef.current = item;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
    const label = type === "folder" ? (data.name || "Folder") : (data.originalFilename || "Document");
    const ghost = createDragGhost(label, type);
    e.dataTransfer.setDragImage(ghost, 24, 24);
  }, [createDragGhost]);

  // After ~1s hovering a folder, auto-navigate into it (Google Drive style) so dragging can continue into subfolders
  const handleFolderDragEnter = useCallback((folderId) => {
    setDropTargetId(folderId);
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      const cur = dragItemRef.current;
      if (cur) {
        if (cur.type === "folder" && cur.id === folderId) return;
        navigateToFolder(folderId);
        setDropTargetId(null);
        containerDragCounter.current = 0;
        setContainerDragOver(false);
      }
    }, 1000);
  }, []);

  const handleFolderDragLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setDropTargetId(null);
  }, []);

  const hasExternalFiles = useCallback((e) => {
    if (e.dataTransfer?.types) {
      return e.dataTransfer.types.indexOf("Files") !== -1 && !dragItemRef.current;
    }
    return false;
  }, []);

  const handleExternalFileDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setExternalDragOver(false);
    externalDragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    const acceptedExts = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".png", ".jpg", ".jpeg", ".gif", ".txt", ".csv"];
    const validFiles = files.filter((f) => {
      const ext = "." + f.name.split(".").pop().toLowerCase();
      return acceptedExts.includes(ext);
    });

    if (!validFiles.length) {
      showDragToast(t("docs.noSupportedFiles"), "error");
      return;
    }

    // Direct upload, skip modal
    setIsDirectUploading(true);
    setDirectUploadProgress(0);
    setDirectUploadResults([]);
    setShowDirectUploadToast(true);

    const results = [];
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      try {
        const res = await documentService.uploadDocument(
          file,
          (p) => setDirectUploadProgress(Math.round(((i + p / 100) / validFiles.length) * 100)),
          currentFolderIdRef.current
        );
        results.push({ name: file.name, success: true, data: res.data });
      } catch (err) {
        results.push({ name: file.name, success: false, error: err?.response?.data?.message || err.message });
      }
    }

    setDirectUploadResults(results);
    setDirectUploadProgress(100);
    setIsDirectUploading(false);
    await refreshAll();

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;
    if (failCount === 0) {
      showDragToast(`${successCount} ${t("docs.fileUploadedSuccess")}`);
    } else {
      const firstErr = results.find((r) => !r.success)?.error;
      showDragToast(`${successCount} ${t("docs.uploadedComma")} ${failCount} ${t("docs.failedSuffix")}${firstErr ? `: ${firstErr}` : ""}`, "error");
    }

    setTimeout(() => setShowDirectUploadToast(false), 4000);
  }, [showDragToast, t]);

  const handleDropOnContainer = useCallback(async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    clearTimeout(hoverTimerRef.current);
    setDropTargetId(null);
    setContainerDragOver(false);

    if (!dragItemRef.current) {
      handleExternalFileDrop(e);
      return;
    }

    const item = dragItemRef.current;
    if (!item) return;

    try {
      if (item.type === "document") {
        await folderService.moveDocument(item.id, currentFolderIdRef.current);
        showDragToast(currentFolderIdRef.current ? t("docs.documentMovedToFolder") : t("docs.documentMovedToRoot"));
      } else if (item.type === "folder") {
        await folderService.moveFolder(item.id, currentFolderIdRef.current || null);
        showDragToast(currentFolderIdRef.current ? t("docs.folderMovedHere") : t("docs.folderMovedToRoot"));
      }
      await refreshAll();
    } catch (err) {
      console.error("Container drop error:", err);
      showDragToast(err?.response?.data?.message || t("docs.moveFailed"), "error");
    } finally {
      setDragItem(null);
      dragItemRef.current = null;
      removeDragGhost();
    }
  }, [showDragToast, removeDragGhost, t]);

  const handleDragEnd = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setDragItem(null);
    dragItemRef.current = null;
    setDropTargetId(null);
    setContainerDragOver(false);
    removeDragGhost();
  }, [removeDragGhost]);

  const handleDropOnFolder = useCallback(async (targetFolderId, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    clearTimeout(hoverTimerRef.current);
    setDropTargetId(null);

    const item = dragItemRef.current;
    if (!item) return;

    try {
      if (item.type === "document") {
        await folderService.moveDocument(item.id, targetFolderId);
        showDragToast(t("docs.documentMoved"));
      } else if (item.type === "folder") {
        if (item.id === targetFolderId) return;
        await folderService.moveFolder(item.id, targetFolderId);
        showDragToast(t("docs.folderMoved"));
      }
      await refreshAll();
    } catch (err) {
      console.error("Drop move error:", err);
      showDragToast(err?.response?.data?.message || t("docs.moveFailed"), "error");
    } finally {
      setDragItem(null);
      dragItemRef.current = null;
      removeDragGhost();
    }
  }, [showDragToast, removeDragGhost, t]);

  const handleDropOnBreadcrumb = useCallback(async (targetFolderId, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    clearTimeout(hoverTimerRef.current);
    setDropTargetId(null);

    const item = dragItemRef.current;
    if (!item) return;

    try {
      if (item.type === "document") {
        await folderService.moveDocument(item.id, targetFolderId);
        showDragToast(t("docs.documentMoved"));
      } else if (item.type === "folder") {
        if (item.id === targetFolderId) return;
        await folderService.moveFolder(item.id, targetFolderId || null);
        showDragToast(t("docs.folderMoved"));
      }
      await refreshAll();
    } catch (err) {
      console.error("Drop move error:", err);
      showDragToast(err?.response?.data?.message || t("docs.moveFailed"), "error");
    } finally {
      setDragItem(null);
      dragItemRef.current = null;
      removeDragGhost();
    }
  }, [showDragToast, removeDragGhost, t]);

  useEffect(() => { fetchFolders(); fetchDocuments(); }, []);

  useEffect(() => {
    const folderId = searchParams.get("folder");
    if (folderId && folders.length > 0) {
      navigateToFolder(folderId);
      setSearchParams({}, { replace: true });
    }
  }, [folders, searchParams]);

  const fetchFolders = async () => {
    try {
      setIsLoadingFolders(true);
      const res = await folderService.getAllFolders();
      if (res.success) setFolders(res.data);
    } catch (err) { console.error("Failed to fetch folders:", err); }
    finally { setIsLoadingFolders(false); }
  };

  const fetchDocuments = async () => {
    try {
      setIsLoadingDocs(true);
      const res = await documentService.getAllDocuments();
      if (res.success && res.data) setDocuments(res.data);
    } catch (err) { console.error("Failed to fetch documents:", err); }
    finally { setIsLoadingDocs(false); }
  };

  const refreshAll = () => Promise.all([fetchFolders(), fetchDocuments()]);

  const folderTree = useMemo(() => {
    const map = {};
    folders.forEach((f) => { map[f.id] = { ...f, children: [] }; });
    const roots = [];
    folders.forEach((f) => {
      if (f.parentId && map[f.parentId]) map[f.parentId].children.push(map[f.id]);
      else roots.push(map[f.id]);
    });
    return { map, roots };
  }, [folders]);

  const currentFolders = useMemo(() => {
    if (!currentFolderId) return folderTree.roots;
    return folderTree.map[currentFolderId]?.children || [];
  }, [currentFolderId, folderTree]);

  const currentDocuments = useMemo(() =>
    documents.filter((d) => currentFolderId ? d.folderId === currentFolderId : !d.folderId),
  [documents, currentFolderId]);

  const filteredDocuments = useMemo(() =>
    currentDocuments.filter((doc) => {
      const name = (doc.originalFilename || "").toLowerCase();
      const type = getFileTypeFromMime(doc.mimeType);
      return name.includes(debouncedSearch.toLowerCase()) && (filterType === "all" || type === filterType);
    }),
  [currentDocuments, debouncedSearch, filterType]);

  const getFolderName = (fid) => folderTree.map[fid]?.name || "Unfiled";

  const navigateToFolder = (folderId) => {
    if (folderId === null) { setCurrentFolderId(null); setFolderPath([]); return; }
    const path = [];
    let cur = folderTree.map[folderId];
    while (cur) { path.unshift({ id: cur.id, name: cur.name }); cur = cur.parentId ? folderTree.map[cur.parentId] : null; }
    setCurrentFolderId(folderId);
    setFolderPath(path);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setRealFiles((p) => [...p, ...files]);
    setUploadedFiles((p) => [...p, ...files.map((file, i) => ({
      id: Date.now() + i, name: file.name, size: formatFileSize(file.size),
      type: file.name.split(".").pop().toLowerCase(), file,
    }))]);
  };

  const removeUploadFile = (fileId) => {
    const f = uploadedFiles.find((u) => u.id === fileId);
    if (f) setRealFiles((p) => p.filter((r) => r.name !== f.name));
    setUploadedFiles((p) => p.filter((u) => u.id !== fileId));
  };

  const handleUploadFiles = async () => {
    if (!uploadedFiles.length) return;
    setUploadStep(1); setIsUploadingReal(true); setUploadResults([]);
    const results = [];
    for (const uf of uploadedFiles) {
      try {
        const res = await documentService.uploadDocument(uf.file, (p) => setUploadProgress(p), currentFolderId);
        results.push({ name: uf.name, success: true, data: res.data });
      } catch (err) {
        results.push({ name: uf.name, success: false, error: err?.response?.data?.message || err.message });
      }
    }
    setUploadResults(results); setUploadStep(2); setIsUploadingReal(false); setUploadProgress(0);
    await refreshAll();
  };

  const resetUploadModal = () => {
    setShowUploadModal(false); setUploadedFiles([]); setRealFiles([]);
    setUploadStep(0); setUploadResults([]); setIsUploadingReal(false); setUploadProgress(0);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const res = await folderService.createFolder({ name: newFolderName.trim(), parentId: currentFolderId, color: newFolderColor });
      if (res.success) { await fetchFolders(); setShowCreateFolderModal(false); setNewFolderName(""); setNewFolderColor("#6366f1"); }
    } catch { setToast({ type: "error", msg: t("docs.toastCreateFolderFailed") }); }
    finally { setIsCreatingFolder(false); }
  };

  const handleDeleteFolder = (folderId, e) => {
    e?.stopPropagation();
    const f = folderTree.map[folderId];
    askConfirm({
      title: t("docs.confirmDeleteFolderTitle"),
      message: `${t("docs.confirmDeleteFolderMessagePrefix")}${f?.name || ""}${t("docs.confirmDeleteFolderMessageSuffix")}`,
      confirmLabel: t("docs.confirmDeleteFolderConfirm"),
      variant: "danger",
      onConfirm: async () => {
        try {
          await folderService.deleteFolder(folderId);
          await refreshAll();
          if (currentFolderId === folderId) navigateToFolder(null);
          setToast({ type: "success", msg: t("docs.toastFolderDeleted") });
        } catch { setToast({ type: "error", msg: t("docs.toastDeleteFolderFailed") }); }
      },
    });
  };

  const openRenameFolderModal = (folderId, e) => {
    e?.stopPropagation();
    const f = folderTree.map[folderId];
    if (!f) return;
    setRenamingFolder(f);
    setRenameFolderName(f.name);
    setShowRenameFolderModal(true);
  };

  const handleRenameFolder = async () => {
    if (!renameFolderName.trim() || !renamingFolder) return;
    try {
      await folderService.updateFolder(renamingFolder.id, { name: renameFolderName.trim() });
      setShowRenameFolderModal(false);
      setRenamingFolder(null);
      setRenameFolderName("");
      await refreshAll();
    } catch { setToast({ type: "error", msg: t("docs.toastRenameFolderFailed") }); }
  };

  // PDF → editable: convert to DOCX behind the scenes, then open the editor.
  const [pdfConverting, setPdfConverting] = useState(false);
  const handleEditPdf = async (doc) => {
    setShowDocumentModal(false);
    setPdfConverting(true);
    try {
      const res = await documentService.convertToEditable(doc.id);
      if (res.success) {
        await refreshAll();
        handleEditInOnlyOffice(res.data.document);
      } else {
        setToast({ type: "error", msg: res.message || t("docs.toastConvertPdfFailed") });
      }
    } catch (e) {
      setToast({ type: "error", msg: e?.response?.data?.message || t("docs.toastConvertPdfDocxFailed") });
    } finally {
      setPdfConverting(false);
    }
  };

  // OnlyOffice only handles Office formats; PDF & images open in the in-app viewer.
  const openDocumentSmart = (doc) => {
    const type = getFileTypeFromMime(doc.mimeType);
    if (type === "pdf" || type === "image") {
      setViewerDoc(doc);
      return;
    }
    if (type === "docx" || type === "xlsx" || type === "pptx" || type === "txt") {
      handleEditInOnlyOffice(doc);
      return;
    }
    // Unknown/unsupported preview → offer download
    setToast({ type: "error", msg: t("docs.toastCannotOpenInEditor") });
  };

  // Double-click always previews; editing is triggered from there (images are preview-only).
  const handlePreviewDocument = (doc) => {
    const type = getFileTypeFromMime(doc.mimeType);
    if (type === "pdf" || type === "image") {
      setViewerDoc(doc);
      return;
    }
    if (type === "docx" || type === "xlsx" || type === "pptx" || type === "txt") {
      handleViewInOnlyOffice(doc); // OnlyOffice view = preview; has switch-to-edit
      return;
    }
    setViewerDoc(doc); // best-effort preview for anything else
  };

  const handleViewInOnlyOffice = async (doc) => {
    try {
      const res = await documentService.getOnlyOfficeConfig(doc.id, "view", { theme });
      if (res.success) {
        setOnlyOfficeConfig(res.data.config);
        setOnlyOfficeLockInfo(res.data.lockInfo || null);
        setOnlyOfficeDoc(doc);
        setShowOnlyOffice(true);
      }
    } catch { setToast({ type: "error", msg: t("docs.toastOpenDocumentFailed") }); }
  };

  const handleEditInOnlyOffice = async (doc) => {
    try {
      const res = await documentService.getOnlyOfficeConfig(doc.id, "edit", { theme });
      if (res.success) {
        setOnlyOfficeConfig(res.data.config);
        setOnlyOfficeLockInfo(res.data.lockInfo || null);
        setOnlyOfficeDoc(doc);
        setShowOnlyOffice(true);
      }
    } catch { setToast({ type: "error", msg: t("docs.toastOpenEditorFailed") }); }
  };

  const closeOnlyOffice = () => {
    setShowOnlyOffice(false);
    setOnlyOfficeConfig(null);
    setOnlyOfficeDoc(null);
    setOnlyOfficeLockInfo(null);
    refreshAll();
    // Pop the history entry we pushed on open, so Back behaves normally afterwards.
    if (window.history.state?.ooEditor) window.history.back();
  };

  // Editor is an overlay, not a route change, push a history entry so Back closes it instead of leaving the page.
  useEffect(() => {
    if (!showOnlyOffice) return;
    window.history.pushState({ ooEditor: true }, "");
    const onPop = () => {
      setShowOnlyOffice(false);
      setOnlyOfficeConfig(null);
      setOnlyOfficeDoc(null);
      setOnlyOfficeLockInfo(null);
      refreshAll();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [showOnlyOffice]);

  const handleEditorSaved = (newVersion) => {
    setSaveToast({ version: newVersion });
    setTimeout(() => setSaveToast(null), 4000);
    refreshAll();
  };

  const handleEditorRenamed = (newName) => {
    if (onlyOfficeDoc) {
      setOnlyOfficeDoc({ ...onlyOfficeDoc, originalFilename: newName });
    }
    refreshAll();
  };

  useEffect(() => { if (!showDocumentModal) setRenamingDoc(false); }, [showDocumentModal]);

  const handleRenameDocument = async () => {
    if (!selectedDocument) return;
    const name = renameDocValue.trim();
    if (!name || name === selectedDocument.originalFilename) { setRenamingDoc(false); return; }
    try {
      const res = await documentService.renameDocument(selectedDocument.id, name);
      if (res?.success === false) {
        setToast({ type: "error", msg: res.message || t("docs.toastRenameFailed") });
        return;
      }
      setSelectedDocument((p) => (p ? { ...p, originalFilename: name } : p));
      setRenamingDoc(false);
      refreshAll();
      setToast({ type: "success", msg: t("docs.toastDocumentRenamed") });
    } catch (err) {
      setToast({ type: "error", msg: err?.response?.data?.message || t("docs.toastRenameFailed") });
    }
  };

  const handleOpenComment = (doc) => {
    setCommentingDocument(doc);
    setShowCommentModal(true);
  };
  const handleCloseComment = () => {
    setShowCommentModal(false);
    setCommentingDocument(null);
  };

  const handleDownloadDocument = async (doc) => {
    try { await documentService.downloadDocument(doc.id, doc.originalFilename); }
    catch { setToast({ type: "error", msg: t("folders.downloadDocError") }); }
  };

  const handleDeleteDocument = (doc) => {
    askConfirm({
      title: t("docs.confirmMoveToTrashTitle"),
      message: `"${doc.originalFilename}${t("docs.confirmMoveToTrashMessageSuffix")}`,
      confirmLabel: t("docs.confirmMoveToTrashConfirm"),
      variant: "danger",
      onConfirm: async () => {
        try {
          await documentService.deleteDocument(doc.id);
          await refreshAll();
          setShowDocumentModal(false);
          setToast({ type: "success", msg: t("docs.toastMovedToTrash") });
        } catch { setToast({ type: "error", msg: t("docs.toastDeleteDocumentFailed") }); }
      },
    });
  };

  const handleMoveDocument = async (targetFolderId) => {
    if (!movingDocument) return;
    try { await folderService.moveDocument(movingDocument.id, targetFolderId); await refreshAll(); setShowMoveModal(false); setMovingDocument(null); }
    catch { setToast({ type: "error", msg: t("docs.toastMoveDocumentFailed") }); }
  };

  const openDocument = (doc) => { setSelectedDocument(doc); setShowSecurityDetails(false); setShowBlockchainDetails(false); setBlockchainAnchor(null); setBlockchainResult(null); setShowDocumentModal(true); };

  const fetchBlockchainAnchor = useCallback(async (docId) => {
    try {
      const res = await blockchainService.getAnchorInfo(docId);
      if (res.success) setBlockchainAnchor(res.data);
    } catch { setBlockchainAnchor(null); }
  }, []);

  const handleAnchorDocument = useCallback(async () => {
    if (!selectedDocument) return;
    setBlockchainLoading(true);
    setBlockchainAction('anchor');
    setBlockchainResult(null);
    try {
      const res = await blockchainService.anchorDocument(selectedDocument.id);
      setBlockchainResult({ type: res.success ? 'success' : 'error', message: res.success ? t("docs.toastAnchoredSuccess") : (res.message || t("docs.toastAnchorFailed")) });
      if (res.success) {
        setBlockchainAnchor(res.data);
        setSelectedDocument(prev => ({ ...prev, blockchainAnchored: true }));
      }
    } catch (err) {
      setBlockchainResult({ type: 'error', message: err?.response?.data?.message || t("docs.toastAnchorFailed2") });
    } finally { setBlockchainLoading(false); setBlockchainAction(null); }
  }, [selectedDocument, t]);

  const handleToggleAutoAnchor = useCallback(async () => {
    if (!selectedDocument) return;
    const newVal = !selectedDocument.autoAnchorOnEdit;
    try {
      const res = await blockchainService.setAutoAnchor(selectedDocument.id, newVal);
      if (res.success) setSelectedDocument(prev => ({ ...prev, autoAnchorOnEdit: newVal }));
    } catch { /* silently fail */ }
  }, [selectedDocument]);

  const handleTrackingToggle = async () => {
    if (!selectedDocument) return;
    const newVal = !selectedDocument.trackingEnabled;
    setTrackingLoading(true);
    try {
      const res = await osintService.toggleTracking(selectedDocument.id, newVal);
      if (res.data?.success) {
        setSelectedDocument(prev => ({
          ...prev,
          trackingEnabled: newVal,
          trackingCode: res.data.data.trackingCode,
        }));
      }
    } catch (err) {
      console.error('Tracking toggle failed:', err);
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleQrDownloadToggle = async () => {
    if (!selectedDocument) return;
    const newVal = !selectedDocument.qrOnDownload;
    // Optimistic update
    setSelectedDocument(prev => ({ ...prev, qrOnDownload: newVal }));
    setQrDownloadLoading(true);
    try {
      const res = await osintService.toggleQrOnDownload(selectedDocument.id, newVal);
      if (res.data?.success) {
        setToast({ type: "success", msg: newVal ? t("docs.toastQrEnabled") : t("docs.toastQrDisabled") });
      } else {
        setSelectedDocument(prev => ({ ...prev, qrOnDownload: !newVal }));
        setToast({ type: "error", msg: t("docs.toastQrUpdateFailed") });
      }
    } catch (err) {
      console.error('QR on download toggle failed:', err);
      setSelectedDocument(prev => ({ ...prev, qrOnDownload: !newVal }));
      setToast({ type: "error", msg: err?.response?.data?.message || t("docs.toastQrUpdateFailed") });
    } finally {
      setQrDownloadLoading(false);
    }
  };

  useEffect(() => {
    if (showBlockchainDetails && selectedDocument?.id && canBlockchain) {
      fetchBlockchainAnchor(selectedDocument.id);
    }
  }, [showBlockchainDetails, selectedDocument?.id, canBlockchain, fetchBlockchainAnchor]);

  useEffect(() => {
    const open = showUploadModal || showCreateFolderModal || showDocumentModal || showOnlyOffice || showMoveModal || showRenameFolderModal;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showUploadModal, showCreateFolderModal, showDocumentModal, showOnlyOffice, showMoveModal]);

  useEffect(() => {
    const preventDefaults = (e) => {
      // Blocks the browser's default "open file" behavior for drags outside our drop zone
      if (e.dataTransfer?.types?.indexOf("Files") !== -1) {
        e.preventDefault();
      }
    };
    window.addEventListener("dragover", preventDefaults);
    window.addEventListener("drop", preventDefaults);
    return () => {
      window.removeEventListener("dragover", preventDefaults);
      window.removeEventListener("drop", preventDefaults);
    };
  }, []);

  const CustomSelect = ({ value, options, onChange, dropdownId }) => {
    const isOpen = openDropdown === dropdownId;
    const sel = options.find((o) => o.value === value);
    return (
      <div className="relative">
        <button type="button" onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
          className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-800 transition-all min-w-[140px] ${isOpen ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}>
          <span className="text-sm text-slate-700 dark:text-slate-200">{sel?.label}</span>
          <IconChevDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-2 w-full min-w-[160px] py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20">
                {options.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpenDropdown(null); }}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${value === opt.value ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium" : "text-slate-600 dark:text-slate-300"}`}>
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          className="mb-0"
          eyebrow={t("docs.eyebrow")}
          title={t("docs.title")}
          subtitle={t("docs.subtitle")}
          icon={<IconDoc />}
          actions={
            <>
              <button onClick={() => setShowCreateFolderModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm">
                <IconFolder /> {t("docs.newFolder")}
              </button>
              <button onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white font-semibold shadow-lg shadow-accent hover:shadow-xl hover:-translate-y-0.5 transition-all text-sm">
                <IconUpload /> {t("common.upload")}
              </button>
            </>
          }
        />

        <div className="flex items-center gap-1 text-sm flex-wrap">
          <button
            onClick={() => navigateToFolder(null)}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDropTargetId("root"); }}
            onDragLeave={() => setDropTargetId(null)}
            onDrop={(e) => handleDropOnBreadcrumb(null, e)}
            className={`px-2 py-1 rounded-lg transition-all duration-200 flex items-center gap-1 ${dropTargetId === "root" ? "ring-2 ring-indigo-500 bg-indigo-100 dark:bg-indigo-500/20 scale-105" : ""} ${!currentFolderId ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium" : "text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"}`}>
            <IconHome /> {t("docs.root")}
          </button>
          {folderPath.map((fp, i) => (
            <span key={fp.id} className="flex items-center gap-1">
              <IconChevRight />
              <button
                onClick={() => navigateToFolder(fp.id)}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDropTargetId("bc-" + fp.id); }}
                onDragLeave={() => setDropTargetId(null)}
                onDrop={(e) => handleDropOnBreadcrumb(fp.id, e)}
                className={`px-2 py-1 rounded-lg transition-all duration-200 ${dropTargetId === "bc-" + fp.id ? "ring-2 ring-indigo-500 bg-indigo-100 dark:bg-indigo-500/20 scale-105" : ""} ${i === folderPath.length - 1 ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium" : "text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"}`}>
                {fp.name}
              </button>
            </span>
          ))}
        </div>

        <Card className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <IconSearch />
              <input type="text" placeholder={t("docs.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent transition-all outline-none" />
            </div>
            <div className="flex gap-3">
              <CustomSelect value={filterType} options={[
                { value: "all", label: t("docs.fileTypeOptions.all") },
                { value: "pdf", label: t("docs.fileTypeOptions.pdf") },
                { value: "docx", label: t("docs.fileTypeOptions.docx") },
                { value: "xlsx", label: t("docs.fileTypeOptions.xlsx") },
                { value: "pptx", label: t("docs.fileTypeOptions.pptx") },
                { value: "image", label: t("docs.fileTypeOptions.image") },
              ]} onChange={setFilterType} dropdownId="type-filter" />
              <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button onClick={() => setView("grid")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === "grid" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
                  <IconGrid />
                </button>
                <button onClick={() => setView("list")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === "list" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
                  <IconList />
                </button>
              </div>
            </div>
          </div>
        </Card>

        {(currentFolders.length > 0 || currentFolderId) && (
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <IconFolderOutline />
              {t("docs.foldersHeading")}
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400">{currentFolders.length}</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {currentFolderId && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className={currentFolders.length > 0 ? "col-start-2 md:col-start-4" : "col-start-1"}
                  style={{ order: 9999 }}
                >
                  <div
                    className={`relative group rounded-2xl transition-all duration-200 min-h-[80px] ${dropTargetId === "back-parent" ? "ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-slate-900 scale-[1.03] shadow-lg shadow-amber-500/20" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; setDropTargetId("back-parent"); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDropTargetId("back-parent"); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTargetId(null); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const parentId = folderPath.length > 1 ? folderPath[folderPath.length - 2].id : null;
                      handleDropOnBreadcrumb(parentId, e);
                    }}
                  >
                    <button onClick={() => { const parentId = folderPath.length > 1 ? folderPath[folderPath.length - 2].id : null; navigateToFolder(parentId); }}
                      className={`w-full h-full p-5 rounded-2xl border border-dashed text-left transition-all hover:shadow-lg bg-white/50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 hover:border-amber-400 dark:hover:border-amber-500/50 ${dragItem ? "pointer-events-none" : ""} ${dropTargetId === "back-parent" ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-500/10">
                          <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 truncate">{t("docs.back")}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{folderPath.length > 1 ? folderPath[folderPath.length - 2].name : t("docs.root")}</p>
                        </div>
                      </div>
                    </button>
                    {dragItem && dropTargetId === "back-parent" && (
                      <div className="absolute inset-0 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border-2 border-dashed border-amber-500 flex items-center justify-center pointer-events-none z-10">
                        <span className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold shadow-lg">
                          {t("docs.moveTo")} {folderPath.length > 1 ? folderPath[folderPath.length - 2].name : t("docs.root")}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              {currentFolders.map((folder, index) => (
                <motion.div key={folder.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                  layout layoutId={`folder-${folder.id}`}
                >
                  <div
                    className={`relative group rounded-2xl transition-all duration-200 ${dragItem && dragItem.type === "folder" && dragItem.id === folder.id ? "opacity-40 scale-95" : ""} ${dropTargetId === folder.id ? "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 scale-[1.03] shadow-lg shadow-accent" : ""}`}
                    draggable
                    onDragStart={(e) => startDrag(e, "folder", folder.id, folder)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); handleFolderDragEnter(folder.id); }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) handleFolderDragLeave();
                    }}
                    onDrop={(e) => handleDropOnFolder(folder.id, e)}
                  >
                    <button onClick={() => navigateToFolder(folder.id)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all hover:shadow-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 ${dragItem ? "pointer-events-none" : ""} ${dropTargetId === folder.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10"
                          style={{ backgroundColor: folder.color ? `${folder.color}15` : undefined }}>
                          <IconFolderSolid color={folder.color || "#6366f1"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{folder.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{folder.documentCount || 0} {t("docs.filesCountSuffix")}</p>
                        </div>
                      </div>
                    </button>
                    {dragItem && dropTargetId === folder.id && !(dragItem.type === "folder" && dragItem.id === folder.id) && (
                      <div className="absolute inset-0 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 border-2 border-dashed border-indigo-500 flex items-center justify-center pointer-events-none z-10">
                        <span className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-lg">
                          {t("docs.dropHere")}
                        </span>
                      </div>
                    )}
                    <button onClick={(e) => handleDeleteFolder(folder.id, e)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 z-20 pointer-events-auto">
                      <IconTrash />
                    </button>
                    <button onClick={(e) => openRenameFolderModal(folder.id, e)}
                      className="absolute top-2 right-10 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-amber-50 dark:bg-amber-500/10 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/20 z-20 pointer-events-auto"
                      title={t("docs.renameTitle")}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div
          className="relative"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Internal drag → move cursor
            if (dragItemRef.current) {
              e.dataTransfer.dropEffect = "move";
            }
            // External file drag from OS → copy cursor
            else if (hasExternalFiles(e)) {
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragItemRef.current) {
              containerDragCounter.current++;
              setContainerDragOver(true);
            } else if (hasExternalFiles(e)) {
              externalDragCounter.current++;
              setExternalDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            if (dragItemRef.current) {
              containerDragCounter.current--;
              if (containerDragCounter.current <= 0) { containerDragCounter.current = 0; setContainerDragOver(false); }
            } else {
              externalDragCounter.current--;
              if (externalDragCounter.current <= 0) { externalDragCounter.current = 0; setExternalDragOver(false); }
            }
          }}
          onDrop={handleDropOnContainer}
        >
          {/* Internal move overlay, only when dragged item is NOT already in the current folder */}
          <AnimatePresence>
            {dragItem && containerDragOver && !dropTargetId && (() => {
              const cur = currentFolderIdRef.current || null;
              const itemFolder = dragItem.type === "document"
                ? (dragItem.data?.folderId || null)
                : (dragItem.data?.parentId || null);
              return itemFolder !== cur;
            })() && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-30 rounded-2xl border-2 border-dashed border-indigo-500 bg-indigo-50/80 dark:bg-indigo-500/10 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none"
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                  {dragItem.type === "document" ? t("docs.dropToMoveDocument") : t("docs.dropToMoveFolder")}
                </p>
                <p className="text-sm text-indigo-500 dark:text-indigo-400">
                  {currentFolderIdRef.current ? t("docs.intoThisFolder") : t("docs.intoRootLevel")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {externalDragOver && !dragItem && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-30 rounded-2xl border-3 border-dashed border-emerald-500 bg-emerald-50/90 dark:bg-emerald-500/10 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none"
              >
                <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                  {t("docs.dropFilesToUpload")}
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-2">
                  {currentFolderIdRef.current ? `${t("docs.uploadToLabel")} ${getFolderName(currentFolderIdRef.current)}` : t("docs.uploadToRoot")}
                </p>
                <p className="text-xs text-emerald-500 dark:text-emerald-400/60">
                  {t("docs.fileTypesHint")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

        <div className="min-h-[500px] pb-16">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <IconDoc />
            {t("docs.documentsHeading")}
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400">{filteredDocuments.length}</span>
          </h2>

          {isLoadingDocs ? (
            <Card className="p-16 text-center">
              <div className="w-10 h-10 mx-auto mb-4 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">{t("docs.loadingDocuments")}</p>
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card className="p-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("docs.noDocumentsTitle")}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("docs.noDocumentsSubtitle")}</p>
              <button onClick={() => setShowUploadModal(true)} className="px-5 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white font-semibold text-sm transition-all">
                {t("docs.uploadDocuments")}
              </button>
            </Card>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc, index) => {
                const type = getFileTypeFromMime(doc.mimeType);
                return (
                  <motion.div key={doc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                    draggable
                    onDragStart={(e) => startDrag(e, "document", doc.id, doc)}
                    onDragEnd={handleDragEnd}
                    className={`transition-all duration-200 ${dragItem && dragItem.type === "document" && dragItem.id === doc.id ? "opacity-40 scale-90" : ""}`}
                  >
                    <Card className="p-5 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-300 group cursor-pointer"
                      onDoubleClick={() => handlePreviewDocument(doc)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 flex items-center justify-center group-hover:scale-110 transition-transform ring-1 ring-slate-200/40 dark:ring-slate-700/40">
                          {getFileIcon(type, "w-6 h-6")}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {doc.blockchainAnchored && (
                            <span className="p-1 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-500" title={t("docs.titleBlockchainAnchored")}>
                              <IconChain className="w-3 h-3" />
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${doc.status === "active" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                            {doc.status === "active" ? t("docs.active") : doc.status}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {doc.originalFilename}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mb-4">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span>{formatTimeAgo(doc.updatedAt || doc.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-medium text-slate-400 tracking-wide">{type.toUpperCase()}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); openDocument(doc); }} className="p-1.5 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-500/10 text-slate-400 hover:text-sky-600 transition-colors" title={t("docs.titleInfo")}><IconInfo /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleOpenComment(doc); }} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-600 transition-colors" title={t("docs.titleComment")}><IconMessage /></button>
                          <DownloadDropdown doc={doc} />
                          <button onClick={(e) => { e.stopPropagation(); setMovingDocument(doc); setShowMoveModal(true); }} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-slate-400 hover:text-amber-600 transition-colors" title={t("docs.titleMove")}><IconFolderMove /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600 transition-colors" title={t("docs.titleDelete")}><IconTrash /></button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("common.name")}</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("common.size")}</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("docs.modified")}</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("common.status")}</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDocuments.map((doc) => {
                      const type = getFileTypeFromMime(doc.mimeType);
                      return (
                        <tr key={doc.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 cursor-grab active:cursor-grabbing ${dragItem && dragItem.type === "document" && dragItem.id === doc.id ? "opacity-40 scale-[0.98]" : ""}`}
                          onDoubleClick={() => handlePreviewDocument(doc)}
                          draggable
                          onDragStart={(e) => startDrag(e, "document", doc.id, doc)}
                          onDragEnd={handleDragEnd}
                        >                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">{getFileIcon(type, "w-6 h-6")}</div>
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{doc.originalFilename}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-500">{formatFileSize(doc.fileSize)}</td>
                          <td className="px-5 py-4 text-sm text-slate-500">{formatTimeAgo(doc.updatedAt || doc.createdAt)}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${doc.status === "active" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                                {doc.status === "active" ? t("docs.active") : doc.status}
                              </span>
                              {doc.blockchainAnchored && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-500 text-[10px] font-medium" title={t("docs.titleBlockchainAnchored")}>
                                  <IconChain className="w-3 h-3" /> {t("docs.onChain")}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex gap-1">
                              <button onClick={(e) => { e.stopPropagation(); openDocument(doc); }} className="p-2 rounded-lg hover:bg-sky-50 text-slate-400 hover:text-sky-600 transition-colors" title={t("docs.titleInfo")}><IconInfo /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleOpenComment(doc); }} className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title={t("docs.titleComment")}><IconMessage /></button>
                              <DownloadDropdown doc={doc} />
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title={t("docs.titleDelete")}><IconTrash /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
        </div>
      </div>

      <AnimatePresence>
        {showDocumentModal && selectedDocument && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowDocumentModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-black/20 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/50 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 flex items-center justify-center shrink-0 ring-1 ring-slate-200/50 dark:ring-slate-700/50">
                      {getFileIcon(getFileTypeFromMime(selectedDocument.mimeType), "w-8 h-8")}
                    </div>
                    <div className="min-w-0">
                      {renamingDoc ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={renameDocValue}
                            onChange={(e) => setRenameDocValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleRenameDocument(); if (e.key === "Escape") setRenamingDoc(false); }}
                            className="text-lg font-bold bg-transparent border-b-2 border-indigo-400 focus:outline-none text-slate-900 dark:text-white min-w-0 flex-1"
                          />
                          <button onClick={handleRenameDocument} className="shrink-0 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{t("common.save")}</button>
                          <button onClick={() => setRenamingDoc(false)} className="shrink-0 text-sm text-slate-400 hover:text-slate-600">{t("common.cancel")}</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{selectedDocument.originalFilename}</h2>
                          <button
                            onClick={() => { setRenameDocValue(selectedDocument.originalFilename); setRenamingDoc(true); }}
                            className="shrink-0 p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={t("docs.renameTitle")}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${selectedDocument.status === "active" ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                          {selectedDocument.status === "active" && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          )}
                          {selectedDocument.status === "active" ? t("docs.active") : selectedDocument.status}
                        </span>
                        {selectedDocument.blockchainAnchored && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400">
                            <IconChain className="w-3 h-3" /> {t("docs.onChain")}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {formatFileSize(selectedDocument.fileSize)} &middot; {selectedDocument.folderId ? getFolderName(selectedDocument.folderId) : t("docs.root")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setShowDocumentModal(false)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0">
                    <IconX className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="px-6 py-5 flex-1 overflow-y-auto space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("docs.formatLabel")}</p>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{getFileTypeFromMime(selectedDocument.mimeType).toUpperCase()}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("common.size")}</p>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatFileSize(selectedDocument.fileSize)}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("docs.modified")}</p>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatTimeAgo(selectedDocument.updatedAt || selectedDocument.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0"><IconUpload /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t("docs.uploadedLabel")}</p>
                    <p className="text-[11px] text-slate-400">
                      {selectedDocument.createdAt ? new Date(selectedDocument.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}{" "}
                      {t("docs.uploadedAt")} {selectedDocument.createdAt ? new Date(selectedDocument.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                  <button onClick={() => setShowSecurityDetails(!showSecurityDetails)}
                    className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
                        <IconShield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("docs.securityDetails")}</span>
                    </div>
                    <IconChevDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showSecurityDetails ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {showSecurityDetails && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="p-4 space-y-2.5 border-t border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900">
                          {selectedDocument.contentHash && (
                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("docs.contentHash")}</p>
                              <code className="text-[11px] font-mono text-slate-600 dark:text-slate-400 break-all leading-relaxed">{selectedDocument.contentHash}</code>
                            </div>
                          )}
                          {selectedDocument.ssdeepHash && (
                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("docs.ssdeepHash")}</p>
                              <code className="text-[11px] font-mono text-slate-600 dark:text-slate-400 break-all leading-relaxed">{selectedDocument.ssdeepHash}</code>
                            </div>
                          )}
                          {selectedDocument.simHash && (
                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("docs.simHash")}</p>
                              <code className="text-[11px] font-mono text-slate-600 dark:text-slate-400 break-all leading-relaxed">{selectedDocument.simHash}</code>
                            </div>
                          )}
                          {!selectedDocument.contentHash && !selectedDocument.ssdeepHash && (
                            <p className="text-xs text-slate-400 text-center py-3">{t("docs.noHashData")}</p>
                          )}
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/15">
                            <IconLock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                            <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">{t("docs.e2ee")}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {canBlockchain && blockchainEnabled && (
                  <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                    <button onClick={() => setShowBlockchainDetails(!showBlockchainDetails)}
                      className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                          <IconChain className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("docs.blockchainAnchoring")}</span>
                        {selectedDocument.blockchainAnchored && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            <IconVerified className="w-3 h-3" /> {t("docs.anchored")}
                          </span>
                        )}
                      </div>
                      <IconChevDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showBlockchainDetails ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {showBlockchainDetails && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="p-4 space-y-3 border-t border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900">
                            {blockchainAnchor?.anchor ? (
                              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 space-y-2">
                                <div className="flex items-center gap-2">
                                  <IconVerified className="w-4 h-4 text-emerald-500" />
                                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{t("docs.anchoredOnPolygon")}</span>
                                </div>
                                {blockchainAnchor.anchor.txHash && (
                                  <div>
                                    <p className="text-[10px] text-slate-400 mb-0.5">{t("docs.transactionHash")}</p>
                                    <code className="text-[10px] font-mono text-slate-600 dark:text-slate-400 break-all">{blockchainAnchor.anchor.txHash}</code>
                                  </div>
                                )}
                                {blockchainAnchor.anchor.blockNumber && (
                                  <div className="flex items-center gap-4">
                                    <div>
                                      <p className="text-[10px] text-slate-400">{t("docs.block")}</p>
                                      <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{blockchainAnchor.anchor.blockNumber}</span>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400">{t("docs.network")}</p>
                                      <span className="text-xs text-slate-600 dark:text-slate-400">{blockchainAnchor.anchor.network || 'Polygon'}</span>
                                    </div>
                                    {blockchainAnchor.anchor.gasUsed && (
                                      <div>
                                        <p className="text-[10px] text-slate-400">{t("docs.gasUsed")}</p>
                                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{blockchainAnchor.anchor.gasUsed}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {blockchainAnchor.anchor.anchoredAt && (
                                  <p className="text-[10px] text-slate-400">
                                    {t("docs.anchoredAt")} {new Date(blockchainAnchor.anchor.anchoredAt).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2">
                                  <IconChain className="w-4 h-4 text-slate-400" />
                                  <span className="text-xs text-slate-500">{t("docs.notYetAnchored")}</span>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                              <div>
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{t("docs.autoAnchor")}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{t("docs.autoAnchorDesc")}</p>
                              </div>
                              <button onClick={handleToggleAutoAnchor}
                                role="switch"
                                aria-checked={selectedDocument.autoAnchorOnEdit}
                                aria-label={t("docs.autoAnchor")}
                                className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${selectedDocument.autoAnchorOnEdit ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${selectedDocument.autoAnchorOnEdit ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                            </div>

                            <div className="flex gap-2">
                              {!selectedDocument.blockchainAnchored ? (
                                <button onClick={handleAnchorDocument} disabled={blockchainLoading}
                                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                                  {blockchainAction === 'anchor' ? (
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <IconChain className="w-3.5 h-3.5" />
                                  )}
                                  {t("docs.anchorToPolygon")}
                                </button>
                              ) : (
                                <button onClick={handleAnchorDocument} disabled={blockchainLoading}
                                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-violet-300 dark:border-violet-600 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-50 text-xs font-semibold transition-colors">
                                  {blockchainAction === 'anchor' ? (
                                    <span className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <IconChain className="w-3.5 h-3.5" />
                                  )}
                                  {t("docs.reAnchor")}
                                </button>
                              )}
                            </div>

                            {blockchainResult && (
                              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                className={`p-3 rounded-xl border text-xs ${
                                  blockchainResult.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                                  blockchainResult.type === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300' :
                                  'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300'
                                }`}>
                                <p className="font-semibold">{blockchainResult.message}</p>
                                {blockchainResult.details && (
                                  <div className="mt-2 space-y-1 text-[10px] opacity-80">
                                    {blockchainResult.details.onChainHash && (
                                      <p>{t("docs.onChainHashLabel")} <code className="font-mono">{blockchainResult.details.onChainHash.slice(0, 20)}...</code></p>
                                    )}
                                    {blockchainResult.details.timestamp && (
                                      <p>{t("docs.anchoredAt")} {new Date(blockchainResult.details.timestamp * 1000).toLocaleString()}</p>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {canTrack(selectedDocument) && (
                  <div className="flex items-center justify-between py-3 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{t("docs.osintTracking")}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("docs.osintTrackingDesc")}
                      </p>
                    </div>
                    <button
                      onClick={handleTrackingToggle}
                      disabled={trackingLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        selectedDocument.trackingEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      } disabled:opacity-50`}
                      aria-label={t("docs.toggleOsint")}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        selectedDocument.trackingEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                )}

                {canQrDownload(selectedDocument) && (
                  <div className="flex items-center justify-between py-3 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{t("docs.qrOnDownload")}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("docs.qrOnDownloadDesc")}
                      </p>
                    </div>
                    <button
                      onClick={handleQrDownloadToggle}
                      disabled={qrDownloadLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        selectedDocument.qrOnDownload ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      } disabled:opacity-50`}
                      aria-label={t("docs.toggleQr")}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        selectedDocument.qrOnDownload ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-2.5 shrink-0 bg-slate-50/50 dark:bg-slate-800/20">
                <button onClick={() => setShowDocumentModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">{t("common.close")}</button>
                {(() => {
                  const ft = getFileTypeFromMime(selectedDocument.mimeType);
                  const isOffice = ft === "docx" || ft === "xlsx" || ft === "pptx" || ft === "txt";
                  if (ft === "pdf") {
                    // PDF: preview in-app, or Edit (auto-converts to DOCX behind the scenes).
                    return (
                      <>
                        <button onClick={() => { openDocumentSmart(selectedDocument); setShowDocumentModal(false); }}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                          {t("docs.preview")}
                        </button>
                        <button onClick={() => handleEditPdf(selectedDocument)}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white text-sm font-semibold shadow-lg shadow-accent transition-all flex items-center justify-center gap-2">
                          <IconEdit /> {t("common.edit")}
                        </button>
                      </>
                    );
                  }
                  return (
                    <button onClick={() => { openDocumentSmart(selectedDocument); setShowDocumentModal(false); }}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white text-sm font-semibold shadow-lg shadow-accent transition-all flex items-center justify-center gap-2">
                      <IconEdit /> {isOffice ? t("docs.editInOnlyOffice") : t("docs.openLabel")}
                    </button>
                  );
                })()}
                <DownloadDropdown doc={selectedDocument} variant="button" />
                <button onClick={() => setShowShareModal(true)} title={t("docs.shareTitle")}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  <Share2 className="w-4 h-4" /> {t("docs.share")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showShareModal && selectedDocument && (
        <ShareModal document={selectedDocument} onClose={() => setShowShareModal(false)} />
      )}

      <AnimatePresence>
        {showUploadModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => uploadStep === 0 && resetUploadModal()}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${uploadStep === 2 ? "bg-emerald-500" : "bg-indigo-600"}`}>
                      {uploadStep === 2 ? <IconCheck /> : <IconUpload />}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {uploadStep === 0 && t("docs.uploadDocuments")}
                        {uploadStep === 1 && t("docs.uploadingTitle")}
                        {uploadStep === 2 && t("docs.uploadCompleteTitle")}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {uploadStep === 0 && (currentFolderId ? `${t("docs.into")} ${getFolderName(currentFolderId)}` : t("docs.intoRoot"))}
                        {uploadStep === 1 && t("docs.encryptingProcessing")}
                        {uploadStep === 2 && `${uploadResults.filter((r) => r.success).length} ${t("docs.filesUploadedOf")} ${uploadResults.length} ${t("docs.filesUploadedSuffix")}`}
                      </p>
                    </div>
                  </div>
                  {uploadStep !== 1 && (
                    <button onClick={resetUploadModal} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                      <IconX />
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {uploadStep === 0 && (
                    <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <label
                        className="block border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer group"
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("border-indigo-500", "bg-indigo-50", "dark:bg-indigo-500/10"); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove("border-indigo-500", "bg-indigo-50", "dark:bg-indigo-500/10"); }}
                        onDrop={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          e.currentTarget.classList.remove("border-indigo-500", "bg-indigo-50", "dark:bg-indigo-500/10");
                          const files = Array.from(e.dataTransfer.files);
                          if (files.length) {
                            setRealFiles((p) => [...p, ...files]);
                            setUploadedFiles((p) => [...p, ...files.map((file, i) => ({
                              id: Date.now() + i, name: file.name, size: formatFileSize(file.size),
                              type: file.name.split(".").pop().toLowerCase(), file,
                            }))]);
                          }
                        }}
                      >
                        <input type="file" multiple className="hidden" onChange={handleFileSelect} accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.gif,.txt,.csv" />
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <IconCloud />
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t("docs.dragOrClick")}</p>
                        <p className="text-xs text-slate-400">{t("docs.fileTypesHintParen")}</p>
                      </label>
                      {uploadedFiles.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("docs.filesLabel")} ({uploadedFiles.length})</p>
                            <button onClick={() => { setUploadedFiles([]); setRealFiles([]); }} className="text-xs text-slate-400 hover:text-red-500">{t("docs.clearAll")}</button>
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-2">
                            {uploadedFiles.map((f) => (
                              <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 group">
                                <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                                  {getFileIcon(f.type, "w-6 h-6")}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{f.name}</p>
                                  <p className="text-xs text-slate-400">{f.size}</p>
                                </div>
                                <button onClick={() => removeUploadFile(f.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                                  <IconX className="w-4 h-4 text-current" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                  {uploadStep === 1 && (
                    <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                      <div className="w-20 h-20 mx-auto mb-6 relative">
                        <svg className="w-20 h-20 animate-spin text-indigo-200" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center"><IconLock /></div>
                      </div>
                      <p className="text-base font-semibold text-slate-900 dark:text-white mb-2">{t("docs.processingSecurely")}</p>
                      <p className="text-sm text-slate-500 mb-4">{t("docs.encryptingHashingStoring")}</p>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${Math.max(uploadProgress, 10)}%` }} />
                      </div>
                    </motion.div>
                  )}
                  {uploadStep === 2 && (
                    <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center"><IconCheck /></div>
                          <div>
                            <p className="font-semibold text-emerald-700 dark:text-emerald-400">{t("docs.documentsSecured")}</p>
                            <p className="text-sm text-emerald-600 dark:text-emerald-400/70">{t("docs.allFilesEncrypted")}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {uploadResults.map((r, i) => (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${r.success ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10"}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${r.success ? "bg-emerald-500" : "bg-red-500"}`}>
                              {r.success ? <IconCheck className="w-3.5 h-3.5 text-white" /> : <IconX className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className={`text-sm font-medium ${r.success ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{r.name}</span>
                              {!r.success && r.error && (
                                <p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5 break-words">{r.error}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
                {uploadStep === 0 && (
                  <>
                    <button onClick={resetUploadModal} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">{t("common.cancel")}</button>
                    <button onClick={handleUploadFiles} disabled={!uploadedFiles.length}
                      className="flex-1 px-4 py-3 rounded-xl bg-accent-gradient hover:brightness-110 text-white text-sm font-semibold shadow-lg shadow-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      <IconUpload /> {t("common.upload")} {uploadedFiles.length > 0 ? `(${uploadedFiles.length})` : ""}
                    </button>
                  </>
                )}
                {uploadStep === 1 && (
                  <div className="flex-1 flex items-center justify-center gap-3 py-2">
                    <svg className="w-5 h-5 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-slate-600 font-medium">{t("common.processing")}</span>
                  </div>
                )}
                {uploadStep === 2 && (
                  <button onClick={resetUploadModal} className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2">
                    <IconCheck /> {t("common.done")}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateFolderModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreateFolderModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white"><IconFolder /></div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("docs.newFolder")}</h2>
                      <p className="text-xs text-slate-500">{currentFolderId ? `${t("docs.inside")} ${getFolderName(currentFolderId)}` : t("docs.atRootLevel")}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowCreateFolderModal(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <IconX />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("docs.folderName")}</label>
                  <input type="text" placeholder={t("docs.folderNamePlaceholder")} value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent transition-all outline-none" autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("docs.color")}</label>
                  <div className="flex gap-2">
                    {FOLDER_COLORS.map((c) => (
                      <button key={c} onClick={() => setNewFolderColor(c)}
                        className={`w-8 h-8 rounded-lg transition-all ${newFolderColor === c ? "ring-2 ring-offset-2 ring-indigo-500 scale-110" : "hover:scale-105"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button onClick={() => setShowCreateFolderModal(false)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 font-medium hover:bg-slate-50 transition-colors">{t("common.cancel")}</button>
                <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || isCreatingFolder}
                  className="flex-1 px-4 py-3 rounded-xl bg-accent-gradient hover:brightness-110 text-white font-semibold shadow-lg shadow-accent transition-all disabled:opacity-50">
                  {isCreatingFolder ? t("docs.creating") : t("common.create")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMoveModal && movingDocument && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowMoveModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("docs.moveDocument")}</h2>
                <p className="text-sm text-slate-500 truncate mt-1">{movingDocument.originalFilename}</p>
              </div>
              <div className="p-6 max-h-64 overflow-y-auto space-y-2">
                <button onClick={() => handleMoveDocument(null)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${!movingDocument.folderId ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-indigo-300"}`}>
                  <IconHome />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("docs.rootUnfiled")}</span>
                </button>
                {folders.map((f) => (
                  <button key={f.id} onClick={() => handleMoveDocument(f.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${movingDocument.folderId === f.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-indigo-300"}`}>
                    <IconFolderSolid color={f.color || "#6366f1"} />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{f.path || f.name}</span>
                  </button>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => setShowMoveModal(false)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">{t("common.cancel")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showOnlyOffice && onlyOfficeConfig && (
        <OnlyOfficeEditor
          key={`${onlyOfficeDoc?.id}_${onlyOfficeConfig?.editorConfig?.mode}`}
          config={onlyOfficeConfig}
          onClose={closeOnlyOffice}
          documentName={onlyOfficeDoc?.originalFilename}
          documentId={onlyOfficeDoc?.id}
          lockInfo={onlyOfficeLockInfo}
          onSwitchToEdit={onlyOfficeConfig?.editorConfig?.mode === 'view' && onlyOfficeDoc ? () => handleEditInOnlyOffice(onlyOfficeDoc) : undefined}
          onSaved={handleEditorSaved}
          onRenamed={handleEditorRenamed}
        />
      )}

      {pdfConverting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <svg className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t("docs.convertingPdf")}</p>
            <p className="text-xs text-slate-400">{t("docs.preparingForEdit")}</p>
          </div>
        </div>
      )}

      {showCommentModal && commentingDocument && (
        <CommentModal
          documentId={commentingDocument.id}
          documentName={commentingDocument.originalFilename}
          onClose={handleCloseComment}
        />
      )}

      <AnimatePresence>
        {saveToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl backdrop-blur-xl shadow-2xl border bg-emerald-50/95 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3 text-sm font-medium text-emerald-900 dark:text-emerald-200"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <div className="font-semibold">{t("docs.saved")}</div>
              <div className="text-xs opacity-80">{t("docs.versionPrefix")}{saveToast.version} {t("docs.versionJustNow")}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRenameFolderModal && renamingFolder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("docs.renameFolder")}</h2>
                <button onClick={() => { setShowRenameFolderModal(false); setRenamingFolder(null); }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <IconX className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("docs.newName")}</label>
                  <input type="text" value={renameFolderName} onChange={(e) => setRenameFolderName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                    autoFocus onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowRenameFolderModal(false); setRenamingFolder(null); }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm">
                    {t("common.cancel")}
                  </button>
                  <button onClick={handleRenameFolder}
                    disabled={!renameFolderName.trim() || renameFolderName.trim() === renamingFolder.name}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {t("common.rename")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isDirectUploading || showDirectUploadToast) && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-20 right-6 z-50 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="px-4 py-3 flex items-center gap-3">
              {isDirectUploading ? (
                <>
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t("docs.uploadingFiles")}</p>
                    <p className="text-xs text-slate-500">{t("docs.encryptingProcessingShort")}</p>
                  </div>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{directUploadProgress}%</span>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <IconCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {directUploadResults.filter((r) => r.success).length} {directUploadResults.filter((r) => r.success).length !== 1 ? t("docs.filesUploadedSuffix2") : t("docs.fileUploadedSuffix")}
                    </p>
                    {directUploadResults.some((r) => !r.success) && (
                      <>
                        <p className="text-xs text-red-500">{directUploadResults.filter((r) => !r.success).length} {t("docs.failedSuffix")}</p>
                        <ul className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                          {directUploadResults.filter((r) => !r.success).map((r, i) => (
                            <li key={i} className="text-[11px] text-red-600 dark:text-red-400/80 break-words">
                              <span className="font-medium">{r.name}</span>{r.error ? `: ${r.error}` : ""}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                  <button onClick={() => setShowDirectUploadToast(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <IconX className="w-4 h-4 text-slate-400" />
                  </button>
                </>
              )}
            </div>
            {isDirectUploading && (
              <div className="h-1 bg-slate-100 dark:bg-slate-800">
                <motion.div
                  className="h-full bg-indigo-600 rounded-r-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${directUploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
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
            {dropTargetId
              ? t("docs.releaseToDrop")
              : (dragItem.type === "document" ? t("docs.hoverFolderDocument") : t("docs.hoverFolderFolder"))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            role="status" aria-live="polite"
            className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl backdrop-blur-xl shadow-2xl border flex items-center gap-3 text-sm font-medium ${
              toast.type === "error"
                ? "bg-red-50/95 dark:bg-red-500/15 border-red-200 dark:border-red-500/30 text-red-900 dark:text-red-200"
                : "bg-emerald-50/95 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toast.type === "error" ? "bg-red-500/20" : "bg-emerald-500/20"}`}>
              {toast.type === "error" ? (
                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              )}
            </div>
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewerDoc && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setViewerDoc(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {getFileIcon(getFileTypeFromMime(viewerDoc.mimeType), "w-5 h-5")}
                  <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{viewerDoc.originalFilename}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {getFileTypeFromMime(viewerDoc.mimeType) === "pdf" && (
                    <button onClick={() => { const d = viewerDoc; setViewerDoc(null); handleEditPdf(d); }}
                      className="min-h-[40px] px-3.5 rounded-xl text-sm font-semibold bg-accent-gradient hover:brightness-110 text-white shadow-lg shadow-accent transition-colors inline-flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      {t("common.edit")}
                    </button>
                  )}
                  <button onClick={() => handleDownloadDocument(viewerDoc)}
                    className="min-h-[40px] px-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    {t("common.download")}
                  </button>
                  <button onClick={() => setViewerDoc(null)} aria-label={t("common.close")}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <IconX className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-auto flex items-center justify-center">
                {viewerLoading || !viewerUrl ? (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm">{t("docs.loadingPreview")}</span>
                  </div>
                ) : getFileTypeFromMime(viewerDoc.mimeType) === "image" ? (
                  <img src={viewerUrl} alt={viewerDoc.originalFilename} className="max-w-full max-h-full object-contain" />
                ) : (
                  <iframe src={viewerUrl} title={viewerDoc.originalFilename} className="w-full h-full border-0" />
                )}
              </div>
            </motion.div>
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
