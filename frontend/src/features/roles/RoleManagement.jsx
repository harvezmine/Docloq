import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useDebounce } from "@/hooks/useDebounce";
import roleService from "@/services/role.service";
import folderService from "@/services/folder.service";
import userService from "@/services/user.service";
import { toast } from "sonner";
import { useLang } from "@/app/providers/LanguageProvider";

const PermissionIcons = {
  none: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  viewer: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  editor: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  admin: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};

const PERMISSION_LEVELS = [
  { id: "none", color: "slate" },
  { id: "viewer", color: "emerald" },
  { id: "editor", color: "blue" },
  { id: "admin", color: "violet" },
];

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Custom Permission Dropdown Component, uses portal to escape overflow:hidden containers
function PermissionDropdown({ value, onChange, compact = false }) {
  const { t } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        btnRef.current && !btnRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setIsOpen((v) => !v);
  };

  const getPermissionStyle = (level) => {
    switch (level) {
      case "viewer": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "editor": return "bg-brand-500/10 text-brand-400 border-brand-500/30";
      case "admin": return "bg-brand-500/10 text-brand-400 border-brand-500/30";
      default:       return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  const currentPerm = PERMISSION_LEVELS.find((p) => p.id === value) || PERMISSION_LEVELS[0];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all hover:opacity-80 ${getPermissionStyle(value)} ${compact ? "min-w-[90px]" : "min-w-[110px]"}`}
      >
        <span className="flex-shrink-0">{PermissionIcons[value] || PermissionIcons.none}</span>
        <span className="flex-1 text-left truncate">{t(`roles.permLevels.${currentPerm.id}.name`)}</span>
        <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: dropPos.top, right: dropPos.right, zIndex: 9999 }}
          className="min-w-[160px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-fade-in"
        >
          {PERMISSION_LEVELS.map((perm) => (
            <button
              key={perm.id}
              type="button"
              onClick={() => { onChange(perm.id); setIsOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50 ${
                value === perm.id ? "bg-slate-100 dark:bg-slate-700/70" : ""
              } ${
                perm.id === "none"   ? "text-slate-500 dark:text-slate-400" :
                perm.id === "viewer" ? "text-emerald-600 dark:text-emerald-400" :
                perm.id === "editor" ? "text-brand-600 dark:text-brand-400" : "text-brand-600 dark:text-brand-400"
              }`}
            >
              <span className="flex-shrink-0">{PermissionIcons[perm.id]}</span>
              <div className="flex-1 text-left">
                <span>{t(`roles.permLevels.${perm.id}.name`)}</span>
                {t(`roles.permLevels.${perm.id}.desc`) && <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-normal">{t(`roles.permLevels.${perm.id}.desc`)}</span>}
              </div>
              {value === perm.id && (
                <svg className="w-3 h-3 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export default function RoleManagement() {
  const { t } = useLang();
  const [roles, setRoles] = useState([]);
  const [folderStructure, setFolderStructure] = useState([]);
  const [orgUsers, setOrgUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [modalMode, setModalMode] = useState("create"); // 'create' or 'edit'
  const [selectedRole, setSelectedRole] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "indigo",
    permissions: {},
    assignedUsers: [],
  });

  const [expandedFolders, setExpandedFolders] = useState([]);
  const [permissionSearch, setPermissionSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rolesRes, foldersRes, usersRes] = await Promise.all([
        roleService.getRoles(),
        folderService.getAllFolders(),
        userService.getUsers({ limit: 100 }),
      ]);

      if (rolesRes.success) setRoles(rolesRes.data || []);

      if (foldersRes.success) {
        const foldersData = foldersRes.data || [];
        // fall back to an empty list when a folder has no nested documents
        const structured = foldersData.map(f => ({
          id: f.id,
          name: f.name,
          documents: (f.documents || []).map(d => ({
            id: d.id,
            name: d.originalName || d.name,
            type: (d.mimeType || '').split('/').pop()?.toUpperCase() || 'FILE',
          })),
        }));
        setFolderStructure(structured);
      }

      if (usersRes.success) {
        const usersData = usersRes.data?.users || usersRes.data || [];
        setOrgUsers(usersData.map(u => ({
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          email: u.email,
          avatar: `${(u.firstName || u.email)[0]}${(u.lastName || '')[0] || ''}`.toUpperCase(),
        })));
      }
    } catch (error) {
      console.error('Failed to load role management data:', error);
      toast.error(t("roles.toast.loadFailed"));
    }
    setIsLoading(false);
  };

  // Role identity colors: solid 600 fills (white icon >= 4.5:1). Ids are persisted on
  // roles, so they stay stable; "violet" is a legacy id that now renders as slate.
  const colorOptions = [
    { id: "indigo", fill: "bg-brand-600" },
    { id: "emerald", fill: "bg-emerald-600" },
    { id: "amber", fill: "bg-amber-600" },
    { id: "rose", fill: "bg-rose-600" },
    { id: "cyan", fill: "bg-teal-600" },
    { id: "violet", fill: "bg-slate-600" },
  ];

  const getColorClasses = useCallback((colorId) => {
    return colorOptions.find(c => c.id === colorId) || colorOptions[0];
  }, []);

  const stats = useMemo(() => {
    const totalPermissions = roles.reduce((sum, role) => sum + Object.keys(role.permissions || {}).length, 0);
    return [
      { label: t("roles.stats.totalRoles"), value: roles.length },
      { label: t("roles.stats.totalMembers"), value: roles.reduce((sum, r) => sum + (r.members || 0), 0) },
      { label: t("roles.stats.permissionsSet"), value: totalPermissions },
      { label: t("roles.stats.foldersManaged"), value: folderStructure.length },
    ];
  }, [roles, folderStructure, t]);

  const filteredRoles = useMemo(() => {
    if (!debouncedSearch.trim()) return roles;
    return roles.filter(role =>
      role.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      role.description.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [roles, debouncedSearch]);

  const filteredFolders = useMemo(() => {
    if (!permissionSearch.trim()) return folderStructure;
    const search = permissionSearch.toLowerCase();
    return folderStructure.map(folder => ({
      ...folder,
      documents: (folder.documents || []).filter(doc =>
        doc.name.toLowerCase().includes(search)
      ),
    })).filter(folder =>
      folder.name.toLowerCase().includes(search) || folder.documents.length > 0
    );
  }, [permissionSearch, folderStructure]);

  const handleCreateRole = useCallback(() => {
    setModalMode("create");
    setFormData({
      name: "",
      description: "",
      color: "indigo",
      permissions: {},
      assignedUsers: [],
    });
    setExpandedFolders([]);
    setPermissionSearch("");
    setShowModal(true);
  }, []);

  const handleEditRole = useCallback((role) => {
    setModalMode("edit");
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      color: role.color || "indigo",
      permissions: { ...(role.permissions || {}) },
      assignedUsers: (role.assignedUsers || []).map(u => u.userId || u.id),
    });
    setExpandedFolders([]);
    setPermissionSearch("");
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setSelectedRole(null);
  }, []);

  const handleSaveRole = useCallback(async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description,
        color: formData.color,
        permissions: formData.permissions,
        assignedUsers: formData.assignedUsers,
      };

      if (modalMode === "create") {
        const res = await roleService.createRole(payload);
        if (res.success) {
          setRoles(prev => [res.data, ...prev]);
          toast.success(t("roles.toast.created"));
        }
      } else {
        const res = await roleService.updateRole(selectedRole.id, payload);
        if (res.success) {
          setRoles(prev => prev.map(role =>
            role.id === selectedRole.id ? { ...role, ...res.data } : role
          ));
          toast.success(t("roles.toast.updated"));
        }
      }
      handleCloseModal();
    } catch (error) {
      toast.error(error.message || t("roles.toast.saveFailed"));
    }
    setIsSaving(false);
  }, [formData, modalMode, selectedRole, handleCloseModal, t]);

  const handleDeleteRole = useCallback(async (roleId) => {
    try {
      const res = await roleService.deleteRole(roleId);
      if (res.success) {
        setRoles(prev => prev.filter(role => role.id !== roleId));
        toast.success(t("roles.toast.deleted"));
      }
    } catch (error) {
      toast.error(error.message || t("roles.toast.deleteFailed"));
    }
    setShowDeleteModal(false);
    setRoleToDelete(null);
  }, [t]);

  const openDeleteModal = useCallback((role) => {
    setRoleToDelete(role);
    setShowDeleteModal(true);
  }, []);

  const toggleFolderExpand = useCallback((folderId) => {
    setExpandedFolders(prev =>
      prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  }, []);

  const permKey = useCallback((itemId, type = "document") => `${type}:${itemId}`, []);

  const setPermission = useCallback((itemId, level) => {
    setFormData(prev => {
      const newPermissions = { ...prev.permissions };
      const key = `document:${itemId}`;
      if (level === "none") {
        delete newPermissions[key];
      } else {
        newPermissions[key] = level;
      }
      return { ...prev, permissions: newPermissions };
    });
  }, []);

  const setFolderPermission = useCallback((folder, level) => {
    setFormData(prev => {
      const newPermissions = { ...prev.permissions };
      const folderKey = `folder:${folder.id}`;
      if (level === "none") {
        delete newPermissions[folderKey];
        (folder.documents || []).forEach(doc => delete newPermissions[`document:${doc.id}`]);
      } else {
        newPermissions[folderKey] = level;
        (folder.documents || []).forEach(doc => {
          newPermissions[`document:${doc.id}`] = level;
        });
      }
      return { ...prev, permissions: newPermissions };
    });
  }, []);

  // Falls back to the raw id key for permissions saved before the "type:id" format.
  const getPermission = useCallback((itemId, type = "document") => {
    const key = `${type}:${itemId}`;
    return formData.permissions[key] || formData.permissions[itemId] || "none";
  }, [formData.permissions]);

  const countPermissions = useCallback((permissions) => {
    const counts = { viewer: 0, editor: 0, admin: 0 };
    Object.values(permissions).forEach(level => {
      if (counts[level] !== undefined) counts[level]++;
    });
    return counts;
  }, []);

  const toggleUserAssignment = useCallback((userId) => {
    setFormData(prev => ({
      ...prev,
      assignedUsers: prev.assignedUsers.includes(userId)
        ? prev.assignedUsers.filter(id => id !== userId)
        : [...prev.assignedUsers, userId],
    }));
  }, []);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-brand-500/10 flex items-center justify-center animate-pulse">
              <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-400">{t("roles.loading")}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        className="mb-8"
        eyebrow={t("roles.header.eyebrow")}
        title={t("roles.header.title")}
        subtitle={t("roles.header.subtitle")}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 p-5 hover:border-slate-600/50 transition-all group">
              <div className="relative">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t("roles.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent w-full sm:w-72 transition-all"
          />
        </div>
        <button
          onClick={handleCreateRole}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent text-white font-semibold text-sm hover:opacity-90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t("roles.createRole")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredRoles.map((role, index) => {
          const colors = getColorClasses(role.color);
          const permCounts = countPermissions(role.permissions);
          
          return (
            <div
              key={role.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${150 + index * 50}ms` }}
            >
              <div className={`group relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:border-slate-600/50 transition-all hover:shadow-xl hover:shadow-black/20`}>

                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${colors.fill} flex items-center justify-center`}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{role.name}</h3>
                        <p className="text-xs text-slate-400">{role.members} {t("roles.card.members")}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openDeleteModal(role)}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                    {role.description || t("roles.card.noDescription")}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {permCounts.viewer > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {PermissionIcons.viewer}
                        <span>{permCounts.viewer}</span>
                      </span>
                    )}
                    {permCounts.editor > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                        {PermissionIcons.editor}
                        <span>{permCounts.editor}</span>
                      </span>
                    )}
                    {permCounts.admin > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                        {PermissionIcons.admin}
                        <span>{permCounts.admin}</span>
                      </span>
                    )}
                    {permCounts.viewer === 0 && permCounts.editor === 0 && permCounts.admin === 0 && (
                      <span className="text-xs text-slate-500 italic">{t("roles.card.noPermissions")}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700/50">
                    <span className="text-xs text-slate-500">
                      {formatDate(role.createdAt)}
                    </span>
                    <button
                      onClick={() => handleEditRole(role)}
                      className="text-sm font-medium text-accent hover:underline flex items-center gap-1.5 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {t("roles.card.editRole")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredRoles.length === 0 && (
          <div className="col-span-full">
            <div className="rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-700/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("roles.empty.title")}</h3>
              <p className="text-sm text-slate-400 mb-4">
                {searchQuery ? t("roles.empty.trySearch") : t("roles.empty.getStarted")}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleCreateRole}
                  className="px-5 py-2.5 rounded-xl bg-accent text-white font-semibold text-sm hover:opacity-90 transition-all"
                >
                  {t("roles.createRole")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700/50 animate-fade-in-up overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700/50 shrink-0 bg-slate-100 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${getColorClasses(formData.color).fill} flex items-center justify-center`}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {modalMode === "create" ? t("roles.modal.createTitle") : t("roles.modal.editTitle")}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {t("roles.modal.subtitle")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-700/50 transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {t("roles.form.roleName")} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={t("roles.form.roleNamePlaceholder")}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {t("common.description")}
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder={t("roles.form.descriptionPlaceholder")}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      {t("roles.form.roleColor")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, color: color.id }))}
                          className={`w-9 h-9 rounded-xl ${color.fill} transition-all ${
                            formData.color === color.id 
                              ? "ring-2 ring-offset-2 ring-offset-slate-900 ring-white scale-110 shadow-lg" 
                              : "hover:scale-105 opacity-70 hover:opacity-100"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {t("roles.form.assignUsers")}
                      <span className="ml-2 text-xs font-normal text-slate-500">({formData.assignedUsers.length} {t("roles.form.selected")})</span>
                    </label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-2">
                      {orgUsers.map((user) => (
                        <label
                          key={user.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                            formData.assignedUsers.includes(user.id) 
                              ? "bg-brand-500/10 border border-brand-500/30" 
                              : "hover:bg-slate-700/30 border border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.assignedUsers.includes(user.id)}
                            onChange={() => toggleUserAssignment(user.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-brand-500 focus:ring-accent focus:ring-offset-0"
                          />
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-white">
                            {user.avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t("roles.form.permissionLevels")}</p>
                    <div className="space-y-2.5">
                      {PERMISSION_LEVELS.filter(p => p.id !== "none").map((perm) => (
                        <div key={perm.id} className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            perm.id === "viewer" ? "bg-emerald-500/10 text-emerald-400" :
                            perm.id === "editor" ? "bg-brand-500/10 text-brand-400" : "bg-brand-500/10 text-brand-400"
                          }`}>
                            {PermissionIcons[perm.id]}
                          </span>
                          <div>
                            <span className="text-sm font-medium text-slate-200">{t(`roles.permLevels.${perm.id}.name`)}</span>
                            <span className="text-xs text-slate-500 ml-2">{t(`roles.permLevels.${perm.id}.desc`)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-slate-300">
                      {t("roles.form.documentPermissions")}
                    </label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder={t("roles.form.searchDocsPlaceholder")}
                        value={permissionSearch}
                        onChange={(e) => setPermissionSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent w-52 transition-all"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden max-h-[420px] overflow-y-auto bg-slate-50 dark:bg-slate-800/30">
                    {filteredFolders.map((folder) => {
                      const isExpanded = expandedFolders.includes(folder.id);
                      const folderPerm = getPermission(folder.id, "folder");
                      
                      return (
                        <div key={folder.id} className="border-b border-slate-200 dark:border-slate-700/50 last:border-b-0">
                          <div className="flex items-center gap-3 p-3.5 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-700/30 transition-colors">
                            <button
                              onClick={() => toggleFolderExpand(folder.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-600/50 transition-colors"
                            >
                              <svg
                                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>

                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            </div>
                            <span className="flex-1 text-sm font-medium text-slate-900 dark:text-white">
                              {folder.name}
                            </span>
                            <span className="text-xs text-slate-500 mr-2">
                              {folder.documents.length} {t("roles.form.docs")}
                            </span>

                            <PermissionDropdown
                              value={folderPerm}
                              onChange={(level) => setFolderPermission(folder, level)}
                            />
                          </div>

                          {isExpanded && (
                            <div className="bg-slate-900/30">
                              {folder.documents.map((doc) => {
                                const docPerm = getPermission(doc.id, "document");
                                
                                return (
                                  <div
                                    key={doc.id}
                                    className="flex items-center gap-3 px-4 py-3 pl-14 border-t border-slate-200 dark:border-slate-700/30 hover:bg-slate-50 dark:bg-slate-800/30 transition-colors"
                                  >
                                    <div className="w-7 h-7 rounded-lg bg-slate-700/50 flex items-center justify-center">
                                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <span className="flex-1 text-sm text-slate-300 truncate">
                                      {doc.name}
                                    </span>

                                    <PermissionDropdown
                                      value={docPerm}
                                      onChange={(level) => setPermission(doc.id, level)}
                                      compact
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {filteredFolders.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-sm text-slate-500">{t("roles.form.noDocuments")}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50">
                    <span className="text-xs text-slate-500 font-medium">{t("roles.form.permissionsSetLabel")}</span>
                    {(() => {
                      const counts = countPermissions(formData.permissions);
                      return (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                            {PermissionIcons.viewer} {counts.viewer} {t("roles.legend.viewer")}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400">
                            {PermissionIcons.editor} {counts.editor} {t("roles.legend.editor")}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400">
                            {PermissionIcons.admin} {counts.admin} {t("roles.legend.admin")}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 flex gap-3 shrink-0 bg-slate-50 dark:bg-slate-800/30">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-300 font-medium hover:bg-slate-200 dark:bg-slate-800 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSaveRole}
                disabled={!formData.name.trim() || isSaving}
                className="flex-1 px-4 py-3 rounded-xl bg-accent text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? t("common.saving") : modalMode === "create" ? t("roles.save.createRole") : t("roles.save.saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && roleToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700/50 animate-fade-in-up overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("roles.delete.title")}</h3>
              <p className="text-slate-400 mb-6">
                {t("roles.delete.question")} <span className="text-white font-semibold">"{roleToDelete.name}"</span>? {" "}
                {t("roles.delete.warnPre")} {roleToDelete.members} {t("roles.delete.warnPost")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setRoleToDelete(null); }}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-300 font-medium hover:bg-slate-200 dark:bg-slate-800 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => handleDeleteRole(roleToDelete.id)}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
                >
                  {t("roles.delete.title")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
