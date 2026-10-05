import { useState, useEffect, Children, isValidElement } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  User,
  Users,
  Building2,
  ShieldCheck,
  ShieldOff,
  Bell,
  LogOut,
  KeyRound,
  Lock,
  Search,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Copy,
  Globe,
  Mail,
  Phone,
  MapPin,
  Upload,
  Eye,
  EyeOff,
  Monitor,
  Smartphone,
  AlertTriangle,
  Loader2,
  UserPlus,
  Briefcase,
  FileText,
  Clock,
  Ban,
  CheckCircle2,
  ArrowRight,
  Camera,
  Palette,
  Sun,
  Moon,
  MonitorSmartphone,
  Languages,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import useAuthStore from "../../app/store/auth.store";
import { authService } from "../../services/auth.service";
import userService from "../../services/user.service";
import totpService from "../../services/totp.service";
import departmentService from "../../services/department.service";
import organizationService from "@/services/organization.service";
import api from "@/services/api";
import CustomSelect from "@/components/ui/CustomSelect";
import { useLang } from "@/app/providers/LanguageProvider";
import { useTheme } from "@/app/providers/ThemeProvider";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { DEFAULT_ACCENT_ID } from "@/app/providers/accent-presets";

/* ------------------------------------------------------------------ */
/*  Design tokens - one source of truth for the whole settings surface */
/* ------------------------------------------------------------------ */

const PANEL =
  "relative rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-slate-900/55 backdrop-blur-xl shadow-xl shadow-slate-950/5 dark:shadow-black/40 dark:ring-1 dark:ring-inset dark:ring-white/[0.04]";

const FIELD =
  "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.04] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all disabled:opacity-60 disabled:cursor-not-allowed";

const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent-gradient hover:brightness-110 text-white text-sm font-medium transition-all shadow-accent disabled:opacity-50 disabled:cursor-not-allowed";

const BTN_SOFT =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200/70 dark:bg-white/[0.06] border border-slate-300/60 dark:border-white/10 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-300/60 dark:hover:bg-white/[0.1] transition-all disabled:opacity-50 disabled:cursor-not-allowed";

const BTN_DANGER =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed";

const BTN_DANGER_SOFT =
  "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-sm font-medium border border-rose-500/20 hover:bg-rose-500/20 transition-all";

const SUBCARD =
  "rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06]";

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */
/* ------------------------------------------------------------------ */

function Panel({ children, className = "", hover = false, animate = true, accent = true }) {
  const Comp = animate ? motion.div : "div";
  const mp = animate
    ? { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, ease: "easeOut" } }
    : {};
  return (
    <Comp
      {...mp}
      className={`${PANEL} ${hover ? "hover:border-accent-soft hover:shadow-2xl transition-all duration-200" : ""} ${className}`}
    >
      {accent && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-[var(--accent-solid,#4f46e5)]/40 to-transparent"
        />
      )}
      {children}
    </Comp>
  );
}

function IconTile({ icon, className = "", size = "md", tone = "brand" }) {
  const Icon = icon;
  const sizes = { sm: "w-8 h-8 rounded-lg", md: "w-10 h-10 rounded-xl", lg: "w-14 h-14 rounded-2xl" };
  const icons = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-7 h-7" };
  const tones = {
    brand: "bg-accent-gradient-br text-white shadow-accent",
    danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    muted: "bg-slate-200/80 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400",
    ghost: "bg-accent-soft text-accent border border-accent-soft",
  };
  return (
    <div className={`${sizes[size]} ${tones[tone]} flex items-center justify-center shrink-0 ${className}`}>
      <Icon className={icons[size]} strokeWidth={2} />
    </div>
  );
}

// Section intro used at the top of every tab: icon tile + title + gradient tick + description.
function TabIntro({ icon: Icon, title, desc, actions, className = "mb-6" }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 ${className}`}>
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && <IconTile icon={Icon} />}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          <div className="mt-1.5 h-[2px] w-8 rounded-full bg-accent-gradient" />
          {desc && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{desc}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

function Field({ label, error, icon: Icon, className = "", ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
        )}
        <input
          className={`${FIELD} ${Icon ? "pl-10" : ""} ${error ? "border-rose-500 focus:ring-rose-500/40" : ""} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
    </div>
  );
}

// Backed by the shared CustomSelect (no native <select> chrome). Keeps the old
// API: <option> children become options, an empty-value option becomes the
// placeholder, and onChange still receives an { target: { value } } shape.
function SelectField({ label, children, className = "", value, onChange, disabled, required }) {
  let placeholder = required ? "" : "Select…";
  const options = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const val = child.props.value ?? "";
    const text = child.props.children;
    if (val === "") {
      placeholder = text || placeholder;
      return;
    }
    options.push({ value: val, label: text, disabled: child.props.disabled });
  });

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>}
      <CustomSelect
        value={value ?? ""}
        onChange={(v) => onChange?.({ target: { value: v } })}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        ariaLabel={typeof label === "string" ? label : undefined}
        className={className}
      />
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} aria-label={label} />
      <div className="w-11 h-6 rounded-full bg-slate-300 dark:bg-white/10 transition-colors peer-checked:bg-accent-gradient peer-focus-visible:ring-2 peer-focus-visible:ring-accent after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-slate-50 after:shadow-sm after:transition-all peer-checked:after:translate-x-5" />
    </label>
  );
}

function Spinner({ className = "w-4 h-4" }) {
  return <Loader2 className={`${className} animate-spin`} />;
}

// Modal shell: dimmed blurred backdrop + animated glass card.
function ModalShell({ onClose, children, maxW = "max-w-md", scroll = false }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${maxW} rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 shadow-2xl shadow-black/40 dark:ring-1 dark:ring-inset dark:ring-white/[0.05] overflow-hidden ${scroll ? "max-h-[90vh] flex flex-col" : ""}`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// Gradient banner header for form modals.
function ModalHeader({ icon, title, subtitle, onClose }) {
  const Icon = icon;
  return (
    <div className="relative bg-accent-gradient px-6 py-5 shrink-0">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_0%,white,transparent_50%)]" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-white/70">{subtitle}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}

// Six-box OTP input (2FA enable / disable).
function OtpInput({ value, onChange, tone = "brand" }) {
  const ring = tone === "danger" ? "focus:ring-rose-500/50 focus:border-rose-500/50" : "focus:ring-accent focus:border-accent";
  return (
    <div className="flex justify-center gap-2">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <input
          key={index}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ""}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, "");
            const next = value.split("");
            next[index] = digit;
            onChange(next.join(""));
            if (digit && e.target.nextElementSibling) e.target.nextElementSibling.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[index] && e.target.previousElementSibling) {
              e.target.previousElementSibling.focus();
            }
          }}
          className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.04] text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring} transition-all`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Settings() {
  const { t, lang, setLang } = useLang();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { accent, setAccent, presets } = usePreferences();
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState("profile");
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(1);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAError, setTwoFAError] = useState("");
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Change-password form (Security tab)
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  const [departmentsList, setDepartmentsList] = useState([]);
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: "", description: "", color: "#6366f1" });
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [deptMembers, setDeptMembers] = useState({ department: null, members: [] });
  const [deptMembersLoading, setDeptMembersLoading] = useState(false);
  const [showDeleteDeptModal, setShowDeleteDeptModal] = useState(false);
  const [deletingDept, setDeletingDept] = useState(null);

  const [companyProfile, setCompanyProfile] = useState(null);
  const [companyOrg, setCompanyOrg] = useState(null);
  const [companyForm, setCompanyForm] = useState({});
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Notification preferences (local only - same behavior as before)
  const [notifPrefs, setNotifPrefs] = useState({ email: true, docs: true, tasks: true, security: true });

  // Profile photo upload. Client-side checks are UX only - the server re-validates
  // via magic-byte sniffing and re-encodes the image before anything is stored.
  const [avatarBusy, setAvatarBusy] = useState(false);
  const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

  const handleAvatarUpload = async (file) => {
    if (!file || avatarBusy) return;
    if (!AVATAR_TYPES.includes(file.type)) return toast.error(t("settings.profile.photoInvalidType"));
    if (file.size > AVATAR_MAX_BYTES) return toast.error(t("settings.profile.photoTooLarge"));
    setAvatarBusy(true);
    try {
      const res = await authService.uploadAvatar(file);
      if (res?.success) {
        updateUser({ avatarUrl: res.data?.avatarUrl || null });
        toast.success(t("settings.profile.photoUpdated"));
      } else {
        toast.error(res?.message || t("settings.profile.photoFailed"));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t("settings.profile.photoFailed"));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (avatarBusy) return;
    setAvatarBusy(true);
    try {
      const res = await authService.deleteAvatar();
      if (res?.success) {
        updateUser({ avatarUrl: null });
        toast.success(t("settings.profile.photoRemoved"));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t("settings.profile.photoFailed"));
    } finally {
      setAvatarBusy(false);
    }
  };

  useEffect(() => {
    const fetch2FAStatus = async () => {
      try {
        const response = await totpService.getStatus();
        if (response.success) {
          setTwoFAEnabled(response.data.enabled);
        }
      } catch (error) {
        console.error("Error fetching 2FA status:", error);
      }
    };
    fetch2FAStatus();
  }, []);

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    department: "",
    position: user?.position || "",
  });

  // Re-sync on user/departments change so a new login never shows the previous user's data.
  useEffect(() => {
    if (!user) return;
    setProfileForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      department: departmentsList.find((d) => d.id === user.departmentId)?.name || "",
      position: user.position || "",
    });
  }, [user, departmentsList]);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await authService.getSessions();
      if (res?.success) setSessions(res.data?.sessions || []);
    } catch (e) {
      console.error("Error fetching sessions:", e);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "security") fetchSessions();
  }, [activeTab]);

  const [newUserForm, setNewUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    departmentId: "",
    position: "",
    role: "user",
  });

  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    }
    if (activeTab === "departments") {
      fetchDepartments();
    }
  }, [activeTab]);

  // Fetch departments on mount (needed for user management dropdown too)
  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const res = await organizationService.getProfile();
        const { organization, profile } = res.data?.data || {};
        setCompanyOrg(organization || null);
        setCompanyProfile(profile || null);
        setCompanyForm(profile || {});
      } catch { /* non-critical */ } finally {
        setIsLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await userService.getUsers({ limit: 50 });
      if (response.success) {
        setUsers(response.data.users.map(u => ({
          ...u,
          status: u.isActive ? "Active" : "Inactive",
          initials: `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || 'U',
        })));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchDepartments = async () => {
    setDeptsLoading(true);
    try {
      const response = await departmentService.getDepartments();
      if (response.success) {
        setDepartmentsList(response.data);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    } finally {
      setDeptsLoading(false);
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    try {
      const fn = editingDept
        ? departmentService.updateDepartment(editingDept.id, deptForm)
        : departmentService.createDepartment(deptForm);
      const response = await fn;
      if (response.success) {
        await fetchDepartments();
        setShowDeptModal(false);
        setEditingDept(null);
        setDeptForm({ name: "", description: "", color: "#6366f1" });
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
      }
    } catch (error) {
      setErrorMessage(error.message || t("settings.errors.saveDept"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDept = async () => {
    if (!deletingDept) return;
    setIsLoading(true);
    try {
      const response = await departmentService.deleteDepartment(deletingDept.id);
      if (response.success) {
        await fetchDepartments();
        setShowDeleteDeptModal(false);
        setDeletingDept(null);
      }
    } catch (error) {
      setErrorMessage(error.message || t("settings.errors.deleteDept"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (type, file) => {
    if (!file) return;
    const setter = type === 'logo' ? setUploadingLogo : setUploadingCover;
    setter(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', type);
      const res = await api.post('/organizations/profile/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.data?.url;
      if (url) {
        setCompanyForm(f => ({ ...f, [type === 'logo' ? 'logoUrl' : 'coverUrl']: url }));
        toast.success(type === 'logo' ? t("settings.company.logoUploaded") : t("settings.company.coverUploaded"));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t("settings.company.uploadFailed"));
    } finally {
      setter(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await organizationService.updateProfile(companyForm);
      setCompanyProfile(res.data?.data || null);
      setIsEditingProfile(false);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      toast.error(err.response?.data?.message || t("settings.company.saveFailed"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const fetchDeptMembers = async (dept) => {
    setDeptMembersLoading(true);
    setShowMembersModal(true);
    setDeptMembers({ department: dept, members: [] });
    try {
      const response = await departmentService.getDepartmentMembers(dept.id);
      if (response.success) {
        setDeptMembers(response.data);
      }
    } catch (error) {
      console.error("Error fetching department members:", error);
    } finally {
      setDeptMembersLoading(false);
    }
  };

  const tabs = [
    { id: "profile", name: t("settings.tabs.profile"), mobileShort: t("settings.tabs.profileShort"), icon: User },
    { id: "preferences", name: t("settings.tabs.preferences"), mobileShort: t("settings.tabs.preferencesShort"), icon: Palette },
    { id: "users", name: t("settings.tabs.users"), mobileShort: t("settings.tabs.usersShort"), adminOnly: true, icon: Users },
    { id: "departments", name: t("settings.tabs.departments"), mobileShort: t("settings.tabs.departmentsShort"), adminOnly: true, icon: Building2 },
    { id: "security", name: t("settings.tabs.security"), mobileShort: t("settings.tabs.securityShort"), icon: ShieldCheck },
    { id: "notifications", name: t("settings.tabs.notifications"), mobileShort: t("settings.tabs.notificationsShort"), icon: Bell },
    { id: "company", name: t("settings.tabs.company"), mobileShort: t("settings.tabs.companyShort"), icon: Briefcase },
  ];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Still navigate to login even if API fails
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Only the owner can grant the admin role; an admin can create regular users only.
  const roles = user?.role === 'owner' ? ["admin", "user"] : ["user"];
  const roleLabels = {
    owner: t("settings.roles.owner"),
    admin: t("settings.roles.admin"),
    user: t("settings.roles.user"),
  };
  const departments = departmentsList.map(d => d.name);

  const isAdmin = ['owner', 'admin'].includes(user?.role);

  const filteredUsers = users.filter(u =>
    `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (departmentsList.find(d => d.id === u.departmentId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    try {
      const deptId = departmentsList.find((d) => d.name === profileForm.department)?.id;
      const res = await authService.updateProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
        position: profileForm.position,
        departmentId: deptId ?? null,
      });
      if (res?.success) {
        updateUser(res.data.user);
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || t("settings.errors.updateProfile"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    if (!pwForm.current || !pwForm.next) return setPwError(t("settings.security.pwRequired"));
    if (pwForm.next.length < 8) return setPwError(t("settings.security.pwTooShort"));
    if (pwForm.next !== pwForm.confirm) return setPwError(t("settings.security.pwMismatch"));
    if (pwForm.next === pwForm.current) return setPwError(t("settings.security.pwSameAsOld"));

    setPwSaving(true);
    try {
      const res = await authService.changePassword(pwForm.current, pwForm.next);
      if (res?.success) {
        setPwForm({ current: "", next: "", confirm: "" });
        setPwSuccess(true);
        setTimeout(() => setPwSuccess(false), 3000);
        // Other devices were signed out server-side; refresh the session list
        fetchSessions();
      } else {
        setPwError(res?.message || t("settings.security.pwFailed"));
      }
    } catch (err) {
      setPwError(err.response?.data?.message || t("settings.security.pwFailed"));
    } finally {
      setPwSaving(false);
    }
  };

  const deviceLabel = (ua) => {
    if (!ua) return t("settings.security.unknownDevice");
    const os = /Windows/i.test(ua) ? "Windows"
      : /Macintosh|Mac OS/i.test(ua) ? "macOS"
      : /iPhone|iPad/i.test(ua) ? "iOS"
      : /Android/i.test(ua) ? "Android"
      : /Linux/i.test(ua) ? "Linux" : t("settings.security.device");
    const browser = /Edg/i.test(ua) ? "Edge"
      : /OPR|Opera/i.test(ua) ? "Opera"
      : /Chrome/i.test(ua) ? "Chrome"
      : /Firefox/i.test(ua) ? "Firefox"
      : /Safari/i.test(ua) ? "Safari" : t("settings.security.browser");
    return `${os} · ${browser}`;
  };

  const isMobileUA = (ua) => /iPhone|iPad|Android|Mobile/i.test(ua || "");

  const relativeTime = (d) => {
    if (!d) return "-";
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t("settings.security.justNow");
    if (m < 60) return `${m} ${t("settings.security.minutesAgo")}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ${t("settings.security.hoursAgo")}`;
    return `${Math.floor(h / 24)} ${t("settings.security.daysAgo")}`;
  };

  const handleRevokeSession = async (id) => {
    try {
      const res = await authService.revokeSession(id);
      if (res?.success) setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setErrorMessage(e.response?.data?.message || t("settings.errors.revokeSession"));
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingAll(true);
    try {
      const res = await authService.revokeOtherSessions();
      if (res?.success) await fetchSessions();
    } catch (e) {
      setErrorMessage(e.response?.data?.message || t("settings.errors.signOutOthers"));
    } finally {
      setRevokingAll(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await userService.createUser({
        email: newUserForm.email,
        password: newUserForm.password,
        firstName: newUserForm.firstName,
        lastName: newUserForm.lastName,
        role: newUserForm.role,
        departmentId: newUserForm.departmentId || undefined,
        position: newUserForm.position,
        phone: newUserForm.phone,
      });

      if (response.success) {
        await fetchUsers();

        setNewUserForm({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          phone: "",
          departmentId: "",
          position: "",
          role: "user",
        });
        setShowAddUserModal(false);
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
      }
    } catch (error) {
      setErrorMessage(error.message || t("settings.errors.createUser"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsLoading(true);
    try {
      const response = await userService.deleteUser(selectedUser.id);
      if (response.success) {
        await fetchUsers();
        setShowDeleteModal(false);
        setSelectedUser(null);
      }
    } catch (error) {
      setErrorMessage(error.message || t("settings.errors.deleteUser"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId) => {
    try {
      const response = await userService.toggleUserStatus(userId);
      if (response.success) {
        await fetchUsers();
      }
    } catch (error) {
      setErrorMessage(error.message || t("settings.errors.toggleStatus"));
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "owner": return "bg-violet-500/12 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 border border-violet-500/25";
      case "admin":
      case "Admin": return "bg-indigo-500/12 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-500/25";
      case "editor":
      case "Editor": return "bg-sky-500/12 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 border border-sky-500/25";
      default: return "bg-slate-500/10 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 border border-slate-400/25 dark:border-white/10";
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      owner: t("settings.roles.owner"),
      admin: t("settings.roles.admin"),
      user: t("settings.roles.user"),
    };
    return labels[role] || role;
  };

  const getStatusBadgeColor = (status) => {
    return status === "Active"
      ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-500/25"
      : "bg-rose-500/12 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-500/25";
  };

  const notifRows = [
    { key: "email", icon: Mail, title: t("settings.notifs.email"), desc: t("settings.notifs.emailDesc") },
    { key: "docs", icon: FileText, title: t("settings.notifs.docs"), desc: t("settings.notifs.docsDesc") },
    { key: "tasks", icon: Clock, title: t("settings.notifs.tasks"), desc: t("settings.notifs.tasksDesc") },
    { key: "security", icon: ShieldCheck, title: t("settings.notifs.security"), desc: t("settings.notifs.securityDesc") },
  ];

  return (
    <DashboardLayout>
      {/* Save-success toast */}
      <AnimatePresence>
        {showSaveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-4 right-4 z-[100] max-w-sm"
          >
            <div className="rounded-2xl border border-emerald-500/25 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-emerald-500/15 p-4 flex items-start gap-3">
              <IconTile icon={Check} tone="success" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{t("settings.saveToast.title")}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("settings.saveToast.desc")}</p>
              </div>
              <button
                onClick={() => setShowSaveSuccess(false)}
                aria-label={t("common.close")}
                className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/[0.06] transition-colors shrink-0"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader
        eyebrow={t("settings.header.eyebrow")}
        title={t("common.settings")}
        subtitle={t("settings.header.subtitle")}
      />

      <div className="relative flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
        {/* Ambient glow */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/4 w-[36rem] h-[22rem] rounded-full bg-accent-wash blur-3xl -z-10" />
        <div aria-hidden="true" className="pointer-events-none absolute top-40 right-0 w-[28rem] h-[20rem] rounded-full bg-accent-wash blur-3xl -z-10" />

        {/* Mobile: sticky pill rail below the fixed app header */}
        <div className="lg:hidden sticky top-16 z-20 w-full -mx-4 px-4 py-2 bg-slate-100/85 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/[0.06]">
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex gap-2 min-w-max pb-0.5">
              {tabs.filter(tab => !tab.adminOnly || isAdmin).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      active
                        ? "bg-accent-gradient text-white shadow-accent"
                        : "bg-slate-200/60 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border border-slate-300/50 dark:border-white/[0.06]"
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2} />
                    <span className="hidden sm:inline">{tab.name}</span>
                    <span className="sm:hidden">{tab.mobileShort || tab.name}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all duration-200"
              >
                <LogOut className="w-4 h-4" strokeWidth={2} />
                <span>{t("settings.nav.logout")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Desktop: sticky vertical nav */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block w-64 shrink-0 lg:sticky lg:top-20"
        >
          <Panel className="p-2">
            <nav className="space-y-1">
              {tabs.filter(tab => !tab.adminOnly || isAdmin).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active
                        ? "bg-accent-gradient text-white shadow-accent-sm"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                    <span className="truncate">{tab.name}</span>
                    {active && <ArrowRight className="w-4 h-4 ml-auto opacity-70" />}
                  </button>
                );
              })}
              <div className="pt-2 mt-2 border-t border-slate-200 dark:border-white/[0.08]">
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
                >
                  <LogOut className="w-[18px] h-[18px]" strokeWidth={2} />
                  {t("settings.nav.signOut")}
                </button>
              </div>
            </nav>
          </Panel>
        </motion.div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex-1 min-w-0 w-full"
        >
          {/* ---------------- Profile ---------------- */}
          {activeTab === "profile" && (
            <Panel className="overflow-hidden p-0" accent={false}>
              {/* Identity banner */}
              <div className="relative h-28 sm:h-32 bg-accent-gradient">
                <div aria-hidden="true" className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_75%_10%,white,transparent_45%)]" />
                <div aria-hidden="true" className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(circle_at_20%_90%,white,transparent_40%)]" />
                <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-slate-950/30 to-transparent" />
              </div>

              <div className="px-5 sm:px-6 pb-6">
                {/* Hidden file input shared by the overlay + camera badge */}
                <input
                  id="avatar-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={avatarBusy}
                  onChange={(e) => { handleAvatarUpload(e.target.files?.[0]); e.target.value = ""; }}
                />

                {/* Only the avatar overlaps the banner, pulling the whole row up
                    would push the name and the photo actions underneath it. */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
                  {/* Avatar with hover overlay + camera badge */}
                  <div className="relative shrink-0 w-fit mx-auto sm:mx-0 -mt-14">
                    <div className="group relative w-24 h-24 rounded-3xl overflow-hidden ring-4 ring-slate-50 dark:ring-slate-900 shadow-xl shadow-slate-950/30">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={t("settings.profile.title")} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-accent-gradient-br flex items-center justify-center text-2xl font-bold text-white">
                          {(profileForm.firstName[0] || "") + (profileForm.lastName[0] || "") || "U"}
                        </div>
                      )}
                      <label
                        htmlFor="avatar-file-input"
                        aria-label={t("settings.profile.changePhoto")}
                        className={`absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] cursor-pointer transition-opacity ${avatarBusy ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                      >
                        {avatarBusy ? <Spinner className="w-6 h-6 text-white" /> : <Camera className="w-6 h-6 text-white" />}
                      </label>
                    </div>
                    <label
                      htmlFor="avatar-file-input"
                      aria-label={t("settings.profile.changePhoto")}
                      className="absolute -bottom-1.5 -right-1.5 w-9 h-9 rounded-xl bg-accent-gradient-br text-white flex items-center justify-center shadow-accent ring-2 ring-slate-50 dark:ring-slate-900 cursor-pointer hover:brightness-110 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                    </label>
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0 text-center sm:text-left pt-1">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white truncate">
                      {profileForm.firstName} {profileForm.lastName}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {[profileForm.position, profileForm.email].filter(Boolean).join(" · ")}
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 flex-wrap">
                      {profileForm.department && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-soft text-accent border border-accent-soft">
                          <Building2 className="w-3.5 h-3.5" />
                          {profileForm.department}
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${getRoleBadgeColor(user?.role)}`}>
                        {getRoleLabel(user?.role)}
                      </span>
                    </div>
                  </div>

                  {/* Photo actions */}
                  <div className="flex flex-col items-center sm:items-end gap-1 shrink-0 pt-1">
                    <label
                      htmlFor="avatar-file-input"
                      className={`${BTN_SOFT} !px-4 !py-2 cursor-pointer ${avatarBusy ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <Upload className="w-4 h-4" />
                      {t("settings.profile.uploadPhoto")}
                    </label>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("settings.profile.photoHint")}</p>
                    {user?.avatarUrl && (
                      <button
                        type="button"
                        onClick={handleAvatarRemove}
                        disabled={avatarBusy}
                        className="text-[11px] font-medium text-rose-500 dark:text-rose-400 hover:underline disabled:opacity-50"
                      >
                        {t("settings.profile.removePhoto")}
                      </button>
                    )}
                  </div>
                </div>

                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  {/* Personal information */}
                  <div className={`${SUBCARD} p-4 sm:p-5`}>
                    <div className="flex items-center gap-2.5 mb-4">
                      <IconTile icon={User} size="sm" tone="ghost" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{t("settings.profile.personalInfo")}</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field
                        label={t("settings.profile.firstName")}
                        icon={User}
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      />
                      <Field
                        label={t("settings.profile.lastName")}
                        icon={User}
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      />
                      <div>
                        <Field
                          label={t("settings.profile.emailAddress")}
                          icon={Mail}
                          type="email"
                          value={profileForm.email}
                          disabled
                          readOnly
                        />
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{t("settings.profile.emailLocked")}</p>
                      </div>
                      <Field
                        label={t("settings.profile.phoneNumber")}
                        icon={Phone}
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Work */}
                  <div className={`${SUBCARD} p-4 sm:p-5`}>
                    <div className="flex items-center gap-2.5 mb-4">
                      <IconTile icon={Briefcase} size="sm" tone="ghost" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{t("settings.profile.workInfo")}</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SelectField
                        label={t("settings.profile.department")}
                        value={profileForm.department}
                        onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                      >
                        <option value="">{t("settings.profile.selectDepartment")}</option>
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </SelectField>
                      <Field
                        label={t("settings.profile.position")}
                        icon={Briefcase}
                        value={profileForm.position}
                        onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
                      />
                    </div>
                  </div>

                  {errorMessage && activeTab === "profile" && (
                    <p className="text-xs text-rose-500 dark:text-rose-400">{errorMessage}</p>
                  )}

                  <div className="flex justify-end pt-1">
                    <button type="submit" disabled={isLoading} className={BTN_PRIMARY}>
                      {isLoading ? <Spinner /> : <Check className="w-4 h-4" />}
                      {t("settings.profile.saveChanges")}
                    </button>
                  </div>
                </form>
              </div>
            </Panel>
          )}

          {/* ---------------- Preferences ---------------- */}
          {activeTab === "preferences" && (
            <Panel className="p-4 sm:p-6">
              <TabIntro
                icon={Palette}
                title={t("settings.prefs.title")}
                desc={t("settings.prefs.desc")}
                actions={
                  <button
                    type="button"
                    onClick={() => { setAccent(DEFAULT_ACCENT_ID); setThemeMode("system"); toast.success(t("settings.prefs.resetDone")); }}
                    className={`${BTN_SOFT} !px-4 !py-2`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t("settings.prefs.resetDefault")}
                  </button>
                }
              />

              <div className="space-y-5">
                {/* Accent color */}
                <div className={`${SUBCARD} p-4 sm:p-5`}>
                  <div className="flex items-start gap-3.5 mb-4">
                    <IconTile icon={Palette} />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("settings.prefs.accent")}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("settings.prefs.accentDesc")}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {presets.map((p) => {
                      const active = accent === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setAccent(p.id); toast.success(t("settings.prefs.accentApplied")); }}
                          aria-pressed={active}
                          className={`group relative flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                            active
                              ? "border-accent-soft bg-accent-soft shadow-accent-sm"
                              : "border-slate-200 dark:border-white/[0.08] bg-slate-200/40 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20"
                          }`}
                        >
                          <span
                            className="w-9 h-9 rounded-lg shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                            style={{ backgroundImage: `linear-gradient(to bottom right, ${p.from}, ${p.to})` }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className={`block text-xs font-medium truncate ${active ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
                              {p.name[lang] || p.name.en}
                            </span>
                          </span>
                          {active && (
                            /* uses the gradient's dark stop, not `solid` - white on a
                               light `solid` (lime/amber) would be unreadable */
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white"
                              style={{ backgroundColor: p.from }}
                            >
                              <Check className="w-3 h-3" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Live preview - these use the same accent utilities as the real UI */}
                  <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-white/[0.06]">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                      {t("settings.prefs.preview")}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`${BTN_PRIMARY} pointer-events-none`}>
                        <Check className="w-4 h-4" />
                        {t("settings.prefs.previewButton")}
                      </span>
                      <span className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-accent-gradient text-white text-sm font-medium shadow-accent">
                        <Sparkles className="w-4 h-4" />
                        {t("settings.prefs.previewActive")}
                      </span>
                      <IconTile icon={Building2} />
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-soft text-accent border border-accent-soft">
                        <Check className="w-3.5 h-3.5" />
                        {t("settings.statusLabel.active")}
                      </span>
                      <Toggle checked onChange={() => {}} label={t("settings.prefs.preview")} />
                    </div>
                  </div>
                </div>

                {/* Appearance */}
                <div className={`${SUBCARD} p-4 sm:p-5`}>
                  <div className="flex items-start gap-3.5 mb-4">
                    <IconTile icon={themeMode === "light" ? Sun : themeMode === "dark" ? Moon : MonitorSmartphone} />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("settings.prefs.appearance")}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("settings.prefs.appearanceDesc")}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: "light", label: t("settings.prefs.light"), icon: Sun },
                      { id: "dark", label: t("settings.prefs.dark"), icon: Moon },
                      { id: "system", label: t("settings.prefs.system"), icon: MonitorSmartphone },
                    ].map((opt) => {
                      const OptIcon = opt.icon;
                      const active = themeMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setThemeMode(opt.id)}
                          aria-pressed={active}
                          className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border transition-all ${
                            active
                              ? "border-accent-soft bg-accent-soft text-accent shadow-accent-sm"
                              : "border-slate-200 dark:border-white/[0.08] bg-slate-200/40 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                          }`}
                        >
                          <OptIcon className="w-5 h-5" strokeWidth={2} />
                          <span className="text-xs font-medium">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Language */}
                <div className={`${SUBCARD} p-4 sm:p-5`}>
                  <div className="flex items-start gap-3.5 mb-4">
                    <IconTile icon={Languages} />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("settings.prefs.language")}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("settings.prefs.languageDesc")}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 max-w-sm">
                    {[
                      { id: "id", label: "Bahasa Indonesia", short: "ID" },
                      { id: "en", label: "English", short: "EN" },
                    ].map((opt) => {
                      const active = lang === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setLang(opt.id)}
                          aria-pressed={active}
                          className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border transition-all ${
                            active
                              ? "border-accent-soft bg-accent-soft shadow-accent-sm"
                              : "border-slate-200 dark:border-white/[0.08] bg-slate-200/40 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20"
                          }`}
                        >
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                            active ? "bg-accent-gradient text-white" : "bg-slate-300/60 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400"
                          }`}>
                            {opt.short}
                          </span>
                          <span className={`text-xs font-medium truncate ${active ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {/* ---------------- Users ---------------- */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <Panel className="p-4 sm:p-6 pb-5">
                <TabIntro
                  className="mb-5"
                  icon={Users}
                  title={t("settings.users.title")}
                  desc={t("settings.users.desc")}
                  actions={isAdmin && (
                    <button onClick={() => setShowAddUserModal(true)} className={BTN_PRIMARY}>
                      <UserPlus className="w-4 h-4" />
                      <span>{t("settings.users.addUser")}</span>
                    </button>
                  )}
                />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: t("settings.users.totalUsers"), value: users.length, icon: Users, cls: "text-indigo-600 dark:text-indigo-300", tile: "bg-indigo-500/10 border-indigo-500/20" },
                    { label: t("settings.users.activeUsers"), value: users.filter(u => u.status === "Active").length, icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-300", tile: "bg-emerald-500/10 border-emerald-500/20" },
                    { label: t("settings.users.admins"), value: users.filter(u => ['owner', 'admin'].includes(u.role)).length, icon: ShieldCheck, cls: "text-violet-600 dark:text-violet-300", tile: "bg-violet-500/10 border-violet-500/20" },
                    { label: t("settings.users.departments"), value: departmentsList.length, icon: Building2, cls: "text-sky-600 dark:text-sky-300", tile: "bg-sky-500/10 border-sky-500/20" },
                  ].map((s) => {
                    const SIcon = s.icon;
                    return (
                      <div key={s.label} className={`${SUBCARD} p-4 flex items-center gap-3`}>
                        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${s.tile} ${s.cls}`}>
                          <SIcon className="w-4.5 h-4.5" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xl font-semibold leading-none tabular-nums ${s.cls}`}>{s.value}</p>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">{s.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-white/[0.08]">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={t("settings.users.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`${FIELD} pl-10`}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  {usersLoading ? (
                    <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500 dark:text-slate-400">
                      <Spinner className="w-5 h-5 text-accent" />
                      {t("common.loading")}
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/[0.08]">
                          <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("settings.users.colUser")}</th>
                          <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">{t("settings.users.colContact")}</th>
                          <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">{t("settings.users.colDepartment")}</th>
                          <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("settings.users.colRole")}</th>
                          <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">{t("settings.users.colStatus")}</th>
                          {isAdmin && <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("settings.users.colActions")}</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 dark:divide-white/[0.06]">
                        {filteredUsers.map((u, index) => (
                          <motion.tr
                            key={u.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.04, 0.4) }}
                            className="hover:bg-accent-soft dark:hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-accent-gradient-br flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-accent-sm">
                                  {u.initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                    {u.firstName} {u.lastName}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate md:hidden">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 hidden md:table-cell">
                              <p className="text-sm text-slate-700 dark:text-slate-300">{u.email}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{u.phone || '-'}</p>
                            </td>
                            <td className="px-5 py-3.5 hidden lg:table-cell">
                              <p className="text-sm text-slate-700 dark:text-slate-300">{departmentsList.find(d => d.id === u.departmentId)?.name || '-'}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{u.position || '-'}</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${getRoleBadgeColor(u.role)}`}>
                                {getRoleLabel(u.role)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 hidden sm:table-cell">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${getStatusBadgeColor(u.status)}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${u.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                                {u.status === "Active" ? t("settings.statusLabel.active") : t("settings.statusLabel.inactive")}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="px-5 py-3.5">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleToggleUserStatus(u.id)}
                                    className={`p-2 rounded-lg transition-colors ${
                                      u.isActive
                                        ? 'text-amber-500 hover:bg-amber-500/10'
                                        : 'text-emerald-500 hover:bg-emerald-500/10'
                                    }`}
                                    title={u.isActive ? t("settings.users.deactivate") : t("settings.users.activate")}
                                    aria-label={u.isActive ? t("settings.users.deactivate") : t("settings.users.activate")}
                                  >
                                    {u.isActive ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => { setSelectedUser(u); setShowDeleteModal(true); }}
                                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                                    title={t("common.delete")}
                                    aria-label={t("common.delete")}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {/* ---------------- Departments ---------------- */}
          {activeTab === "departments" && (
            <div className="space-y-4">
              <Panel className="p-4 sm:p-6">
                <TabIntro
                  className="mb-0"
                  icon={Building2}
                  title={t("settings.departments.title")}
                  desc={t("settings.departments.desc")}
                  actions={
                    <button
                      onClick={() => { setEditingDept(null); setDeptForm({ name: "", description: "", color: "#6366f1" }); setShowDeptModal(true); setErrorMessage(""); }}
                      className={BTN_PRIMARY}
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t("settings.departments.addDepartment")}</span>
                    </button>
                  }
                />
              </Panel>

              {deptsLoading ? (
                <Panel className="p-12">
                  <div className="flex items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <Spinner className="w-5 h-5 text-accent" />
                    {t("settings.departments.loadingDepartments")}
                  </div>
                </Panel>
              ) : departmentsList.length === 0 ? (
                <Panel className="p-12">
                  <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="absolute inset-0 rounded-2xl bg-accent-gradient-br opacity-30 blur-lg" />
                      <div className="relative w-16 h-16 rounded-2xl bg-accent-soft border border-accent-soft flex items-center justify-center text-accent">
                        <Building2 className="w-8 h-8" strokeWidth={1.75} />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">{t("settings.departments.noDepartments")}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t("settings.departments.noDepartmentsDesc")}</p>
                  </div>
                </Panel>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {departmentsList.map((dept, index) => (
                    <motion.div
                      key={dept.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.4) }}
                    >
                      <Panel className="p-5" hover animate={false}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                              style={{ backgroundColor: (dept.color || '#6366f1') + '1a', borderColor: (dept.color || '#6366f1') + '33' }}
                            >
                              <Building2 className="w-5 h-5" style={{ color: dept.color || '#6366f1' }} strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{dept.name}</h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{dept.description || t("settings.departments.noDescription")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => { setEditingDept(dept); setDeptForm({ name: dept.name, description: dept.description || "", color: dept.color || "#6366f1" }); setShowDeptModal(true); setErrorMessage(""); }}
                              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              title={t("common.edit")}
                              aria-label={t("common.edit")}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setDeletingDept(dept); setShowDeleteDeptModal(true); setErrorMessage(""); }}
                              className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                              title={t("common.delete")}
                              aria-label={t("common.delete")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => fetchDeptMembers(dept)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-accent-soft text-accent border border-accent-soft hover:brightness-110 transition-colors"
                          >
                            <Users className="w-3.5 h-3.5" />
                            {dept.memberCount || 0} {(dept.memberCount || 0) === 1 ? t("settings.departments.memberSingular") : t("settings.departments.membersPlural")}
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white/40 dark:ring-white/10" style={{ backgroundColor: dept.color || '#6366f1' }} />
                            <span className="text-xs text-slate-400 tabular-nums">{new Date(dept.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </Panel>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------------- Security ---------------- */}
          {activeTab === "security" && (
            <Panel className="p-4 sm:p-6">
              <TabIntro icon={ShieldCheck} title={t("settings.security.title")} desc={t("settings.security.desc")} />

              <div className="space-y-5">
                {/* Change password */}
                <div className={`${SUBCARD} p-4 sm:p-5`}>
                  <div className="flex items-start gap-3.5 mb-4">
                    <IconTile icon={KeyRound} />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("settings.security.changePassword")}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("settings.security.changePasswordDesc")}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                    <Field
                      label={t("settings.security.currentPassword")}
                      icon={Lock}
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={pwForm.current}
                      onChange={(e) => { setPwForm((p) => ({ ...p, current: e.target.value })); setPwError(""); }}
                    />
                    <Field
                      label={t("settings.security.newPassword")}
                      icon={KeyRound}
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={pwForm.next}
                      onChange={(e) => { setPwForm((p) => ({ ...p, next: e.target.value })); setPwError(""); }}
                    />
                    <Field
                      label={t("settings.security.confirmPassword")}
                      icon={CheckCircle2}
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={pwForm.confirm}
                      onChange={(e) => { setPwForm((p) => ({ ...p, confirm: e.target.value })); setPwError(""); }}
                    />
                  </div>
                  {pwError && <p className="mt-3 text-xs text-rose-500 dark:text-rose-400">{pwError}</p>}
                  {pwSuccess && <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">{t("settings.security.pwSuccess")}</p>}
                  <div className="mt-4 flex justify-end">
                    <button type="button" onClick={handleChangePassword} disabled={pwSaving} className={BTN_PRIMARY}>
                      {pwSaving ? <Spinner /> : <Check className="w-4 h-4" />}
                      {t("settings.security.updatePassword")}
                    </button>
                  </div>
                </div>

                {/* 2FA */}
                <div className={`${SUBCARD} p-4 sm:p-5`}>
                  <div className="flex items-start gap-3.5 mb-4">
                    <IconTile icon={Smartphone} />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("settings.security.twoFA")}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("settings.security.twoFADesc")}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-200/50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <IconTile icon={twoFAEnabled ? ShieldCheck : ShieldOff} tone={twoFAEnabled ? "success" : "muted"} />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {twoFAEnabled ? t("settings.security.enabled") : t("settings.security.disabled")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {twoFAEnabled ? t("settings.security.protectedYes") : t("settings.security.protectedNo")}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {twoFAEnabled ? (
                        <button
                          onClick={() => { setShowDisable2FAModal(true); setDisableCode(""); setTwoFAError(""); }}
                          className={BTN_DANGER_SOFT}
                        >
                          <ShieldOff className="w-4 h-4" />
                          <span>{t("settings.security.disable")}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setShow2FAModal(true);
                            setTwoFAStep(1);
                            setVerificationCode("");
                            setTwoFAError("");
                            setQrCodeImage("");
                            setTotpSecret("");
                          }}
                          className={BTN_PRIMARY}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>{t("settings.security.enable2FA")}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sessions */}
                <div className={`${SUBCARD} p-4 sm:p-5`}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3.5">
                      <IconTile icon={Monitor} />
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("settings.security.activeSessions")}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("settings.security.sessionsDesc")}</p>
                      </div>
                    </div>
                    {sessions.filter((s) => !s.current).length > 0 && (
                      <button
                        onClick={handleRevokeOthers}
                        disabled={revokingAll}
                        className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50 shrink-0"
                      >
                        {revokingAll ? t("common.processing") : t("settings.security.signOutOthers")}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    {sessionsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center">
                        <Spinner />
                        {t("settings.security.loadingSessions")}
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">{t("settings.security.noSessions")}</p>
                    ) : (
                      sessions.map((s) => {
                        const DevIcon = isMobileUA(s.userAgent) ? Smartphone : Monitor;
                        return (
                          <div key={s.id} className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-200/50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06]">
                            <div className="flex items-center gap-3 min-w-0">
                              <IconTile icon={DevIcon} tone={s.current ? "ghost" : "muted"} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{deviceLabel(s.userAgent)}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {s.ipAddress || t("settings.security.unknownIp")} · {t("settings.security.activePrefix")} {relativeTime(s.lastActivityAt)}
                                </p>
                              </div>
                            </div>
                            {s.current ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-500/25 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {t("settings.security.thisSession")}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRevokeSession(s.id)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                              >
                                {t("settings.security.signOutSession")}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {/* ---------------- Notifications ---------------- */}
          {activeTab === "notifications" && (
            <Panel className="p-4 sm:p-6">
              <TabIntro icon={Bell} title={t("settings.notifs.title")} desc={t("settings.notifs.desc")} />
              <div className="space-y-3">
                {notifRows.map((row) => {
                  const RIcon = row.icon;
                  return (
                    <div key={row.key} className={`${SUBCARD} flex items-center justify-between gap-4 p-4`}>
                      <div className="flex items-center gap-3.5 min-w-0">
                        <IconTile icon={RIcon} tone={notifPrefs[row.key] ? "ghost" : "muted"} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{row.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{row.desc}</p>
                        </div>
                      </div>
                      <Toggle
                        checked={notifPrefs[row.key]}
                        onChange={() => setNotifPrefs((p) => ({ ...p, [row.key]: !p[row.key] }))}
                        label={row.title}
                      />
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* ---------------- Company ---------------- */}
          {activeTab === "company" && (
            <div className="space-y-4">
              <Panel className="overflow-hidden p-0" accent={false}>
                {isLoadingProfile ? (
                  <div className="flex items-center justify-center py-16">
                    <Spinner className="w-7 h-7 text-accent" />
                  </div>
                ) : (
                  <>
                    <div
                      className="h-36 relative"
                      style={{
                        background: companyProfile?.coverUrl
                          ? `url(${companyProfile.coverUrl}) center/cover no-repeat`
                          : companyProfile?.primaryColor
                          ? `linear-gradient(135deg, ${companyProfile.primaryColor}cc, ${companyProfile.primaryColor}66)`
                          : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      }}
                    >
                      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-slate-950/40 to-transparent" />
                      {isAdmin && (
                        <button
                          onClick={() => { setIsEditingProfile(!isEditingProfile); setCompanyForm(companyProfile || {}); }}
                          className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/30 backdrop-blur-md text-white text-xs font-medium hover:bg-slate-950/45 border border-white/20 transition-colors"
                        >
                          {isEditingProfile ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                          {isEditingProfile ? t("common.cancel") : t("settings.company.editProfile")}
                        </button>
                      )}
                    </div>

                    <div className="px-5 sm:px-6 pb-6">
                      <div className="-mt-10 mb-4 relative z-10">
                        {companyProfile?.logoUrl ? (
                          <img
                            src={companyProfile.logoUrl}
                            alt={t("settings.company.logoAlt")}
                            className="w-20 h-20 rounded-2xl border-4 border-slate-50 dark:border-slate-900 ring-1 ring-black/5 object-cover shadow-lg"
                          />
                        ) : (
                          <div
                            className="w-20 h-20 rounded-2xl border-4 border-slate-50 dark:border-slate-900 ring-1 ring-black/5 shadow-lg flex items-center justify-center text-white font-bold text-2xl"
                            style={{ background: companyProfile?.primaryColor || '#4f46e5' }}
                          >
                            {(companyProfile?.displayName || companyOrg?.name || 'C').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                            {companyProfile?.displayName || companyOrg?.name || t("settings.company.companyName")}
                          </h2>
                          {companyProfile?.industry && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{companyProfile.industry}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("settings.company.companyCode")}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-bold text-accent px-3 py-1 rounded-lg bg-accent-soft border border-accent-soft">
                              {companyOrg?.companyCode || '-'}
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(companyOrg?.companyCode || '').then(() => toast.success(t("settings.company.codeCopied")))}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-accent-soft transition-colors"
                              title={t("settings.company.copyCodeTitle")}
                              aria-label={t("common.copy")}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("settings.company.uniqueTenant")}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {companyProfile?.employeeCount && (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-300/50 dark:border-white/[0.08]">
                            <Users className="w-3 h-3" />
                            {companyProfile.employeeCount} {t("settings.company.employeesLabel")}
                          </span>
                        )}
                        {companyProfile?.foundedYear && (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-300/50 dark:border-white/[0.08]">
                            <Clock className="w-3 h-3" />
                            {t("settings.company.est")} {companyProfile.foundedYear}
                          </span>
                        )}
                        {companyProfile?.country && (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-300/50 dark:border-white/[0.08]">
                            <MapPin className="w-3 h-3" />
                            {companyProfile.country}
                          </span>
                        )}
                      </div>

                      {companyProfile?.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                          {companyProfile.description}
                        </p>
                      )}

                      {(companyProfile?.website || companyProfile?.contactEmail || companyProfile?.phone) && (
                        <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-200 dark:border-white/[0.08]">
                          {companyProfile.website && (
                            <a href={companyProfile.website} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-accent hover:underline">
                              <Globe className="w-3.5 h-3.5" />
                              {companyProfile.website.replace(/^https?:\/\//, '')}
                            </a>
                          )}
                          {companyProfile.contactEmail && (
                            <a href={`mailto:${companyProfile.contactEmail}`}
                              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                              <Mail className="w-3.5 h-3.5" />
                              {companyProfile.contactEmail}
                            </a>
                          )}
                          {companyProfile.phone && (
                            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <Phone className="w-3.5 h-3.5" />
                              {companyProfile.phone}
                            </span>
                          )}
                        </div>
                      )}

                      {(companyProfile?.address || companyProfile?.city) && (
                        <div className="flex items-start gap-1.5 mt-3">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {[companyProfile.address, companyProfile.city, companyProfile.province, companyProfile.country].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      )}

                      {!companyProfile && (
                        <div className="pt-2 pb-2">
                          <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/15 p-6 text-center">
                            <IconTile icon={Building2} tone="ghost" className="mx-auto mb-3" />
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("settings.company.noProfile")}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                              {isAdmin ? t("settings.company.noProfileAdmin") : t("settings.company.noProfileMember")}
                            </p>
                            {isAdmin && !isEditingProfile && (
                              <button onClick={() => setIsEditingProfile(true)} className={BTN_PRIMARY}>
                                <Plus className="w-4 h-4" />
                                {t("settings.company.setUpProfile")}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Panel>

              {isAdmin && isEditingProfile && !isLoadingProfile && (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {profileSaved && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-sm text-emerald-700 dark:text-emerald-300">
                      {t("settings.company.profileSaved")}
                    </div>
                  )}

                  <Panel className="p-5 space-y-4" animate={false}>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-accent" />
                      {t("settings.company.identity")}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field
                        label={t("settings.company.displayName")}
                        value={companyForm.displayName || ''}
                        onChange={e => setCompanyForm(f => ({ ...f, displayName: e.target.value }))}
                        placeholder="PT DocLoq Indonesia"
                      />
                      <SelectField
                        label={t("settings.company.industry")}
                        value={companyForm.industry || ''}
                        onChange={e => setCompanyForm(f => ({ ...f, industry: e.target.value }))}
                      >
                        <option value="">{t("settings.company.selectIndustry")}</option>
                        {['Technology', 'Finance', 'Healthcare', 'Government', 'Education', 'Manufacturing', 'Legal', 'Retail', 'Media', 'Other'].map(i => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </SelectField>
                      <Field
                        label={t("settings.company.foundedYear")}
                        type="number"
                        value={companyForm.foundedYear || ''}
                        onChange={e => setCompanyForm(f => ({ ...f, foundedYear: e.target.value }))}
                        placeholder="2020"
                        min="1900"
                        max={new Date().getFullYear()}
                      />
                      <SelectField
                        label={t("settings.company.employeeCount")}
                        value={companyForm.employeeCount || ''}
                        onChange={e => setCompanyForm(f => ({ ...f, employeeCount: e.target.value }))}
                      >
                        <option value="">{t("settings.company.selectSize")}</option>
                        {['1-10', '11-50', '51-200', '201-500', '500+'].map(s => <option key={s} value={s}>{s}</option>)}
                      </SelectField>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t("settings.company.description")}</label>
                      <textarea
                        rows={3}
                        value={companyForm.description || ''}
                        onChange={e => setCompanyForm(f => ({ ...f, description: e.target.value }))}
                        placeholder={t("settings.company.descPlaceholder")}
                        className={`${FIELD} resize-none`}
                      />
                    </div>
                  </Panel>

                  <Panel className="p-5 space-y-4" animate={false}>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-accent" />
                      {t("settings.company.contact")}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field
                        label={t("settings.company.website")}
                        icon={Globe}
                        type="url"
                        value={companyForm.website || ''}
                        onChange={e => setCompanyForm(f => ({ ...f, website: e.target.value }))}
                        placeholder="https://company.com"
                      />
                      <Field
                        label={t("settings.company.contactEmail")}
                        icon={Mail}
                        type="email"
                        value={companyForm.contactEmail || ''}
                        onChange={e => setCompanyForm(f => ({ ...f, contactEmail: e.target.value }))}
                        placeholder="info@company.com"
                      />
                      <Field
                        label={t("settings.company.phone")}
                        icon={Phone}
                        type="tel"
                        value={companyForm.phone || ''}
                        onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+62 21 000 0000"
                      />
                    </div>
                  </Panel>

                  <Panel className="p-5 space-y-4" animate={false}>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-accent" />
                      {t("settings.company.address")}
                    </h3>
                    <Field
                      label={t("settings.company.streetAddress")}
                      value={companyForm.address || ''}
                      onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Jl. Sudirman No. 1"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        ['city', t("settings.company.city"), 'Jakarta'],
                        ['province', t("settings.company.province"), 'DKI Jakarta'],
                        ['postalCode', t("settings.company.postalCode"), '10220'],
                        ['country', t("settings.company.country"), 'Indonesia'],
                      ].map(([field, label, ph]) => (
                        <Field
                          key={field}
                          label={label}
                          value={companyForm[field] || ''}
                          onChange={e => setCompanyForm(f => ({ ...f, [field]: e.target.value }))}
                          placeholder={ph}
                        />
                      ))}
                    </div>
                  </Panel>

                  <Panel className="p-5 space-y-4" animate={false}>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Upload className="w-4 h-4 text-accent" />
                      {t("settings.company.brandingLegal")}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">{t("settings.company.logo")}</label>
                        <div className="flex items-center gap-3">
                          {companyForm.logoUrl ? (
                            <img src={companyForm.logoUrl} alt={t("settings.company.logoImgAlt")} className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-white/10 shrink-0" onError={e => e.target.style.display = 'none'} />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-accent-soft flex items-center justify-center text-accent font-bold text-xl shrink-0">
                              {(companyForm.displayName || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-white/15 cursor-pointer hover:border-accent transition-colors text-xs text-slate-500 dark:text-slate-400 ${uploadingLogo ? 'opacity-60 pointer-events-none' : ''}`}>
                              {uploadingLogo ? (<><Spinner className="w-4 h-4 shrink-0" />{t("common.uploading")}</>) : (<><Upload className="w-4 h-4 shrink-0" />{t("settings.company.uploadLogo")}</>)}
                              <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload('logo', e.target.files?.[0])} />
                            </label>
                            <p className="text-[10px] text-slate-400 mt-1">{t("settings.company.imgHint")}</p>
                            {companyForm.logoUrl && (
                              <button type="button" onClick={() => setCompanyForm(f => ({ ...f, logoUrl: '' }))} className="text-[10px] text-rose-500 hover:text-rose-600 mt-0.5">{t("common.remove")}</button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">{t("settings.company.coverPhoto")}</label>
                        {companyForm.coverUrl && (
                          <img src={companyForm.coverUrl} alt={t("settings.company.coverAlt")} className="w-full h-16 rounded-xl object-cover border border-slate-200 dark:border-white/10 mb-2" onError={e => e.target.style.display = 'none'} />
                        )}
                        <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-white/15 cursor-pointer hover:border-accent transition-colors text-xs text-slate-500 dark:text-slate-400 ${uploadingCover ? 'opacity-60 pointer-events-none' : ''}`}>
                          {uploadingCover ? (<><Spinner className="w-4 h-4 shrink-0" />{t("common.uploading")}</>) : (<><Upload className="w-4 h-4 shrink-0" />{t("settings.company.uploadCover")}</>)}
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload('cover', e.target.files?.[0])} />
                        </label>
                        <p className="text-[10px] text-slate-400 mt-1">{t("settings.company.coverHint")}</p>
                        {companyForm.coverUrl && (
                          <button type="button" onClick={() => setCompanyForm(f => ({ ...f, coverUrl: '' }))} className="text-[10px] text-rose-500 hover:text-rose-600 mt-0.5">{t("common.remove")}</button>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t("settings.company.brandColor")}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={companyForm.primaryColor || '#6366f1'}
                            onChange={e => setCompanyForm(f => ({ ...f, primaryColor: e.target.value }))}
                            className="w-10 h-10 rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer bg-transparent"
                          />
                          <span className="text-sm font-mono text-slate-700 dark:text-slate-300">{companyForm.primaryColor || '#6366f1'}</span>
                        </div>
                      </div>
                      <Field
                        label={t("settings.company.taxId")}
                        value={companyForm.taxId || ''}
                        onChange={e => setCompanyForm(f => ({ ...f, taxId: e.target.value }))}
                        placeholder="00.000.000.0-000.000"
                      />
                    </div>
                  </Panel>

                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setIsEditingProfile(false)} className={BTN_SOFT}>
                      {t("common.cancel")}
                    </button>
                    <button type="submit" disabled={isSavingProfile} className={BTN_PRIMARY}>
                      {isSavingProfile ? <Spinner /> : <Check className="w-4 h-4" />}
                      {isSavingProfile ? t("common.saving") : t("settings.company.saveProfile")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* ---------------- Add user modal ---------------- */}
      <AnimatePresence>
        {showAddUserModal && (
          <ModalShell onClose={() => setShowAddUserModal(false)} scroll>
            <ModalHeader
              icon={UserPlus}
              title={t("settings.addUser.title")}
              subtitle={t("settings.addUser.subtitle")}
              onClose={() => setShowAddUserModal(false)}
            />
            <form onSubmit={handleAddUser} className="p-6 space-y-5 overflow-y-auto">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25">
                  <p className="text-sm text-rose-600 dark:text-rose-400">{errorMessage}</p>
                </div>
              )}

              <div className="flex justify-center pt-1 pb-1">
                <div className="w-16 h-16 rounded-2xl bg-accent-gradient-br flex items-center justify-center text-xl font-bold text-white shadow-accent">
                  {newUserForm.firstName && newUserForm.lastName
                    ? `${newUserForm.firstName[0]}${newUserForm.lastName[0]}`.toUpperCase()
                    : <User className="w-8 h-8 text-white/60" strokeWidth={1.5} />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field
                  label={t("settings.addUser.firstName")}
                  value={newUserForm.firstName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
                  placeholder={t("settings.addUser.phFirst")}
                  required
                />
                <Field
                  label={t("settings.addUser.lastName")}
                  value={newUserForm.lastName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                  placeholder={t("settings.addUser.phLast")}
                  required
                />
              </div>

              <Field
                label={t("settings.addUser.emailAddress")}
                icon={Mail}
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder={t("settings.addUser.phEmail")}
                required
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t("settings.addUser.passwordLabel")}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showNewUserPassword ? "text" : "password"}
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    className={`${FIELD} pl-10 pr-11`}
                    placeholder={t("settings.addUser.phPassword")}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                    aria-label={showNewUserPassword ? "Hide password" : "Show password"}
                  >
                    {showNewUserPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400">{t("settings.addUser.minChars")}</p>
              </div>

              <Field
                label={t("settings.addUser.phoneNumber")}
                icon={Phone}
                type="tel"
                value={newUserForm.phone}
                onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                placeholder={t("settings.addUser.phPhone")}
              />

              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label={t("settings.addUser.department")}
                  value={newUserForm.departmentId}
                  onChange={(e) => setNewUserForm({ ...newUserForm, departmentId: e.target.value })}
                >
                  <option value="">{t("settings.addUser.select")}</option>
                  {departmentsList.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </SelectField>
                <SelectField
                  label={t("settings.addUser.role")}
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>{roleLabels[role]}</option>
                  ))}
                </SelectField>
              </div>

              <Field
                label={t("settings.addUser.position")}
                icon={Briefcase}
                value={newUserForm.position}
                onChange={(e) => setNewUserForm({ ...newUserForm, position: e.target.value })}
                placeholder={t("settings.addUser.phPosition")}
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddUserModal(false); setErrorMessage(""); }}
                  className={`${BTN_SOFT} flex-1`}
                  disabled={isLoading}
                >
                  {t("common.cancel")}
                </button>
                <button type="submit" disabled={isLoading} className={`${BTN_PRIMARY} flex-1`}>
                  {isLoading ? (<><Spinner />{t("settings.addUser.adding")}</>) : (<><UserPlus className="w-4 h-4" />{t("settings.users.addUser")}</>)}
                </button>
              </div>
            </form>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ---------------- Delete user modal ---------------- */}
      <AnimatePresence>
        {showDeleteModal && selectedUser && (
          <ModalShell onClose={() => setShowDeleteModal(false)} maxW="max-w-sm">
            <div className="p-6">
              <div className="text-center mb-6">
                <IconTile icon={Trash2} tone="danger" size="lg" className="mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("settings.deleteUser.title")}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("settings.confirmDelete.prefix")}
                  <span className="font-medium text-slate-900 dark:text-white">{selectedUser.firstName} {selectedUser.lastName}</span>
                  {t("settings.confirmDelete.suffix")}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteModal(false)} className={`${BTN_SOFT} flex-1`}>
                  {t("common.cancel")}
                </button>
                <button onClick={handleDeleteUser} disabled={isLoading} className={`${BTN_DANGER} flex-1`}>
                  {isLoading ? <Spinner /> : <Trash2 className="w-4 h-4" />}
                  {t("common.delete")}
                </button>
              </div>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ---------------- Enable 2FA modal ---------------- */}
      <AnimatePresence>
        {show2FAModal && (
          <ModalShell onClose={() => setShow2FAModal(false)} scroll>
            <div className="p-6 overflow-y-auto">
              {twoFAStep < 4 && (
                <div className="flex items-center justify-center gap-2 mb-6">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                        twoFAStep >= step
                          ? 'bg-accent-gradient text-white shadow-accent-sm'
                          : 'bg-slate-200 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400'
                      }`}>
                        {twoFAStep > step ? <Check className="w-4 h-4" /> : step}
                      </div>
                      {step < 3 && (
                        <div className={`w-12 h-0.5 ${twoFAStep > step ? 'bg-accent-gradient' : 'bg-slate-200 dark:bg-white/[0.08]'}`} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {twoFAStep === 1 && (
                <div className="text-center">
                  <IconTile icon={Smartphone} size="lg" className="mx-auto mb-4" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("settings.twoFA.step1Title")}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("settings.twoFA.step1Desc")}</p>

                  <div className="flex gap-3 mb-6">
                    <div className={`${SUBCARD} flex-1 p-4`}>
                      <svg className="w-8 h-8 mx-auto mb-2 text-slate-700 dark:text-slate-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">App Store</p>
                    </div>
                    <div className={`${SUBCARD} flex-1 p-4`}>
                      <svg className="w-8 h-8 mx-auto mb-2 text-slate-700 dark:text-slate-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/>
                      </svg>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Google Play</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setShow2FAModal(false)} className={`${BTN_SOFT} flex-1`}>
                      {t("common.cancel")}
                    </button>
                    <button
                      onClick={async () => {
                        setTwoFALoading(true);
                        setTwoFAError("");
                        try {
                          const response = await totpService.generateSecret();
                          if (response.success) {
                            setQrCodeImage(response.data.qrCode);
                            setTotpSecret(response.data.secret);
                            setTwoFAStep(2);
                          } else {
                            setTwoFAError(response.error || t("settings.errors.generateSecret"));
                          }
                        } catch (error) {
                          setTwoFAError(error.message || t("settings.errors.generateSecret"));
                        } finally {
                          setTwoFALoading(false);
                        }
                      }}
                      className={`${BTN_PRIMARY} flex-1`}
                      disabled={twoFALoading}
                    >
                      {twoFALoading ? (<><Spinner />{t("common.loading")}</>) : (<>{t("common.next")}<ArrowRight className="w-4 h-4" /></>)}
                    </button>
                  </div>
                  {twoFAError && <p className="text-sm text-rose-500 mt-3">{twoFAError}</p>}
                </div>
              )}

              {twoFAStep === 2 && (
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("settings.twoFA.step2Title")}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("settings.twoFA.step2Desc")}</p>

                  {/* QR must stay on white for scanner contrast */}
                  <div className="w-48 h-48 mx-auto mb-4 bg-white p-2 rounded-2xl shadow-lg ring-1 ring-black/5">
                    {qrCodeImage ? (
                      <img src={qrCodeImage} alt={t("settings.twoFA.qrAlt")} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-xl">
                        <Spinner className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                  </div>

                  <div className="mb-6">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t("settings.twoFA.enterManually")}</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="px-4 py-2 bg-slate-200/70 dark:bg-white/[0.06] rounded-lg text-sm font-mono text-slate-900 dark:text-slate-100 tracking-widest break-all">
                        {totpSecret || t("common.loading")}
                      </code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(totpSecret); }}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/[0.06] transition-colors"
                        title={t("settings.twoFA.copyToClipboard")}
                        aria-label={t("common.copy")}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setTwoFAStep(1)} className={`${BTN_SOFT} flex-1`}>
                      {t("common.back")}
                    </button>
                    <button onClick={() => setTwoFAStep(3)} className={`${BTN_PRIMARY} flex-1`}>
                      {t("common.next")}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {twoFAStep === 3 && (
                <div className="text-center">
                  <IconTile icon={ShieldCheck} tone="success" size="lg" className="mx-auto mb-4" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("settings.twoFA.step3Title")}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("settings.twoFA.step3Desc")}</p>

                  <div className="mb-6">
                    <OtpInput value={verificationCode} onChange={setVerificationCode} />
                    <p className="text-xs text-slate-400 mt-3">{t("settings.twoFA.codeHint")}</p>
                    {twoFAError && <p className="text-sm text-rose-500 mt-2">{twoFAError}</p>}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setTwoFAStep(2)} className={`${BTN_SOFT} flex-1`}>
                      {t("common.back")}
                    </button>
                    <button
                      onClick={async () => {
                        setTwoFALoading(true);
                        setTwoFAError("");
                        try {
                          const response = await totpService.enable(verificationCode);
                          if (response.success) {
                            setTwoFAStep(4);
                          } else {
                            setTwoFAError(response.error || t("settings.errors.invalidCode"));
                          }
                        } catch (error) {
                          setTwoFAError(error.message || t("settings.errors.enable2FA"));
                        } finally {
                          setTwoFALoading(false);
                        }
                      }}
                      className={`${BTN_PRIMARY} flex-1`}
                      disabled={verificationCode.length !== 6 || twoFALoading}
                    >
                      {twoFALoading ? (<><Spinner />{t("settings.twoFA.verifying")}</>) : t("settings.security.enable2FA")}
                    </button>
                  </div>
                </div>
              )}

              {twoFAStep === 4 && (
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15, stiffness: 200 }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30"
                  >
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("settings.twoFA.successTitle")}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("settings.twoFA.successDesc")}</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 mb-4"
                  >
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <IconTile icon={ShieldCheck} tone="success" />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t("settings.twoFA.securityLevel")}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{t("settings.twoFA.connected")}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <Clock className="w-4 h-4" />
                      <span>{t("settings.twoFA.enabledJustNow")}</span>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 mb-6"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">{t("settings.twoFA.backupTitle")}</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">{t("settings.twoFA.backupDesc")}</p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    onClick={() => {
                      setTwoFAEnabled(true);
                      setShow2FAModal(false);
                      setVerificationCode('');
                      setTwoFAStep(1);
                    }}
                    className={`${BTN_PRIMARY} w-full`}
                  >
                    <Check className="w-4 h-4" />
                    {t("common.done")}
                  </motion.button>
                </div>
              )}
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ---------------- Disable 2FA modal ---------------- */}
      <AnimatePresence>
        {showDisable2FAModal && (
          <ModalShell onClose={() => setShowDisable2FAModal(false)}>
            <div className="p-6">
              <div className="text-center">
                <IconTile icon={AlertTriangle} tone="danger" size="lg" className="mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("settings.disable2FA.title")}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("settings.disable2FA.desc")}</p>

                <div className="mb-4 text-left">
                  <Field
                    label={t("settings.disable2FA.passwordLabel")}
                    icon={Lock}
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="mb-6">
                  <OtpInput value={disableCode} onChange={setDisableCode} tone="danger" />
                  <p className="text-xs text-slate-400 mt-3">{t("settings.twoFA.codeHint")}</p>
                  {twoFAError && <p className="text-sm text-rose-500 mt-2">{twoFAError}</p>}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowDisable2FAModal(false); setDisableCode(""); setDisablePassword(""); setTwoFAError(""); }}
                    className={`${BTN_SOFT} flex-1`}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={async () => {
                      setTwoFALoading(true);
                      setTwoFAError("");
                      try {
                        const response = await totpService.disable(disableCode, disablePassword);
                        if (response.success) {
                          setTwoFAEnabled(false);
                          setShowDisable2FAModal(false);
                          setDisableCode("");
                          setDisablePassword("");
                        } else {
                          setTwoFAError(response.message || response.error || t("settings.errors.invalidCode"));
                        }
                      } catch (error) {
                        setTwoFAError(error.message || t("settings.errors.disable2FA"));
                      } finally {
                        setTwoFALoading(false);
                      }
                    }}
                    disabled={disableCode.length !== 6 || !disablePassword || twoFALoading}
                    className={`${BTN_DANGER} flex-1`}
                  >
                    {twoFALoading ? (<><Spinner />{t("settings.disable2FA.disabling")}</>) : t("settings.disable2FA.disable")}
                  </button>
                </div>
              </div>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ---------------- Logout modal ---------------- */}
      <AnimatePresence>
        {showLogoutModal && (
          <ModalShell onClose={() => setShowLogoutModal(false)} maxW="max-w-sm">
            <div className="relative p-6 sm:p-8">
              <div aria-hidden="true" className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative text-center mb-6 sm:mb-8">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                  className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-5 rounded-2xl bg-rose-500/12 border border-rose-500/25 flex items-center justify-center shadow-lg"
                >
                  <LogOut className="w-7 h-7 sm:w-8 sm:h-8 text-rose-600 dark:text-rose-400" strokeWidth={1.5} />
                </motion.div>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">{t("settings.logout.title")}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("settings.logout.desc")}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  disabled={isLoggingOut}
                  className={`${BTN_SOFT} flex-1`}
                >
                  {t("common.cancel")}
                </button>
                <motion.button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`${BTN_DANGER} flex-1`}
                >
                  {isLoggingOut ? (<><Spinner />{t("settings.logout.signingOut")}</>) : (<>{t("settings.logout.signOut")}<LogOut className="w-4 h-4" /></>)}
                </motion.button>
              </div>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ---------------- Department create/edit modal ---------------- */}
      <AnimatePresence>
        {showDeptModal && (
          <ModalShell onClose={() => setShowDeptModal(false)}>
            <ModalHeader
              icon={Building2}
              title={editingDept ? t("settings.deptModal.editTitle") : t("settings.deptModal.addTitle")}
              subtitle={editingDept ? t("settings.deptModal.editSubtitle") : t("settings.deptModal.addSubtitle")}
              onClose={() => setShowDeptModal(false)}
            />
            <form onSubmit={handleCreateDept} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25">
                  <p className="text-sm text-rose-600 dark:text-rose-400">{errorMessage}</p>
                </div>
              )}
              <Field
                label={t("settings.deptModal.nameLabel")}
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder={t("settings.deptModal.namePlaceholder")}
                required
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t("settings.deptModal.descLabel")}</label>
                <textarea
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  rows={3}
                  className={`${FIELD} resize-none`}
                  placeholder={t("settings.deptModal.descPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t("settings.deptModal.colorLabel")}</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="color"
                    value={deptForm.color}
                    onChange={(e) => setDeptForm({ ...deptForm, color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer bg-transparent"
                    aria-label={t("settings.deptModal.colorLabel")}
                  />
                  <div className="flex gap-2">
                    {['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#6b7280'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDeptForm({ ...deptForm, color: c })}
                        className={`w-7 h-7 rounded-full transition-all ${deptForm.color === c ? 'ring-2 ring-offset-2 ring-accent dark:ring-offset-slate-900 scale-110' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDeptModal(false)} className={`${BTN_SOFT} flex-1`} disabled={isLoading}>
                  {t("common.cancel")}
                </button>
                <button type="submit" disabled={isLoading} className={`${BTN_PRIMARY} flex-1`}>
                  {isLoading ? (<><Spinner />{t("common.saving")}</>) : (<><Check className="w-4 h-4" />{editingDept ? t("settings.deptModal.update") : t("common.create")}</>)}
                </button>
              </div>
            </form>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ---------------- Delete department modal ---------------- */}
      <AnimatePresence>
        {showDeleteDeptModal && deletingDept && (
          <ModalShell onClose={() => setShowDeleteDeptModal(false)} maxW="max-w-sm">
            <div className="p-6">
              <div className="text-center mb-6">
                <IconTile icon={Trash2} tone="danger" size="lg" className="mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("settings.deleteDept.title")}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("settings.confirmDelete.prefix")}
                  <span className="font-medium text-slate-900 dark:text-white">{deletingDept.name}</span>
                  {t("settings.confirmDelete.suffix")}
                </p>
                {errorMessage && <p className="text-sm text-rose-600 dark:text-rose-400 mt-3">{errorMessage}</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteDeptModal(false); setErrorMessage(""); }} className={`${BTN_SOFT} flex-1`}>
                  {t("common.cancel")}
                </button>
                <button onClick={handleDeleteDept} disabled={isLoading} className={`${BTN_DANGER} flex-1`}>
                  {isLoading ? (<><Spinner />{t("common.deleting")}</>) : (<><Trash2 className="w-4 h-4" />{t("common.delete")}</>)}
                </button>
              </div>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ---------------- Department members modal ---------------- */}
      <AnimatePresence>
        {showMembersModal && deptMembers.department && (
          <ModalShell onClose={() => setShowMembersModal(false)} maxW="max-w-lg" scroll>
            <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.08] shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
                    style={{ backgroundColor: (deptMembers.department.color || '#6366f1') + '1a', borderColor: (deptMembers.department.color || '#6366f1') + '33' }}
                  >
                    <Users className="w-5 h-5" style={{ color: deptMembers.department.color || '#6366f1' }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">{deptMembers.department.name}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {deptMembers.members.length} {deptMembers.members.length === 1 ? t("settings.departments.memberSingular") : t("settings.departments.membersPlural")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMembersModal(false)}
                  aria-label={t("common.close")}
                  className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto">
              {deptMembersLoading ? (
                <div className="flex items-center justify-center py-8 gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <Spinner className="w-5 h-5 text-accent" />
                  {t("settings.members.loadingMembers")}
                </div>
              ) : deptMembers.members.length === 0 ? (
                <div className="text-center py-8">
                  <IconTile icon={Users} tone="muted" size="lg" className="mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t("settings.members.noMembers")}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {deptMembers.members.map((member) => (
                    <div key={member.id} className={`${SUBCARD} flex items-center gap-3 p-3 hover:bg-slate-200/50 dark:hover:bg-white/[0.05] transition-colors`}>
                      <div className="w-10 h-10 rounded-xl bg-accent-gradient-br flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-accent-sm">
                        {`${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.position || member.email}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 ${getRoleBadgeColor(member.role)}`}>
                        {getRoleLabel(member.role)}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium shrink-0 ${member.isActive ? 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-500/25' : 'bg-rose-500/12 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-500/25'}`}>
                        {member.isActive ? t("settings.statusLabel.active") : t("settings.statusLabel.inactive")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
