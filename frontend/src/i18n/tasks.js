export default {
  taskType: {
    sign: { id: "Tanda Tangan", en: "Sign" },
    fill: { id: "Isi", en: "Fill" },
    review: { id: "Tinjau", en: "Review" },
    approve: { id: "Setujui", en: "Approve" },
    general: { id: "Tugas", en: "Task" },
  },

  status: {
    pending: { id: "Menunggu", en: "Waiting" },
    in_progress: { id: "Aktif", en: "Active" },
    completed: { id: "Selesai", en: "Done" },
    cancelled: { id: "Ditolak", en: "Rejected" },
  },

  priority: {
    urgent: { id: "Mendesak", en: "Urgent" },
    high: { id: "Tinggi", en: "High" },
    medium: { id: "Sedang", en: "Medium" },
    low: { id: "Rendah", en: "Low" },
  },

  // Tab + stat labels
  label: {
    active: { id: "Aktif", en: "Active" },
    completed: { id: "Selesai", en: "Completed" },
    rejected: { id: "Ditolak", en: "Rejected" },
  },

  workflow: {
    progress: { id: "Progres Alur Kerja", en: "Workflow Progress" },
    current: { id: "SAAT INI", en: "CURRENT" },
    note: { id: "Catatan:", en: "Note:" },
  },

  detail: {
    back: { id: "Kembali ke Tugas", en: "Back to Tasks" },
    noDescription: { id: "Tidak ada deskripsi", en: "No description" },
    due: { id: "Tenggat:", en: "Due:" },
    overdue: { id: "(Terlambat!)", en: "(Overdue!)" },
    signedPrefix: { id: "Ditandatangani", en: "Signed" },
    document: { id: "Dokumen", en: "Document" },
    editAccess: { id: "Anda memiliki akses edit", en: "You have edit access" },
    viewOnly: { id: "Pratinjau · lihat saja", en: "Preview · view only" },
    editFill: { id: "Edit & Isi", en: "Edit & Fill" },
    viewSigned: { id: "Lihat Tertandatangani", en: "View Signed" },
    viewOriginal: {
      id: "Lihat dokumen asli (belum ditandatangani)",
      en: "View original document (unsigned)",
    },
    noDocumentLinked: {
      id: "Tidak ada dokumen yang terkait dengan tugas ini.",
      en: "No document is linked to this task.",
    },
    details: { id: "Detail", en: "Details" },
    assignedTo: { id: "Ditugaskan kepada", en: "Assigned to" },
    assignedBy: { id: "Ditugaskan oleh", en: "Assigned by" },
    comments: { id: "Komentar", en: "Comments" },
    user: { id: "Pengguna", en: "User" },
    taskCompleted: { id: "Tugas Selesai", en: "Task Completed" },
    taskRejected: { id: "Tugas Ditolak", en: "Task Rejected" },
    downloadSignedPdf: { id: "Unduh PDF Tertandatangani", en: "Download Signed PDF" },
  },

  pending: {
    waiting: { id: "Menunggu:", en: "Waiting:" },
    message: {
      id: "Tugas ini akan menjadi aktif ketika langkah alur kerja sebelumnya selesai.",
      en: "This task will become active when the previous workflow step is completed.",
    },
  },

  action: {
    submitAfterEditing: { id: "Kirim Setelah Mengedit", en: "Submit After Editing" },
    submitAfterSigning: { id: "Kirim Setelah Menandatangani", en: "Submit After Signing" },
    reviewNotes: { id: "Catatan Tinjauan", en: "Review Notes" },
    approvalDecision: { id: "Keputusan Persetujuan", en: "Approval Decision" },
    actions: { id: "Tindakan", en: "Actions" },
    fillHint: {
      id: "Buka dokumen, lakukan perubahan, simpan, lalu tandai sebagai selesai.",
      en: "Open the document, make your edits, save, then mark as complete.",
    },
    openEditDocument: { id: "Buka & Edit Dokumen", en: "Open & Edit Document" },
    loadingDocument: { id: "Memuat dokumen...", en: "Loading document..." },
    markComplete: { id: "Tandai sebagai Selesai", en: "Mark as Complete" },
    reviewHint: {
      id: "Lihat dokumen, lalu tambahkan catatan tinjauan Anda. Pengisi akan melihat masukan Anda jika ditolak.",
      en: "View the document, then add your review notes. The filler will see your feedback if rejected.",
    },
    reviewPlaceholder: {
      id: "Tambahkan catatan tinjauan Anda di sini... (opsional)",
      en: "Add your review notes here... (optional)",
    },
    completeReview: { id: "Selesaikan Tinjauan", en: "Complete Review" },
    approveHint: {
      id: "Tinjau dokumen, lalu setujui atau tolak. Alasan diperlukan saat menolak.",
      en: "Review the document, then approve or reject. A reason is required when rejecting.",
    },
    approvePlaceholder: {
      id: "Tambahkan catatan atau alasan penolakan...",
      en: "Add notes or rejection reason...",
    },
    reject: { id: "Tolak", en: "Reject" },
    approve: { id: "Setujui", en: "Approve" },
    reasonRequired: { id: "Alasan diperlukan untuk menolak.", en: "A reason is required to reject." },
  },

  list: {
    eyebrow: { id: "Alur Kerja", en: "Workflow" },
    title: { id: "Tugas Saya", en: "My Tasks" },
    subtitle: {
      id: "Tugas alur kerja yang ditugaskan kepada Anda, isi, tinjau, setujui, dan tandatangani dokumen",
      en: "Your assigned workflow tasks, fill, review, approve, and sign documents",
    },
    noActive: { id: "Tidak ada tugas aktif", en: "No active tasks" },
    noCompleted: { id: "Tidak ada tugas selesai", en: "No completed tasks" },
    noRejected: { id: "Tidak ada tugas ditolak", en: "No rejected tasks" },
    emptyActive: {
      id: "Anda sudah menyelesaikan semuanya! Tugas yang ditugaskan kepada Anda akan muncul di sini.",
      en: "You're all caught up! Tasks assigned to you will appear here.",
    },
    emptyOther: {
      id: "Tugas akan muncul di sini setelah selesai.",
      en: "Tasks will appear here once completed.",
    },
  },

  filter: {
    allTypes: { id: "Semua Jenis", en: "All Types" },
  },

  calendar: {
    title: { id: "Kalender", en: "Calendar" },
    upcoming: { id: "Akan Datang", en: "Upcoming" },
    noUpcoming: { id: "Tidak ada tugas mendatang", en: "No upcoming tasks" },
    day: {
      su: { id: "Min", en: "Su" },
      mo: { id: "Sen", en: "Mo" },
      tu: { id: "Sel", en: "Tu" },
      we: { id: "Rab", en: "We" },
      th: { id: "Kam", en: "Th" },
      fr: { id: "Jum", en: "Fr" },
      sa: { id: "Sab", en: "Sa" },
    },
  },

  months: {
    jan: { id: "Januari", en: "January" },
    feb: { id: "Februari", en: "February" },
    mar: { id: "Maret", en: "March" },
    apr: { id: "April", en: "April" },
    may: { id: "Mei", en: "May" },
    jun: { id: "Juni", en: "June" },
    jul: { id: "Juli", en: "July" },
    aug: { id: "Agustus", en: "August" },
    sep: { id: "September", en: "September" },
    oct: { id: "Oktober", en: "October" },
    nov: { id: "November", en: "November" },
    dec: { id: "Desember", en: "December" },
  },

  sign: {
    documentSigned: { id: "Dokumen Telah Ditandatangani", en: "Document Has Been Signed" },
    completedPrefix: { id: "Selesai:", en: "Completed:" },
    signatureSuccessful: { id: "Penandatanganan berhasil.", en: "Signature successful." },
    downloadSignedDocument: { id: "Unduh Dokumen Tertandatangani", en: "Download Signed Document" },
    signatureDeclined: { id: "Tanda Tangan Ditolak", en: "Signature Declined" },
    reasonPrefix: { id: "Alasan:", en: "Reason:" },
    signBelow: { id: "Tandatangani dokumen di bawah ini:", en: "Sign the document below:" },
    checkStatus: { id: "Periksa Status", en: "Check Status" },
    autoUpdate: {
      id: "Setelah menandatangani, status akan diperbarui secara otomatis.",
      en: "After signing, the status will be updated automatically.",
    },
    noDocument: {
      id: "Tugas ini tidak memiliki dokumen terkait.",
      en: "This task has no associated document.",
    },
    noFormUrl: { id: "Tidak ada URL formulir dari DocuSeal.", en: "No form URL from DocuSeal." },
    initiateFailed: {
      id: "Gagal memulai proses penandatanganan.",
      en: "Failed to initiate signing process.",
    },
    contactFailed: { id: "Gagal menghubungi server.", en: "Failed to contact server." },
    declinedByUser: { id: "Ditolak oleh pengguna", en: "Declined by user" },
    previewLoadFailed: {
      id: "Gagal memuat pratinjau dokumen",
      en: "Failed to load document preview",
    },
    selectPositionHint: {
      id: "Pilih posisi tanda tangan pada dokumen, lalu mulai proses penandatanganan.",
      en: "Select a signature position on the document, then start the signing process.",
    },
    signaturePosition: { id: "Posisi Tanda Tangan", en: "Signature Position" },
    dragHint: {
      id: "Klik dan seret pada dokumen di bawah untuk menandai area tanda tangan.",
      en: "Click and drag on the document below to mark the signature area.",
    },
    loadingPreview: { id: "Memuat pratinjau dokumen...", en: "Loading document preview..." },
    page: { id: "Halaman", en: "Page" },
    signature: { id: "Tanda Tangan", en: "Signature" },
    areaSelected: {
      id: "Area tanda tangan dipilih, Halaman",
      en: "Signature area selected, Page",
    },
    dragToSelect: {
      id: "Seret pada dokumen untuk memilih area tanda tangan",
      en: "Drag on the document to select the signature area",
    },
    clearArea: { id: "Hapus area", en: "Clear area" },
    previewNotAvailable: { id: "Pratinjau Tidak Tersedia", en: "Preview Not Available" },
    loadFailedPrefix: { id: "Gagal memuat dokumen:", en: "Failed to load document:" },
    notPdf: {
      id: "Dokumen ini bukan PDF atau belum tersedia.",
      en: "This document is not a PDF or is not yet available.",
    },
    bottomLeftAuto: {
      id: "Tanda tangan akan ditempatkan di sudut kiri bawah halaman terakhir secara otomatis.",
      en: "The signature will be placed in the bottom-left corner of the last page automatically.",
    },
    tryAgain: { id: "Coba lagi", en: "Try again" },
    processing: { id: "Memproses...", en: "Processing..." },
    startSigning: { id: "Mulai Menandatangani", en: "Start Signing" },
  },

  preview: {
    loading: { id: "Memuat pratinjau dokumen…", en: "Loading document preview…" },
    unsupported: {
      id: "Pratinjau belum tersedia untuk format dokumen ini.",
      en: "Preview is not yet available for this document format.",
    },
    error: { id: "Gagal memuat pratinjau dokumen.", en: "Failed to load document preview." },
    useButtons: {
      id: "Gunakan tombol di panel kanan untuk membuka atau mengunduh dokumen.",
      en: "Use the buttons in the right panel to open or download the document.",
    },
    page: { id: "Halaman", en: "Page" },
    loadingPagePrefix: { id: "Memuat halaman", en: "Loading page" },
    of: { id: "dari", en: "of" },
  },
};
