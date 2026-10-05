// AI project sources UI. Key prefix: aiSources.*
// Leaf shape: { id, en }.

export default {
  // Shared small labels within this feature
  addAction: { id: "Tambahkan", en: "Add" },
  adding: { id: "Menambahkan…", en: "Adding…" },
  addFailed: { id: "Gagal menambahkan", en: "Failed to add" },

  types: {
    document: { id: "Dokumen", en: "Document" },
    url: { id: "URL", en: "URL" },
    text: { id: "Teks", en: "Text" },
    note: { id: "Catatan", en: "Note" },
    youtube: { id: "YouTube", en: "YouTube" },
  },

  doc: {
    title: { id: "Tambah Dokumen", en: "Add Document" },
    subtitle: {
      id: 'Pilih dokumen yang sudah granted untuk AI. Belum granted? Klik "Grant" dulu (konten akan diindex untuk semantic search).',
      en: 'Choose a document already granted to the AI. Not granted yet? Click "Grant" first (the content will be indexed for semantic search).',
    },
    searchPlaceholder: { id: "Cari dokumen…", en: "Search documents…" },
    empty: { id: "Tidak ada dokumen.", en: "No documents." },
    alreadyAdded: { id: "Sudah ada", en: "Already added" },
    grant: { id: "Grant", en: "Grant" },
    granting: { id: "Granting…", en: "Granting…" },
    loadError: { id: "Gagal memuat dokumen", en: "Failed to load documents" },
    grantError: { id: "Gagal grant access", en: "Failed to grant access" },
    notGrantedPrefix: { id: "Dokumen ", en: "Document " },
    notGrantedSuffix: {
      id: ' belum di-grant. Klik "Grant" dulu.',
      en: ' has not been granted. Click "Grant" first.',
    },
    extractFailPrefix: { id: 'Gagal mengekstrak "', en: 'Failed to extract "' },
    extractFailSuffix: {
      id: ". Source ditandai gagal dan bisa dilihat di panel sumber.",
      en: ". The source was marked as failed and can be seen in the sources panel.",
    },
  },

  folder: {
    title: { id: "Tambah dari Folder", en: "Add from Folder" },
    subtitle: {
      id: "Semua dokumen di folder yang sudah di-grant ke AI akan ditambahkan.",
      en: "All documents in the folder that have been granted to the AI will be added.",
    },
    loadError: { id: "Gagal memuat folder", en: "Failed to load folders" },
    addError: { id: "Gagal menambahkan folder", en: "Failed to add folder" },
    docsAddedSuffix: { id: "dokumen ditambahkan.", en: "documents added." },
    skippedSuffix: {
      id: "dilewati (belum di-grant ke AI).",
      en: "skipped (not yet granted to the AI).",
    },
    limitHit: {
      id: "Batas sumber tercapai, sebagian tidak masuk.",
      en: "Source limit reached, some were not added.",
    },
    failedSuffix: { id: "gagal diekstrak.", en: "failed to extract." },
    empty: { id: "Tidak ada folder.", en: "No folders." },
  },

  text: {
    title: { id: "Tempel Teks", en: "Paste Text" },
    subtitle: {
      id: "Teks akan dienkripsi dan disimpan sebagai sumber. Konten dikirim ke OpenAI saat kamu bertanya.",
      en: "The text will be encrypted and stored as a source. The content is sent to OpenAI when you ask.",
    },
    titleLabel: { id: "Judul", en: "Title" },
    titlePlaceholder: {
      id: "Misal: Notulen rapat 14 Juli",
      en: "e.g. Meeting notes July 14",
    },
    bodyLabel: { id: "Isi", en: "Body" },
    bodyPlaceholder: { id: "Tempel teks di sini…", en: "Paste text here…" },
    addError: { id: "Gagal menambahkan sumber", en: "Failed to add source" },
    limitPrefix: { id: "Batas sumber tercapai ", en: "Source limit reached " },
    limitSuffix: {
      id: ". Hapus salah satu dulu.",
      en: ". Remove one first.",
    },
  },

  url: {
    title: { id: "Tambah URL", en: "Add URL" },
    subtitle: {
      id: "Tempel URL artikel, blog post, atau halaman web. Konten teks akan diekstrak otomatis.",
      en: "Paste the URL of an article, blog post, or web page. The text content will be extracted automatically.",
    },
    placeholder: { id: "https://contoh.com/artikel", en: "https://example.com/article" },
    invalid: {
      id: "URL tidak valid. Pastikan diawali http:// atau https://",
      en: "Invalid URL. Make sure it starts with http:// or https://",
    },
    addError: { id: "Gagal menambahkan URL", en: "Failed to add URL" },
    confirmTitle: {
      id: "Konfirmasi pengiriman konten",
      en: "Confirm content submission",
    },
    confirmBody: {
      id: "Konten dari URL ini akan di-fetch oleh server DocLoq, di-ekstrak teksnya, dan dikirim ke OpenAI untuk diindex semantic. Pastikan URL tidak mengandung informasi sensitif.",
      en: "The content of this URL will be fetched by the DocLoq server, its text extracted, and sent to OpenAI for semantic indexing. Make sure the URL does not contain sensitive information.",
    },
    agreeAdd: { id: "Setuju & Tambahkan", en: "Agree & Add" },
  },

  yt: {
    title: { id: "Tambah Video YouTube", en: "Add YouTube Video" },
    subtitle: {
      id: "Transkrip video akan dipakai sebagai sumber. Video tanpa caption tidak bisa dibaca.",
      en: "The video transcript will be used as a source. A video without captions cannot be read.",
    },
    addVideoError: { id: "Gagal menambahkan video", en: "Failed to add video" },
  },

  panel: {
    heading: { id: "Sumber", en: "Sources" },
    loadError: { id: "Gagal memuat sumber", en: "Failed to load sources" },
    removeError: { id: "Gagal menghapus", en: "Failed to remove" },
    retryError: { id: "Gagal retry", en: "Failed to retry" },
    removeConfirm: {
      id: "Hapus sumber ini dari project?",
      en: "Remove this source from the project?",
    },
    pollTimeout: {
      id: "Sumber terlalu lama diproses. Muat ulang untuk cek status.",
      en: "The source is taking too long to process. Refresh to check the status.",
    },
    failedSuffix: { id: "gagal", en: "failed" },
    failedTitleSuffix: { id: "sumber gagal diproses", en: "sources failed to process" },
    maxTitlePrefix: { id: "Maks ", en: "Max " },
    maxTitleSuffix: { id: " sumber", en: " sources" },
    addSourceTitle: { id: "Tambah sumber", en: "Add source" },
    addSource: { id: "Tambah Sumber", en: "Add Source" },
    fromDocument: { id: "Dari dokumen", en: "From document" },
    fromUrl: { id: "Dari URL", en: "From URL" },
    pasteText: { id: "Tempel teks", en: "Paste text" },
    fromFolder: { id: "Dari folder", en: "From folder" },
    limitPrefix: { id: "Maksimal ", en: "Maximum " },
    limitSuffix: {
      id: " sumber. Hapus dulu untuk tambah baru.",
      en: " sources. Remove one first to add a new one.",
    },
    selectAllSources: { id: "Pilih semua sumber", en: "Select all sources" },
    deselectAll: { id: "Hapus pilihan semua sumber", en: "Deselect all sources" },
    allSources: { id: "Semua sumber", en: "All sources" },
    of: { id: "dari", en: "of" },
    selectedWord: { id: "dipilih", en: "selected" },
    selectMin: { id: "Pilih minimal 1", en: "Select at least 1" },
    sourcesRegion: { id: "Daftar sumber", en: "Sources list" },
    dismiss: { id: "Tutup", en: "Dismiss" },
    emptyTitle: { id: "Belum ada sumber", en: "No sources yet" },
    emptyBody: {
      id: "AI butuh sumber untuk menjawab. Tambahkan dokumen atau URL.",
      en: "The AI needs sources to answer. Add a document or URL.",
    },
    include: { id: "Sertakan", en: "Include" },
    exclude: { id: "Kecualikan", en: "Exclude" },
    fromChat: { id: "dari chat", en: "from chat" },
    retry: { id: "Coba lagi", en: "Try again" },
    removeSourceTitle: { id: "Hapus sumber", en: "Remove source" },
  },

  status: {
    processing: { id: "Memproses", en: "Processing" },
    processingTitle: { id: "Memproses sumber…", en: "Processing source…" },
    failed: { id: "Gagal", en: "Failed" },
    failedTitle: { id: "Gagal mengekstrak konten", en: "Failed to extract content" },
    ready: { id: "Siap", en: "Ready" },
    readyTitle: { id: "Siap digunakan", en: "Ready to use" },
    unknown: { id: "Tidak diketahui", en: "Unknown" },
  },

  time: {
    justNow: { id: "baru saja", en: "just now" },
    minute: { id: "m", en: "m" },
    hour: { id: "j", en: "h" },
    day: { id: "h", en: "d" },
  },

  prov: {
    title: { id: "Bukti Asal Jawaban", en: "Answer Provenance" },
    noEvidence: {
      id: "Belum ada bukti untuk jawaban ini.",
      en: "No evidence yet for this answer.",
    },
    verifying: { id: "Memverifikasi…", en: "Verifying…" },
    answerUnchanged: {
      id: "Jawaban belum diubah sejak dibuat",
      en: "The answer has not been changed since it was created",
    },
    answerChanged: {
      id: "Jawaban sudah berubah sejak bukti dibuat",
      en: "The answer has changed since the evidence was created",
    },
    chainIntact: { id: "Rantai audit utuh", en: "Audit chain intact" },
    chainBroken: { id: "Rantai audit rusak", en: "Audit chain broken" },
    sourcesSame: { id: "Semua sumber masih sama", en: "All sources are still the same" },
    sourcesChanged: {
      id: "Sebagian sumber sudah berubah",
      en: "Some sources have changed",
    },
    sourcesLabel: { id: "Sumber", en: "Sources" },
    removed: { id: "dihapus", en: "removed" },
    same: { id: "sama", en: "same" },
    changed: { id: "berubah", en: "changed" },
    footerPart1: {
      id: "Bukti ini memastikan jawaban dibuat dari sumber tersebut, pada waktu tersebut, dan catatannya belum diubah. Bukti ini ",
      en: "This evidence confirms the answer was built from those sources, at that time, and its record has not been altered. This evidence does ",
    },
    footerEmphasis: { id: "tidak", en: "not" },
    footerPart2: {
      id: " menjamin jawaban AI benar.",
      en: " guarantee the AI answer is correct.",
    },
  },
};
