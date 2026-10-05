// Dashboard feature strings. Key prefix: dashboard.*
// Leaf shape: { id, en }. Reuse common.* for generic words.

export default {
  header: {
    welcome: { id: "Selamat datang kembali,", en: "Welcome back," },
    subtitle: { id: "Berikut ringkasan ruang kerja Anda hari ini.", en: "Here's an overview of your workspace today." },
    refresh: { id: "Muat Ulang", en: "Refresh" },
  },

  errorState: {
    fetch: { id: "Tidak dapat memuat data dasbor", en: "Could not load dashboard data" },
    title: { id: "Gagal memuat dasbor", en: "Failed to load dashboard" },
    tryAgain: { id: "Coba Lagi", en: "Try Again" },
  },

  stats: {
    documents: { id: "Dokumen", en: "Documents" },
    tasks: { id: "Tugas", en: "Tasks" },
    storage: { id: "Penyimpanan", en: "Storage" },
    forms: { id: "Formulir", en: "Forms" },
    foldersSuffix: { id: "folder", en: "folders" },
    pendingSuffix: { id: "menunggu", en: "pending" },
    overdueSuffix: { id: "terlambat", en: "overdue" },
    filesSuffix: { id: "berkas", en: "files" },
    templatesSuffix: { id: "templat", en: "templates" },
    activeUsersSuffix: { id: "pengguna aktif", en: "active users" },
  },

  taskChart: {
    pending: { id: "Menunggu", en: "Pending" },
    inProgress: { id: "Sedang Berjalan", en: "In Progress" },
    completed: { id: "Selesai", en: "Completed" },
    overdue: { id: "Terlambat", en: "Overdue" },
  },

  quickActions: {
    upload: { name: { id: "Unggah Dokumen", en: "Upload Document" }, desc: { id: "Tambah berkas baru", en: "Add new files" } },
    verify: { name: { id: "Verifikasi Dokumen", en: "Verify Document" }, desc: { id: "Periksa keaslian", en: "Check authenticity" } },
    ai: { name: { id: "Analisis AI", en: "AI Analysis" }, desc: { id: "Analisis dokumen", en: "Analyze documents" } },
    osint: { name: { id: "Pelacak OSINT", en: "OSINT Tracker" }, desc: { id: "Pantau kebocoran", en: "Monitor leaks" } },
    tasks: { name: { id: "Tugas Saya", en: "My Tasks" }, desc: { id: "Lihat tugas Anda", en: "View your tasks" } },
    forms: { name: { id: "Formulir", en: "Forms" }, desc: { id: "Kelola alur kerja", en: "Manage workflows" } },
  },

  donut: {
    total: { id: "total", en: "total" },
  },

  taskOverview: {
    title: { id: "Ringkasan Tugas", en: "Task Overview" },
    totalTasksSuffix: { id: "total tugas", en: "total tasks" },
    viewAll: { id: "Lihat Semua", en: "View All" },
    empty: { id: "Belum ada tugas", en: "No tasks yet" },
  },

  documentBreakdown: {
    title: { id: "Rincian Dokumen", en: "Document Breakdown" },
    empty: { id: "Belum ada dokumen", en: "No documents yet" },
  },

  storageBreakdown: {
    title: { id: "Penyimpanan per Jenis Berkas", en: "Storage by File Type" },
  },

  aiQuota: {
    title: { id: "Kuota Analisis AI", en: "AI Analysis Quota" },
    resets: { id: "Reset", en: "Resets" },
    highUsage: { id: "Penggunaan Tinggi", en: "High Usage" },
    analysesThisMonth: { id: "Analisis Bulan Ini", en: "Analyses This Month" },
    pagesProcessed: { id: "Halaman Diproses", en: "Pages Processed" },
    lifetime: { id: "Sepanjang waktu", en: "Lifetime" },
    analysesWord: { id: "analisis", en: "analyses" },
    open: { id: "Buka Analisis AI", en: "Open AI Analysis" },
  },

  urgentTasks: {
    title: { id: "Tugas Mendesak", en: "Urgent Tasks" },
    overdueSuffix: { id: "terlambat", en: "overdue" },
    sortedByUrgency: { id: "Diurutkan berdasarkan urgensi", en: "Sorted by urgency" },
    pendingWord: { id: "menunggu", en: "pending" },
    inProgressWord: { id: "sedang berjalan", en: "in progress" },
    viewAll: { id: "Lihat Semua", en: "View All" },
    statusInProgress: { id: "Sedang Berjalan", en: "In Progress" },
    statusPending: { id: "Menunggu", en: "Pending" },
    allCaughtUp: { id: "Semua beres!", en: "All caught up!" },
    noPending: { id: "Tidak ada tugas tertunda", en: "No pending tasks" },
  },

  recentDocs: {
    title: { id: "Dokumen Terbaru", en: "Recent Documents" },
    subtitle: { id: "Unggahan dan perubahan terbaru", en: "Latest uploads and changes" },
    searchPlaceholder: { id: "Cari…", en: "Search..." },
    viewAll: { id: "Lihat Semua", en: "View All" },
    colDocument: { id: "Dokumen", en: "Document" },
    colUploadedBy: { id: "Diunggah Oleh", en: "Uploaded By" },
    statusActive: { id: "Aktif", en: "Active" },
    noMatchPrefix: { id: "Tidak ada dokumen yang cocok dengan", en: "No documents matching" },
    emptyTitle: { id: "Belum ada dokumen", en: "No documents yet" },
    emptySubtitle: { id: "Mulai dengan mengunggah dokumen pertama Anda", en: "Start by uploading your first document" },
  },

  activity: {
    title: { id: "Aktivitas Terbaru", en: "Recent Activity" },
    emptyTitle: { id: "Belum ada aktivitas", en: "No recent activity" },
    emptySubtitle: { id: "Aktivitas akan muncul di sini saat Anda bekerja", en: "Activity will appear here as you work" },
  },

  time: {
    justNow: { id: "baru saja", en: "just now" },
    minutesAgoSuffix: { id: "m lalu", en: "m ago" },
    hoursAgoSuffix: { id: "j lalu", en: "h ago" },
    daysAgoSuffix: { id: "h lalu", en: "d ago" },
    overdueSuffix: { id: "h terlambat", en: "d overdue" },
    today: { id: "Hari ini", en: "Today" },
    tomorrow: { id: "Besok", en: "Tomorrow" },
    leftSuffix: { id: "h lagi", en: "d left" },
  },
};
