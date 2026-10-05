// i18n dictionary. Key prefix: misc.*
export default {
  // OnlyOffice loading skeleton stage labels
  stage: {
    script: { id: "Memuat editor...", en: "Loading editor..." },
    config: { id: "Mengambil dokumen...", en: "Fetching document..." },
    init: { id: "Menyiapkan tampilan...", en: "Preparing view..." },
    ready: { id: "Siap", en: "Ready" },
    default: { id: "Memuat...", en: "Loading..." },
  },

  // OnlyOffice editor shell
  oo: {
    someone: { id: "Seseorang", en: "Someone" },

    err: {
      "-1": {
        id: "Koneksi ke editor terputus, mencoba menyambung kembali...",
        en: "Connection to the editor was lost, reconnecting...",
      },
      "-2": {
        id: "Editor sedang sibuk, tunggu sebentar.",
        en: "The editor is busy, please wait a moment.",
      },
      "-3": {
        id: "Dokumen sedang dikonversi, harap tunggu.",
        en: "The document is being converted, please wait.",
      },
      "-4": {
        id: "Tidak bisa mengambil dokumen dari server.",
        en: "Unable to fetch the document from the server.",
      },
      "-5": { id: "Konten tidak didukung.", en: "Unsupported content." },
      "-6": {
        id: "Format kunci dokumen tidak valid.",
        en: "Invalid document key format.",
      },
      unknown: {
        id: "Terjadi kesalahan tidak dikenal. Coba muat ulang.",
        en: "An unknown error occurred. Try reloading.",
      },
      loadLib: {
        id: "Gagal memuat library editor.",
        en: "Failed to load the editor library.",
      },
      noContainer: {
        id: "Container editor tidak ditemukan di DOM.",
        en: "Editor container not found in the DOM.",
      },
      noApi: {
        id: "OnlyOffice API tidak tersedia.",
        en: "OnlyOffice API is not available.",
      },
      loadFail: { id: "Editor gagal dimuat.", en: "The editor failed to load." },
      reloadFail: { id: "Reload gagal.", en: "Reload failed." },
    },

    time: {
      minLeft: { id: "menit lagi", en: "min left" },
      hour: { id: "jam", en: "hr" },
      min: { id: "menit", en: "min" },
    },

    status: {
      unsaved: { id: "Belum tersimpan", en: "Unsaved" },
      reconnecting: { id: "Menyambung", en: "Reconnecting" },
    },

    presence: {
      editing: { id: "mengedit", en: "editing" },
      viewing: { id: "melihat", en: "viewing" },
    },

    action: {
      reload: { id: "Muat ulang", en: "Reload" },
      saveClose: { id: "Simpan & Tutup", en: "Save & Close" },
    },

    tooltip: {
      editedBy: { id: "Sedang diedit oleh", en: "Being edited by" },
      openEdit: { id: "Buka mode edit", en: "Open edit mode" },
    },

    badge: {
      locked: { id: "Terkunci", en: "Locked" },
    },

    toast: {
      reconnecting: { id: "Menyambung ulang...", en: "Reconnecting..." },
      sessionWarn: {
        id: "Sesi edit habis dalam <5 menit, simpan dulu.",
        en: "Edit session ends in under 5 min, save now.",
      },
      saveBeforeReload: {
        id: "Save dulu sebelum reload, perubahan akan hilang.",
        en: "Save before reloading, changes will be lost.",
      },
      latestVersion: {
        id: "Sudah versi terbaru.",
        en: "Already the latest version.",
      },
      loadedVersion: { id: "Dimuat versi", en: "Loaded version" },
      refreshed: { id: "Editor disegarkan.", en: "Editor refreshed." },
      sessionExpired: {
        id: "Sesi edit habis. Kembali ke mode lihat.",
        en: "Edit session expired. Returning to view mode.",
      },
      renamed: {
        id: "Nama dokumen diperbarui.",
        en: "Document name updated.",
      },
      renameFail: { id: "Gagal mengubah nama.", en: "Failed to rename." },
      accessReleased: {
        id: "Akses edit dilepas. Dokumen kembali ke mode lihat.",
        en: "Edit access released. Document returned to view mode.",
      },
      pingSent: {
        id: "sudah dapat notifikasi permintaan akses.",
        en: "has been notified of the access request.",
      },
      pingFail: {
        id: "Gagal mengirim permintaan.",
        en: "Failed to send the request.",
      },
      forceReleased: {
        id: "Lock dilepas paksa. Reload editor untuk masuk edit mode.",
        en: "Lock force-released. Reload the editor to enter edit mode.",
      },
      forceReleaseFail: {
        id: "Gagal melepas lock.",
        en: "Failed to release the lock.",
      },
    },

    confirm: {
      saveBeforeRelease: {
        id: "Simpan perubahan sebelum melepas akses?",
        en: "Save changes before releasing access?",
      },
      forceReleasePre: {
        id: "Paksa lepas akses edit dari",
        en: "Force-release edit access from",
      },
      forceReleasePost: {
        id: "Perubahan mereka mungkin hilang.",
        en: "Their changes may be lost.",
      },
    },

    error: {
      title: { id: "Editor gagal dimuat", en: "Editor failed to load" },
    },

    ping: {
      wantsEdit: {
        id: "ingin mengedit dokumen ini.",
        en: "wants to edit this document.",
      },
      release: { id: "Lepas akses", en: "Release access" },
      later: { id: "Nanti dulu", en: "Not now" },
    },

    lock: {
      editing: {
        id: "sedang mengedit dokumen ini",
        en: "is editing this document",
      },
      sessionEnds: { id: "Sesi berakhir", en: "Session ends" },
      explain: {
        id: "Untuk mencegah konflik, hanya satu orang yang bisa mengedit dokumen ini secara bersamaan. Anda tetap bisa melihat isi dokumen dan menambahkan komentar.",
        en: "To prevent conflicts, only one person can edit this document at a time. You can still view the document and add comments.",
      },
      requestAccess: { id: "Minta akses edit", en: "Request edit access" },
      forceRelease: { id: "Paksa lepas (Admin)", en: "Force release (Admin)" },
      justView: { id: "Lihat saja", en: "Just view" },
    },

    eject: {
      title: { id: "Sesi edit habis", en: "Edit session expired" },
      body: {
        id: "Sesi 2 jam telah berakhir. Perubahan akan disimpan otomatis, lalu kembali ke mode lihat.",
        en: "The 2-hour session has ended. Changes will be saved automatically, then you'll return to view mode.",
      },
      ok: { id: "Mengerti", en: "Got it" },
    },
  },
};
