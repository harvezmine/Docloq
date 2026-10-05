// Role Management feature strings. Key prefix: roles.*
// Leaf shape: { id, en }.

export default {
  header: {
    eyebrow: { id: "Administrasi", en: "Administration" },
    title: { id: "Manajemen Peran", en: "Role Management" },
    subtitle: {
      id: "Buat peran khusus dengan izin dokumen yang granular",
      en: "Create custom roles with granular document permissions",
    },
  },

  loading: { id: "Memuat peran…", en: "Loading roles..." },

  stats: {
    totalRoles: { id: "Total Peran", en: "Total Roles" },
    totalMembers: { id: "Total Anggota", en: "Total Members" },
    permissionsSet: { id: "Izin Diatur", en: "Permissions Set" },
    foldersManaged: { id: "Folder Dikelola", en: "Folders Managed" },
  },

  searchPlaceholder: { id: "Cari peran…", en: "Search roles..." },
  createRole: { id: "Buat Peran", en: "Create Role" },

  card: {
    members: { id: "anggota", en: "members" },
    noDescription: { id: "Tidak ada deskripsi", en: "No description" },
    noPermissions: { id: "Belum ada izin diatur", en: "No permissions set" },
    editRole: { id: "Ubah Peran", en: "Edit Role" },
  },

  empty: {
    title: { id: "Peran tidak ditemukan", en: "No roles found" },
    trySearch: { id: "Coba istilah pencarian lain", en: "Try a different search term" },
    getStarted: {
      id: "Buat peran pertama Anda untuk memulai",
      en: "Create your first role to get started",
    },
  },

  modal: {
    createTitle: { id: "Buat Peran Baru", en: "Create New Role" },
    editTitle: { id: "Ubah Peran", en: "Edit Role" },
    subtitle: {
      id: "Tentukan izin peran untuk folder dan dokumen",
      en: "Define role permissions for folders and documents",
    },
  },

  form: {
    roleName: { id: "Nama Peran", en: "Role Name" },
    roleNamePlaceholder: { id: "misalnya, Tim Keuangan", en: "e.g., Finance Team" },
    descriptionPlaceholder: { id: "Untuk apa peran ini?", en: "What is this role for?" },
    roleColor: { id: "Warna Peran", en: "Role Color" },
    assignUsers: { id: "Tetapkan Pengguna", en: "Assign Users" },
    selected: { id: "dipilih", en: "selected" },
    permissionLevels: { id: "Tingkat Izin", en: "Permission Levels" },
    documentPermissions: { id: "Izin Dokumen", en: "Document Permissions" },
    searchDocsPlaceholder: { id: "Cari dokumen…", en: "Search documents..." },
    docs: { id: "dok", en: "docs" },
    noDocuments: { id: "Tidak ada dokumen ditemukan", en: "No documents found" },
    permissionsSetLabel: { id: "Izin diatur:", en: "Permissions set:" },
  },

  save: {
    createRole: { id: "Buat Peran", en: "Create Role" },
    saveChanges: { id: "Simpan Perubahan", en: "Save Changes" },
  },

  delete: {
    title: { id: "Hapus Peran", en: "Delete Role" },
    question: {
      id: "Apakah Anda yakin ingin menghapus",
      en: "Are you sure you want to delete",
    },
    warnPre: { id: "Ini akan menghapus semua", en: "This will remove all" },
    warnPost: { id: "anggota dari peran ini.", en: "members from this role." },
  },

  permLevels: {
    none: {
      name: { id: "Tanpa Akses", en: "No Access" },
      desc: { id: "", en: "" },
    },
    viewer: {
      name: { id: "Penonton", en: "Viewer" },
      desc: { id: "Hanya dapat melihat", en: "Can view only" },
    },
    editor: {
      name: { id: "Editor", en: "Editor" },
      desc: { id: "Dapat melihat & mengedit", en: "Can view & edit" },
    },
    admin: {
      name: { id: "Admin", en: "Admin" },
      desc: { id: "Akses penuh", en: "Full access" },
    },
  },

  legend: {
    viewer: { id: "Penonton", en: "Viewer" },
    editor: { id: "Editor", en: "Editor" },
    admin: { id: "Admin", en: "Admin" },
  },

  toast: {
    loadFailed: { id: "Gagal memuat data", en: "Failed to load data" },
    created: { id: "Peran berhasil dibuat", en: "Role created successfully" },
    updated: { id: "Peran berhasil diperbarui", en: "Role updated successfully" },
    saveFailed: { id: "Gagal menyimpan peran", en: "Failed to save role" },
    deleted: { id: "Peran berhasil dihapus", en: "Role deleted successfully" },
    deleteFailed: { id: "Gagal menghapus peran", en: "Failed to delete role" },
  },
};
