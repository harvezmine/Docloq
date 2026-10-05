import { createElement } from "react";
import {
  FileText,
  FileSearch,
  FilePenLine,
  ListChecks,
  CircleHelp,
  Settings2,
  ReceiptText,
  FileCode2,
  Link2,
  Flame,
  Radar,
  Tag,
  Users,
  Banknote,
  Scale,
  Briefcase,
  Folder,
  FolderOpen,
  Lock,
  ShieldAlert,
  Search,
  Trash2,
  BarChart3,
  Sparkles,
  Zap,
} from "lucide-react";

const iconRegistry = {
  file: FileText,
  fileSearch: FileSearch,
  fileEdit: FilePenLine,
  tasks: ListChecks,
  help: CircleHelp,
  settings: Settings2,
  receipt: ReceiptText,
  contract: FileCode2,
  link: Link2,
  gas: Flame,
  network: Radar,
  tag: Tag,
  users: Users,
  banknote: Banknote,
  scale: Scale,
  briefcase: Briefcase,
  folder: Folder,
  folderOpen: FolderOpen,
  lock: Lock,
  trap: ShieldAlert,
  search: Search,
  trash: Trash2,
  chart: BarChart3,
  insight: Sparkles,
  zap: Zap,
};

const fallbackKey = "help";

const iconSvgRegistry = {
  folder:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  folderOpen:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2"/><path d="M3 10h18l-2 8H5z"/></svg>',
};

const getIconComponent = (key) => {
  const Icon = iconRegistry[key] || iconRegistry[fallbackKey];
  return (props) => createElement(Icon, props);
};
const getIconSvg = (key) => iconSvgRegistry[key] || iconSvgRegistry.folder;

export { iconRegistry, getIconComponent, getIconSvg };
