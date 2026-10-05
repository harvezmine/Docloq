// Keep in sync with manual-guide-id.txt / manual-guide-en.txt. Structure: groups → pages → sections.
// Section fields: body[] | list[] | steps[] | variant("cards"|"steps-boxed") | callout{tone,title,text} | note | image{src,caption} | shots[].

const ID = {
  ui: {
    search: "Cari di dokumentasi…",
    onThisPage: "Di halaman ini",
    noResults: "Tidak ada hasil.",
    empty: "Pilih topik dari panel kiri.",
  },
  groups: [
    {
      id: "mulai",
      label: "Mulai",
      pages: [
        {
          id: "pengenalan",
          title: "Pengenalan",
          subtitle: "Selamat datang di DocLoq, sistem manajemen dokumen yang aman & terpercaya.",
          sections: [
            {
              heading: "Apa Itu DocLoq",
              body: [
                "DocLoq menggabungkan enkripsi tingkat enterprise, pelacakan kebocoran, verifikasi keaslian, dan asisten AI dalam satu platform terintegrasi.",
              ],
              variant: "cards",
              list: [
                { icon: "lock", title: "Enkripsi Otomatis", text: "Tiap dokumen dienkripsi kunci unik (AES-256-GCM) sebelum disimpan." },
                { icon: "check", title: "Verifikasi Keaslian", text: "QR code + blockchain Polygon untuk bukti permanen yang bisa dicek siapa pun." },
                { icon: "bot", title: "Asisten AI Privat", text: "Dokumen terkunci dari AI sampai Anda izinkan sendiri." },
                { icon: "eye", title: "Lacak Kebocoran", text: "Watermark unik per unduhan + honeytoken, jika bocor, ketahuan siapa." },
              ],
              callout: { tone: "info", title: "Tip", text: "Sebagian menu hanya muncul jika fitur diaktifkan admin (Verification, AI Projects, OSINT, DoKi, Blockchain)." },
            },
          ],
        },
        {
          id: "masuk",
          title: "Masuk & Keluar",
          subtitle: "Login email/password atau Google, 2FA opsional, dan cara keluar.",
          sections: [
            {
              heading: "Masuk (Sign In)",
              variant: "steps-boxed",
              steps: [
                "Buka halaman login (docloq.site/login).",
                "Isi Email dan Password (ikon mata untuk lihat/sembunyikan).",
                "Centang 'Remember me' bila perlu.",
                "Selesaikan pemeriksaan keamanan (Cloudflare).",
                "Klik 'Sign in'.",
                "Jika 2FA aktif: masukkan kode 6 digit dari authenticator atau OTP email.",
                "Anda tiba di Dashboard.",
              ],
            },
            {
              heading: "Masuk dengan Google",
              body: ["Klik 'Sign in with Google' lalu pilih akun. Hanya email yang sudah didaftarkan admin yang diterima."],
              note: "Tidak ada pendaftaran mandiri, halaman login menampilkan 'Contact us to request access'.",
            },
            {
              heading: "Keluar (Sign Out)",
              body: ["Klik nama/profil Anda di KIRI-BAWAH sidebar → 'Sign Out'. Bisa juga lewat Settings → Sign Out."],
              callout: { tone: "warning", title: "Penting", text: "Sign out ada di kiri-bawah (profil), bukan kanan-atas." },
            },
            {
              heading: "Catatan Keamanan",
              list: [
                "Jangan pernah bagikan password atau kode OTP.",
                "Idle ~3 jam → otomatis keluar.",
                "Terlalu banyak salah password → akun terkunci sementara.",
              ],
            },
          ],
        },
        {
          id: "bilah-atas",
          title: "Bilah Atas & Bahasa",
          subtitle: "Toggle bahasa, dokumentasi, dan notifikasi di setiap halaman.",
          sections: [
            {
              heading: "Tiga Kontrol di Kanan Atas",
              variant: "cards",
              list: [
                { icon: "globe", title: "Toggle ID / EN", text: "Ganti antarmuka Indonesia / Inggris." },
                { icon: "clipboard", title: "Dokumentasi (ikon buku)", text: "Membuka panduan ini di dalam aplikasi." },
                { icon: "megaphone", title: "Lonceng Notifikasi", text: "Pemberitahuan belum dibaca (lihat bagian Notifikasi)." },
              ],
              callout: { tone: "info", text: "Toggle Terang/Gelap dan profil Anda ada di kiri-bawah sidebar." },
            },
          ],
        },
        {
          id: "dashboard",
          title: "Dashboard Utama",
          subtitle: "Layar utama setelah masuk: ringkasan, statistik, dan aksi cepat.",
          sections: [
            {
              heading: "Yang Ada di Dashboard",
              list: [
                "Kartu statistik: Dokumen, Tugas, Penyimpanan, Formulir.",
                "Aksi cepat: Upload Document, Verify Document, AI Analysis, OSINT Tracker.",
                "Task Overview (Pending / In Progress / Completed / Overdue).",
                "Document Breakdown (donat per tipe file) + Storage by File Type + AI Analysis Quota.",
              ],
              image: { src: "/dashboard.png", caption: "Dashboard DocLoq" },
            },
          ],
        },
      ],
    },
    {
      id: "dokumen",
      label: "Dokumen",
      pages: [
        {
          id: "upload",
          title: "Unggah & Kelola Dokumen",
          subtitle: "Upload (klik atau drag), lihat detail, pindahkan, komentar, hapus.",
          sections: [
            {
              heading: "Langkah Upload",
              variant: "steps-boxed",
              steps: [
                "Buka 'Documents' dari sidebar.",
                "Klik 'Upload' ATAU seret file langsung dari komputer ke halaman.",
                "Pilih satu atau beberapa file.",
                "Tunggu: Validating → Scanning for viruses → Encrypting → Saving.",
                "Dokumen muncul dengan label 'Active'.",
              ],
              shots: [
                { src: "/documentpage.png", caption: "Halaman Documents" },
                { src: "/uploaddoc.png", caption: "Upload / drag-and-drop" },
              ],
            },
            {
              heading: "Format Didukung",
              list: [
                "Office: DOCX, DOC, XLSX, XLS, PPTX, PPT, ODT, ODS, ODP",
                "PDF",
                "Gambar: PNG, JPG, JPEG, WEBP, TIFF, BMP",
                "Teks: TXT, CSV, MARKDOWN, RTF",
                "Batas: sesuai admin (default 50 MB). ZIP/EXE diblokir.",
              ],
            },
            {
              heading: "Otomatis Saat Upload",
              variant: "cards",
              list: [
                { icon: "bug", title: "Pindai Virus", text: "File dipindai sebelum disimpan." },
                { icon: "lock", title: "Enkripsi", text: "Kunci unik AES-256-GCM." },
                { icon: "fingerprint", title: "Sidik Jari", text: "SHA-256 + SSDEEP + SimHash." },
                { icon: "qr", title: "QR Verifikasi", text: "Kode QR keaslian dibuat otomatis." },
              ],
            },
            {
              heading: "Detail, Pindah, Komentar, Hapus",
              steps: [
                "Klik kartu dokumen → panel detail (Format, Ukuran, Security Details, Blockchain Anchoring).",
                "Tombol detail: Preview, Edit, Download, Share.",
                "Pindahkan: aksi Move → pilih 'Root (Unfiled)' atau folder.",
                "Komentar: aksi Komentar → tulis (pakai '@' untuk mention).",
                "Hapus: aksi Hapus → konfirmasi 'Pindahkan ke trash?' → masuk Sampah (30 hari).",
              ],
              image: { src: "/documentmodal.png", caption: "Panel detail dokumen + Security Details" },
              callout: { tone: "info", text: "Tidak ada menu klik-kanan, gunakan tombol/ikon pada kartu dan panel detail." },
            },
          ],
        },
        {
          id: "folder",
          title: "Folder & Hierarki",
          subtitle: "Buat folder, atur pohon, dan hak akses.",
          sections: [
            {
              heading: "Buat & Atur Folder",
              steps: [
                "Di Documents, klik 'New Folder' → isi nama → pilih warna → Create.",
                "Buka 'Folder Hierarchy' untuk tampilan pohon penuh.",
                "Statistik: Root Folders, Total Folders, Max Depth, Empty Folders, Total Documents.",
                "Tiap folder punya ikon: jumlah dokumen, buka, tambah subfolder, edit, hapus.",
                "Klik folder → dialog daftar dokumen + 'Open in Documents'.",
              ],
              shots: [
                { src: "/addfolder.png", caption: "Buat folder baru" },
                { src: "/folderhierarchypage.png", caption: "Halaman Folder Hierarchy" },
                { src: "/docinsidefolder.png", caption: "Dokumen di dalam folder" },
              ],
            },
            {
              heading: "Hak Akses",
              body: ["Akses dokumen/folder diatur lewat peran kustom (Role Management): tetapkan Viewer / Editor / Admin pada folder atau dokumen tertentu. Owner & admin selalu punya akses."],
            },
          ],
        },
        {
          id: "buka-edit",
          title: "Membuka & Mengedit",
          subtitle: "Editor OnlyOffice untuk Office, viewer untuk PDF/gambar.",
          sections: [
            {
              heading: "Dokumen Office",
              body: ["Buka dokumen → klik 'Edit' → terbuka di editor OnlyOffice (menu File, View, Plugins, AI). Perubahan tersimpan otomatis; tiap simpan jadi versi baru."],
            },
            {
              heading: "PDF & Gambar",
              body: ["Klik 'Preview' → terbuka di viewer dalam aplikasi, ada opsi Download. Tutup dengan X atau Escape."],
            },
            {
              heading: "Riwayat Versi",
              body: ["Detail dokumen → daftar versi (tanggal + penulis). Versi tidak pernah ditimpa, tiap perubahan jadi versi baru."],
            },
          ],
        },
        {
          id: "unduh",
          title: "Mengunduh Dokumen",
          subtitle: "Unduh format asli atau konversi; tiap unduhan ber-watermark.",
          sections: [
            {
              heading: "Unduh & Konversi",
              steps: [
                "Buka dokumen → 'Download' untuk format asli (didekripsi di memori).",
                "Dropdown Download (panah) → konversi: DOCX→PDF, PDF→DOCX, XLSX→PDF/CSV, Gambar→JPG/PNG.",
                "Tombol 'Share' membuat tautan pratinjau publik.",
              ],
              image: { src: "/sharedoc.png", caption: "Opsi Download & Share di panel dokumen" },
              callout: { tone: "info", title: "Anti-bocor", text: "Tiap unduhan ditandai watermark tak terlihat (lacak pengunduh). Jika OSINT tracking aktif, kode terlihat kecil juga distempel." },
              note: "Tanpa izin akses → ditolak (Error 403). Dokumen di Sampah tidak bisa diunduh.",
            },
          ],
        },
      ],
    },
    {
      id: "verifikasi",
      label: "Verifikasi & Blockchain",
      pages: [
        {
          id: "verifikasi",
          title: "Verifikasi Keaslian",
          subtitle: "Dua metode: Scan QR dan Upload File. Alur: Metode → Input → Hasil.",
          sections: [
            {
              heading: "Dua Cara Verifikasi",
              body: ["Pilih salah satu metode sesuai yang Anda punya."],
              variant: "cards",
              list: [
                { icon: "qr", title: "Scan QR", text: "Unggah/scan gambar kode QR yang tercetak pada dokumen. Tidak perlu login." },
                { icon: "fingerprint", title: "Upload File", text: "Unggah file digital, dicek persis (hash) lalu fuzzy (SimHash) bila tidak persis. Perlu login." },
              ],
            },
            {
              heading: "Scan QR",
              steps: [
                "Pilih 'Scan QR'.",
                "Unggah atau scan gambar kode QR (PNG/JPG).",
                "Lihat hasil, integritas blockchain ditampilkan otomatis bila dokumen ter-anchor.",
              ],
            },
            {
              heading: "Upload File",
              body: ["Perlu login."],
              steps: [
                "Pilih 'Upload File'.",
                "Unggah file digital, dicek persis (hash) dulu, lalu fuzzy (SimHash) bila tidak sama persis.",
                "Lihat hasil. Untuk integritas blockchain, klik tombol cek on-chain sesuai permintaan.",
                "Gunakan 'Lihat dokumen' untuk pratinjau read-only sebagai pembanding visual.",
              ],
            },
            {
              heading: "Halaman /verify Publik",
              body: ["Pihak luar bisa memverifikasi lewat halaman publik /verify dengan men-scan QR, tanpa perlu login atau akun."],
            },
            {
              heading: "Catatan Penting",
              body: ["Verifikasi mencocokkan ke file ASLI yang terdaftar. Salinan hasil konversi format atau yang di-download ulang (mis. PDF→DOCX) isinya bisa berubah sehingga hash/SimHash beda dan bisa gagal verifikasi. Bila ter-anchor di blockchain, verifikasi juga dicek ke catatan on-chain."],
            },
          ],
        },
        {
          id: "blockchain",
          title: "Blockchain (Polygon)",
          subtitle: "Bukti keaslian permanen, hanya hash yang disimpan.",
          sections: [
            {
              heading: "Anchor & Verifikasi",
              steps: [
                "Detail dokumen → 'Blockchain Anchoring' → 'Anchor to Polygon'.",
                "Status: Not anchored → Recorded → Confirmed (permanen).",
                "Nyalakan 'Auto-anchor on edit' agar tiap versi baru ter-anchor otomatis.",
                "Halaman Verification mencocokkan dokumen ke chain.",
              ],
              callout: { tone: "success", text: "Yang disimpan hanya sidik jari (hash), tanpa nama file, isi, atau identitas Anda." },
            },
          ],
        },
      ],
    },
    {
      id: "tugas",
      label: "Tugas & Formulir",
      pages: [
        {
          id: "tugas",
          title: "Tugas, Review & Tanda Tangan",
          subtitle: "Fill, Review, Approve, Sign (DocuSeal), General.",
          sections: [
            {
              heading: "My Tasks",
              body: ["Kartu Active / Completed / Rejected, tab penyaring, filter Type, dan kalender tenggat."],
            },
            {
              heading: "Buat & Kerjakan",
              steps: [
                "Klik 'Create Task' → isi judul, deskripsi, tipe, penerima, prioritas, tenggat, dokumen terkait → Save.",
                "Penerima dapat notifikasi; buka tugas → ikuti instruksi → tombol aksi (Fill/Done).",
                "Status jadi 'Completed'. Diskusi via komentar tugas.",
              ],
            },
            {
              heading: "Alur Berurutan & Tanda Tangan",
              body: [
                "Tugas bisa dirantai (Fill → Review → Approve → Sign); selesai satu memicu berikutnya.",
                "Tugas 'Sign': buka editor tanda tangan (DocuSeal) → gambar/pilih tanda tangan → letakkan → Finish. Untuk menolak: Decline + alasan.",
              ],
            },
          ],
        },
        {
          id: "forms",
          title: "Formulir Digital",
          subtitle: "Template + workflow untuk mengumpulkan data terstruktur.",
          sections: [
            {
              heading: "Buat Template",
              body: ["Tab Templates / Created. Klik 'New Template' lalu pilih cara mulai:"],
              variant: "cards",
              list: [
                { icon: "diskette", title: "Blank Document", text: "Mulai kosong di editor." },
                { icon: "cloud", title: "Upload File", text: "Unggah DOCX/PDF (PDF dikonversi otomatis untuk diedit)." },
                { icon: "clipboard", title: "Form Schema Template", text: "Definisikan field formulir manual (tanpa dokumen)." },
              ],
              image: { src: "/createtemplate.png", caption: "Buat Template baru" },
            },
            {
              heading: "Buat Form & Hasil",
              steps: [
                "Klik 'Create Form' → isi Form Name, pilih Template, atur Start/Due Date.",
                "Tambah Workflow Steps (Select user + Action; 'Add Step' untuk lebih).",
                "Klik 'Create Form' → penerima dapat tugas pengisian.",
                "Pemilik template melihat semua jawaban di Results (bisa diekspor).",
              ],
              image: { src: "/createform.png", caption: "Create Form + Workflow Steps" },
            },
          ],
        },
      ],
    },
    {
      id: "ai",
      label: "AI & OSINT",
      pages: [
        {
          id: "doki",
          title: "DoKi, Asisten AI",
          subtitle: "Asisten mengambang di pojok kanan-bawah tiap halaman.",
          sections: [
            {
              heading: "Pakai DoKi",
              body: ["Klik gelembung DoKi → chat terbuka dengan saran cepat: Lihat dokumen saya, Tugas saya, Fitur DocLoq, Info keamanan, List user, Role management."],
              list: [
                "DoKi hanya melihat data dalam organisasi Anda.",
                "Menolak instruksi mencurigakan + ada batas pesan per jam.",
                "Hapus chat dengan ikon tempat sampah.",
              ],
              image: { src: "/doki.png", caption: "Asisten DoKi" },
            },
          ],
        },
        {
          id: "ai-projects",
          title: "AI Projects",
          subtitle: "Ruang kerja chat AI berbasis sumber (dokumen, URL, teks), ala NotebookLM.",
          sections: [
            {
              heading: "Buat Project & Tambah Sumber",
              variant: "steps-boxed",
              steps: [
                "Buka 'AI Projects' → 'Project Baru' → isi Nama, Deskripsi, Instruksi AI (opsional).",
                "Di workspace klik 'Tambah Sumber': Dari Dokumen (perlu akses AI), Dari URL (artikel/YouTube), atau Dari Teks.",
                "Beri akses AI: buka dokumen → AI Access → baca peringatan → 'Grant AI Access' (bisa dicabut).",
                "Chat (Cmd/Ctrl + Enter). Jawaban mengutip sumber [1], [2]; klik untuk loncat ke sumbernya & melihat kutipannya.",
              ],
              shots: [
                { src: "/aiprojpage.png", caption: "Halaman AI Projects" },
                { src: "/insideproject.png", caption: "Workspace + kutipan sumber" },
                { src: "/adddocumentforanalyze.png", caption: "Tambah sumber dokumen" },
                { src: "/aisourcetypes.png", caption: "Jenis sumber yang diterima" },
              ],
            },
            {
              heading: "Studio & Catatan",
              body: ["Dari panel Studio, ubah sumber jadi output rapi: Report, Slides, Mind Map, atau Infographic (sebagian dengan gambar sampul hasil AI); output tersimpan di project. Kelola Catatan dari panel samping; buka Instruksi & Insight lewat ikon pengaturan (gerigi)."],
            },
            {
              heading: "Batas",
              body: ["Maks 20 project per organisasi, 10 sumber per project, dan 50 pesan per project per 24 jam."],
            },
          ],
        },
        {
          id: "osint",
          title: "OSINT Tracker",
          subtitle: "Pemantauan kebocoran dokumen.",
          sections: [
            {
              heading: "Aktifkan Tracking & Pantau",
              steps: [
                "Di detail dokumen, owner atau pembuat menyalakan 'OSINT Tracking'.",
                "Setelah aktif, tiap unduhan membawa kode unik → salinan bocor bisa dilacak ke unduhan tertentu. Kode terlihat hanya bisa ditanam pada PDF, TXT, dan DOCX.",
                "Tab Monitor menampilkan ringkasan visual: Tracking Funnel (dokumen → unduhan → kebocoran → pengunduh terlacak), Detection Breakdown per tipe, dan radar status auto-scan.",
                "Tab Leaks mendaftar kebocoran terdeteksi (bisa difilter per tipe); tab Check Document menjalankan pencarian web sesuai permintaan untuk kode kanari sebuah dokumen.",
                "Tab Scan Watermark: unggah file dicurigai bocor untuk identifikasi pengunduh dari watermark tak terlihat.",
              ],
              callout: { tone: "info", title: "Catatan", text: "Pencarian web publik butuh provider (Google CSE / Serper) dikonfigurasi admin; tanpa itu tab Check Document tidak menemukan hit. Check Document hanya bisa mencari unduhan yang membawa kode, unduhan lama (sebelum tracking aktif) dan format tanpa kode (XLSX, PPTX, gambar) perlu diunduh ulang dulu." },
            },
          ],
        },
      ],
    },
    {
      id: "akun",
      label: "Akun & Pengaturan",
      pages: [
        {
          id: "pengaturan",
          title: "Pengaturan",
          subtitle: "Profile, User Management, Departments, Security, Notifications, Company.",
          sections: [
            {
              heading: "Profile & Keamanan",
              steps: [
                "Profile: edit nama, Email, Telepon, Department, Position → Save Changes.",
                "Security → Change Password: lama → baru → konfirmasi (min 8).",
                "Two-Factor Authentication: OPSIONAL, 'Enable 2FA' (Google Authenticator). Sangat disarankan.",
                "Active Sessions: tiap perangkat + IP; keluarkan satu atau 'Keluar dari perangkat lain'.",
              ],
            },
            {
              heading: "Pengguna, Departemen & Perusahaan (admin/owner)",
              list: [
                "User Management: Add User (nama, email, password min 8, telepon, department, Role: Admin/User, position); nonaktifkan/hapus.",
                "Departments: Add Department (nama, deskripsi, warna).",
                "Company: nama + COMPANY CODE (identitas tenant unik) untuk mengundang rekan; Set Up Company Profile.",
                "Notifications: toggle Email, Document Updates, Task Reminders, Security Alerts.",
              ],
              shots: [
                { src: "/addusermodal.png", caption: "Tambah pengguna" },
                { src: "/adddepartmentmodal.png", caption: "Tambah departemen" },
              ],
            },
          ],
        },
        {
          id: "peran",
          title: "Peran & Peran Kustom",
          subtitle: "Akun: Owner / Admin / User. Plus peran kustom granular.",
          sections: [
            {
              heading: "Peran Akun",
              variant: "cards",
              list: [
                { icon: "key", title: "Owner", text: "Akun tertinggi organisasi (pendiri); kendali penuh." },
                { icon: "cog", title: "Admin", text: "Kelola pengguna, departemen, dokumen, pengaturan." },
                { icon: "phone", title: "User", text: "Penggunaan dokumen sehari-hari." },
              ],
            },
            {
              heading: "Peran Kustom (Role Management)",
              steps: [
                "Buka 'Role Management' → 'Create Role'.",
                "Isi Role Name, Description, warna.",
                "Per folder/dokumen pilih: No Access / Viewer / Editor / Admin.",
                "Tetapkan pengguna ke peran.",
              ],
              image: { src: "/addrolemanagementmodal.png", caption: "Create Role, izin per folder/dokumen" },
            },
          ],
        },
        {
          id: "notifikasi",
          title: "Pemberitahuan",
          subtitle: "Lonceng di bilah atas.",
          sections: [
            {
              heading: "Jenis Notifikasi",
              list: [
                "Tugas baru ditugaskan ke Anda (atau pembaruan / tenggat tugas).",
                "Sebutan/tag Anda ('@Anda') di komentar dokumen.",
              ],
              image: { src: "/notifsettings.png", caption: "Preferensi notifikasi (Settings → Notifications)" },
              note: "Saat tak ada yang baru, panel menampilkan 'No notifications yet'.",
            },
          ],
        },
        {
          id: "sampah",
          title: "Sampah & Pemulihan",
          subtitle: "Item terhapus otomatis hilang setelah 30 hari.",
          sections: [
            {
              heading: "Halaman Sampah",
              list: [
                "Statistik: Total, Documents, Templates, Expiring soon, Size.",
                "Filter All / Docs / Templates + pencarian.",
                "Tiap item: ikon Restore + ikon Hapus permanen (konfirmasi merah).",
              ],
              image: { src: "/trashpage.png", caption: "Halaman Sampah" },
              callout: { tone: "warning", text: "Hapus permanen tidak bisa dipulihkan." },
            },
          ],
        },
        {
          id: "keamanan",
          title: "Tips Keamanan",
          subtitle: "Praktik aman memakai DocLoq.",
          sections: [
            {
              heading: "Wajib Diingat",
              list: [
                "Jangan bagikan password / kode OTP, DocLoq tak akan meminta.",
                "Pakai password unik; aktifkan authenticator (lebih kuat dari OTP email).",
                "Sign out di komputer bersama (profil kiri-bawah).",
                "Tinjau Active Sessions dan keluarkan perangkat asing.",
                "Waspadai login dari lokasi asing, ganti password + hubungi admin.",
              ],
            },
          ],
        },
      ],
    },
  ],
};

const EN = {
  ui: {
    search: "Search the docs…",
    onThisPage: "On this page",
    noResults: "No results.",
    empty: "Pick a topic from the left.",
  },
  groups: [
    {
      id: "start",
      label: "Getting Started",
      pages: [
        {
          id: "intro",
          title: "Introduction",
          subtitle: "Welcome to DocLoq, a secure & trusted document management system.",
          sections: [
            {
              heading: "What Is DocLoq",
              body: [
                "DocLoq combines enterprise-grade encryption, leak tracking, authenticity verification, and an AI assistant in one integrated platform.",
              ],
              variant: "cards",
              list: [
                { icon: "lock", title: "Automatic Encryption", text: "Every document is encrypted with a unique key (AES-256-GCM) before storage." },
                { icon: "check", title: "Authenticity Verification", text: "QR code + Polygon blockchain for permanent, anyone-can-check proof." },
                { icon: "bot", title: "Private AI Assistant", text: "Documents stay locked from AI until you grant access." },
                { icon: "eye", title: "Leak Tracking", text: "Per-download watermark + honeytokens, if it leaks, we know who." },
              ],
              callout: { tone: "info", title: "Tip", text: "Some menus only appear if your org enables the feature (Verification, AI Projects, OSINT, DoKi, Blockchain)." },
            },
          ],
        },
        {
          id: "signin",
          title: "Sign In & Sign Out",
          subtitle: "Email/password or Google login, optional 2FA, and how to sign out.",
          sections: [
            {
              heading: "Sign In",
              variant: "steps-boxed",
              steps: [
                "Open the login page (docloq.site/login).",
                "Enter Email and Password (eye icon to show/hide).",
                "Tick 'Remember me' if you like.",
                "Complete the security check (Cloudflare).",
                "Click 'Sign in'.",
                "If 2FA is enabled: enter the 6-digit code from your authenticator or email OTP.",
                "You land on the Dashboard.",
              ],
            },
            {
              heading: "Sign In With Google",
              body: ["Click 'Sign in with Google' and pick your account. Only emails already registered by an admin are accepted."],
              note: "There is no self-registration, the login page shows 'Contact us to request access'.",
            },
            {
              heading: "Sign Out",
              body: ["Click your name/profile at the BOTTOM-LEFT of the sidebar → 'Sign Out'. You can also use Settings → Sign Out."],
              callout: { tone: "warning", title: "Note", text: "Sign out is bottom-left (profile), not top-right." },
            },
            {
              heading: "Security Notes",
              list: [
                "Never share your password or OTP codes.",
                "After ~3 hours idle you're signed out.",
                "Too many wrong passwords temporarily locks the account.",
              ],
            },
          ],
        },
        {
          id: "topbar",
          title: "The Top Bar & Language",
          subtitle: "Language toggle, docs, and notifications on every page.",
          sections: [
            {
              heading: "Three Controls (Top Right)",
              variant: "cards",
              list: [
                { icon: "globe", title: "ID / EN Toggle", text: "Switch the interface between Indonesian and English." },
                { icon: "clipboard", title: "Docs (book icon)", text: "Opens this in-app user guide." },
                { icon: "megaphone", title: "Notification Bell", text: "Unread alerts (see the Notifications page)." },
              ],
              callout: { tone: "info", text: "Light/Dark toggle and your profile are at the bottom-left of the sidebar." },
            },
          ],
        },
        {
          id: "dashboard",
          title: "Main Dashboard",
          subtitle: "Your home screen: overview, stats, and quick actions.",
          sections: [
            {
              heading: "What's on the Dashboard",
              list: [
                "Stat cards: Documents, Tasks, Storage, Forms.",
                "Quick actions: Upload Document, Verify Document, AI Analysis, OSINT Tracker.",
                "Task Overview (Pending / In Progress / Completed / Overdue).",
                "Document Breakdown (donut) + Storage by File Type + AI Analysis Quota.",
              ],
              image: { src: "/dashboard.png", caption: "DocLoq dashboard" },
            },
          ],
        },
      ],
    },
    {
      id: "documents",
      label: "Documents",
      pages: [
        {
          id: "upload",
          title: "Upload & Manage Documents",
          subtitle: "Upload (click or drag), view details, move, comment, delete.",
          sections: [
            {
              heading: "Upload Steps",
              variant: "steps-boxed",
              steps: [
                "Open 'Documents' in the sidebar.",
                "Click 'Upload' OR drag files straight from your computer onto the page.",
                "Pick one or more files.",
                "Wait for: Validating → Scanning for viruses → Encrypting → Saving.",
                "The document appears with an 'Active' badge.",
              ],
              shots: [
                { src: "/documentpage.png", caption: "Documents page" },
                { src: "/uploaddoc.png", caption: "Upload / drag-and-drop" },
              ],
            },
            {
              heading: "Supported Formats",
              list: [
                "Office: DOCX, DOC, XLSX, XLS, PPTX, PPT, ODT, ODS, ODP",
                "PDF",
                "Images: PNG, JPG, JPEG, WEBP, TIFF, BMP",
                "Text: TXT, CSV, MARKDOWN, RTF",
                "Limit: up to your admin's setting (default 50 MB). ZIP/EXE blocked.",
              ],
            },
            {
              heading: "Automatic on Upload",
              variant: "cards",
              list: [
                { icon: "bug", title: "Virus Scan", text: "Scanned before storage." },
                { icon: "lock", title: "Encryption", text: "Unique AES-256-GCM key." },
                { icon: "fingerprint", title: "Fingerprint", text: "SHA-256 + SSDEEP + SimHash." },
                { icon: "qr", title: "Verification QR", text: "Authenticity QR created automatically." },
              ],
            },
            {
              heading: "Details, Move, Comment, Delete",
              steps: [
                "Click a document card → details panel (Format, Size, Security Details, Blockchain Anchoring).",
                "Detail buttons: Preview, Edit, Download, Share.",
                "Move: the Move action → pick 'Root (Unfiled)' or a folder.",
                "Comment: the Comment action → type (use '@' to mention).",
                "Delete: the Delete action → 'Move to trash?' → goes to Trash (30 days).",
              ],
              image: { src: "/documentmodal.png", caption: "Document details + Security Details" },
              callout: { tone: "info", text: "There's no right-click menu, use the buttons/icons on the card and in the details panel." },
            },
          ],
        },
        {
          id: "folders",
          title: "Folders & Hierarchy",
          subtitle: "Create folders, organize the tree, and control access.",
          sections: [
            {
              heading: "Create & Organize",
              steps: [
                "In Documents, click 'New Folder' → name → color → Create.",
                "Open 'Folder Hierarchy' for the full tree view.",
                "Stats: Root Folders, Total Folders, Max Depth, Empty Folders, Total Documents.",
                "Each folder has icons: document count, open, add subfolder, edit, delete.",
                "Click a folder → dialog lists its documents + 'Open in Documents'.",
              ],
              shots: [
                { src: "/addfolder.png", caption: "Create a new folder" },
                { src: "/folderhierarchypage.png", caption: "Folder Hierarchy page" },
                { src: "/docinsidefolder.png", caption: "Documents inside a folder" },
              ],
            },
            {
              heading: "Access Permissions",
              body: ["Document/folder access is controlled by custom roles (Role Management): assign Viewer / Editor / Admin on specific folders or documents. Owners and admins always have access."],
            },
          ],
        },
        {
          id: "edit",
          title: "Opening & Editing",
          subtitle: "OnlyOffice editor for Office files, viewer for PDF/images.",
          sections: [
            {
              heading: "Office Documents",
              body: ["Open the document → click 'Edit' → it opens in the OnlyOffice editor (File, View, Plugins, AI menus). Changes auto-save; each save is a new version."],
            },
            {
              heading: "PDF & Images",
              body: ["Click 'Preview' → opens in the in-app viewer with a Download option. Close with X or Escape."],
            },
            {
              heading: "Version History",
              body: ["Document details → versions list (date + author). Versions are never overwritten, each change is a new version."],
            },
          ],
        },
        {
          id: "download",
          title: "Downloading Documents",
          subtitle: "Original or converted; every download is watermarked.",
          sections: [
            {
              heading: "Download & Convert",
              steps: [
                "Open the document → 'Download' for the original (decrypted in memory).",
                "Download dropdown (arrow) → convert: DOCX→PDF, PDF→DOCX, XLSX→PDF/CSV, Image→JPG/PNG.",
                "The 'Share' button creates a public preview link.",
              ],
              image: { src: "/sharedoc.png", caption: "Download & Share options in the document panel" },
              callout: { tone: "info", title: "Anti-leak", text: "Every download carries an invisible watermark (traces the downloader). If OSINT tracking is on, a tiny visible code is also stamped." },
              note: "Without access → refused (Error 403). Documents in Trash can't be downloaded.",
            },
          ],
        },
      ],
    },
    {
      id: "verify",
      label: "Verification & Blockchain",
      pages: [
        {
          id: "verification",
          title: "Verify Authenticity",
          subtitle: "Two methods: Scan QR and Upload File. Flow: Method → Input → Result.",
          sections: [
            {
              heading: "Two Ways to Verify",
              body: ["Pick the method that matches what you have."],
              variant: "cards",
              list: [
                { icon: "qr", title: "Scan QR", text: "Upload/scan the QR code image printed on the document. No login required." },
                { icon: "fingerprint", title: "Upload File", text: "Upload the digital file, checked exact (hash) then fuzzy (SimHash) if not exact. Login required." },
              ],
            },
            {
              heading: "Scan QR",
              steps: [
                "Choose 'Scan QR'.",
                "Upload or scan the QR code image (PNG/JPG).",
                "See the result, blockchain integrity is shown automatically when the document is anchored.",
              ],
            },
            {
              heading: "Upload File",
              body: ["Login required."],
              steps: [
                "Choose 'Upload File'.",
                "Upload the digital file, checked exact (hash) first, then fuzzy (SimHash) if not an exact match.",
                "See the result. For blockchain integrity, click the on-demand on-chain check button.",
                "Use 'View document' for a read-only preview to compare visually.",
              ],
            },
            {
              heading: "Public /verify Page",
              body: ["Outsiders can verify on the public /verify page by scanning a QR, no login or account needed."],
            },
            {
              heading: "Important Note",
              body: ["Verification matches against the ORIGINAL registered file. A format-converted or re-downloaded copy (e.g. PDF→DOCX) may have different content, so its hash/SimHash differs and may fail verification. Where anchored, it's also checked against the on-chain record."],
            },
          ],
        },
        {
          id: "blockchain",
          title: "Blockchain (Polygon)",
          subtitle: "Permanent authenticity proof, only the hash is stored.",
          sections: [
            {
              heading: "Anchor & Verify",
              steps: [
                "Document details → 'Blockchain Anchoring' → 'Anchor to Polygon'.",
                "Status: Not anchored → Recorded → Confirmed (permanent).",
                "Turn on 'Auto-anchor on edit' so each new version is anchored automatically.",
                "The Verification page checks the document against the chain.",
              ],
              callout: { tone: "success", text: "Only the fingerprint (hash) is stored, no file names, content, or your identity." },
            },
          ],
        },
      ],
    },
    {
      id: "tasks",
      label: "Tasks & Forms",
      pages: [
        {
          id: "tasks",
          title: "Tasks, Review & Signature",
          subtitle: "Fill, Review, Approve, Sign (DocuSeal), General.",
          sections: [
            {
              heading: "My Tasks",
              body: ["Active / Completed / Rejected tiles, filter tabs, a Type filter, and a deadline calendar."],
            },
            {
              heading: "Create & Work",
              steps: [
                "Click 'Create Task' → fill title, description, type, assignee, priority, deadline, related document → Save.",
                "The assignee is notified; open the task → follow instructions → action button (Fill/Done).",
                "Status becomes 'Completed'. Discuss via task comments.",
              ],
            },
            {
              heading: "Sequential Workflow & Signing",
              body: [
                "Tasks can be chained (Fill → Review → Approve → Sign); finishing one triggers the next.",
                "A 'Sign' task: open the signature editor (DocuSeal) → draw/pick → place → Finish. To refuse: Decline + reason.",
              ],
            },
          ],
        },
        {
          id: "forms",
          title: "Digital Forms",
          subtitle: "Templates + workflow to collect structured data.",
          sections: [
            {
              heading: "Create a Template",
              body: ["Tabs: Templates / Created. Click 'New Template' then choose how to start:"],
              variant: "cards",
              list: [
                { icon: "diskette", title: "Blank Document", text: "Start empty in the editor." },
                { icon: "cloud", title: "Upload File", text: "Upload DOCX/PDF (PDF auto-converted for editing)." },
                { icon: "clipboard", title: "Form Schema Template", text: "Define form fields manually (no document)." },
              ],
              image: { src: "/createtemplate.png", caption: "Create a new template" },
            },
            {
              heading: "Create a Form & Results",
              steps: [
                "Click 'Create Form' → set Form Name, pick a Template, set Start/Due Date.",
                "Add Workflow Steps (Select user + Action; 'Add Step' for more).",
                "Click 'Create Form' → recipients get a fill task.",
                "The template owner sees all submissions in Results (exportable).",
              ],
              image: { src: "/createform.png", caption: "Create Form + Workflow Steps" },
            },
          ],
        },
      ],
    },
    {
      id: "ai",
      label: "AI & OSINT",
      pages: [
        {
          id: "doki",
          title: "DoKi, AI Assistant",
          subtitle: "A floating assistant in the bottom-right of every page.",
          sections: [
            {
              heading: "Use DoKi",
              body: ["Click the DoKi bubble → chat opens with quick suggestions: My documents, My tasks, DocLoq features, Security info, List users, Role management."],
              list: [
                "DoKi only sees data inside your organization.",
                "It refuses suspicious instructions + has a per-hour message limit.",
                "Clear the chat with the trash icon.",
              ],
              image: { src: "/doki.png", caption: "DoKi assistant" },
            },
          ],
        },
        {
          id: "ai-projects",
          title: "AI Projects",
          subtitle: "AI chat workspaces grounded in sources (documents, URLs, text), NotebookLM-style.",
          sections: [
            {
              heading: "Create a Project & Add Sources",
              variant: "steps-boxed",
              steps: [
                "Open 'AI Projects' → 'New Project' → set Name, Description, AI Instructions (optional).",
                "In the workspace click 'Add Source': From Document (needs AI access), From URL (article/YouTube), or From Text.",
                "Grant AI access: open document → AI Access → read warning → 'Grant AI Access' (revocable).",
                "Chat (Cmd/Ctrl + Enter). Answers cite sources [1], [2]; click to jump to that source and see the quoted passage.",
              ],
              shots: [
                { src: "/aiprojpage.png", caption: "AI Projects page" },
                { src: "/insideproject.png", caption: "Workspace + source citations" },
                { src: "/adddocumentforanalyze.png", caption: "Add a document source" },
                { src: "/aisourcetypes.png", caption: "Accepted source types" },
              ],
            },
            {
              heading: "Studio & Notes",
              body: ["From the Studio panel, turn your sources into a polished output: Report, Slides, Mind Map, or Infographic (some include an AI-generated cover image); outputs are saved to the project. Manage Notes from the side panel; open Instructions & Insight from the settings (gear) icon."],
            },
            {
              heading: "Limits",
              body: ["Up to 20 projects per org, 10 sources per project, and 50 messages per project per 24h."],
            },
          ],
        },
        {
          id: "osint",
          title: "OSINT Tracker",
          subtitle: "Document leak monitoring.",
          sections: [
            {
              heading: "Enable Tracking & Monitor",
              steps: [
                "In a document's details, the owner or creator turns on 'OSINT Tracking'.",
                "Once on, every download carries a unique code → a leaked copy traces to the exact download.",
                "The Monitor tab shows a visual summary: Tracking Funnel (docs → downloads → leaks → traced users), Detection Breakdown by type, and an auto-scan status radar.",
                "The Leaks tab lists detected leaks (filterable by type); the Check Document tab runs an on-demand web search for a document's canary code.",
                "The Scan Watermark tab: upload a suspected leaked file to identify the downloader from its invisible watermark.",
              ],
              callout: { tone: "info", title: "Note", text: "Public-web search needs a provider (Google CSE / Serper) configured by an admin; without it the Check Document tab finds no hits." },
            },
          ],
        },
      ],
    },
    {
      id: "account",
      label: "Account & Settings",
      pages: [
        {
          id: "settings",
          title: "Settings",
          subtitle: "Profile, User Management, Departments, Security, Notifications, Company.",
          sections: [
            {
              heading: "Profile & Security",
              steps: [
                "Profile: edit name, Email, Phone, Department, Position → Save Changes.",
                "Security → Change Password: current → new → confirm (min 8).",
                "Two-Factor Authentication: OPTIONAL, 'Enable 2FA' (Google Authenticator). Strongly recommended.",
                "Active Sessions: each device + IP; sign out one or 'Sign out other devices'.",
              ],
            },
            {
              heading: "Users, Departments & Company (admin/owner)",
              list: [
                "User Management: Add User (name, email, password min 8, phone, department, Role: Admin/User, position); deactivate/delete.",
                "Departments: Add Department (name, description, color).",
                "Company: name + COMPANY CODE (unique tenant id) to invite teammates; Set Up Company Profile.",
                "Notifications: toggle Email, Document Updates, Task Reminders, Security Alerts.",
              ],
              shots: [
                { src: "/addusermodal.png", caption: "Add a user" },
                { src: "/adddepartmentmodal.png", caption: "Add a department" },
              ],
            },
          ],
        },
        {
          id: "roles",
          title: "Roles & Custom Roles",
          subtitle: "Account roles: Owner / Admin / User. Plus granular custom roles.",
          sections: [
            {
              heading: "Account Roles",
              variant: "cards",
              list: [
                { icon: "key", title: "Owner", text: "Top account for the org (founder); full control." },
                { icon: "cog", title: "Admin", text: "Manages users, departments, documents, settings." },
                { icon: "phone", title: "User", text: "Day-to-day document use." },
              ],
            },
            {
              heading: "Custom Roles (Role Management)",
              steps: [
                "Open 'Role Management' → 'Create Role'.",
                "Set Role Name, Description, color.",
                "Per folder/document choose: No Access / Viewer / Editor / Admin.",
                "Assign users to the role.",
              ],
              image: { src: "/addrolemanagementmodal.png", caption: "Create Role, per folder/document permissions" },
            },
          ],
        },
        {
          id: "notifications",
          title: "Notifications",
          subtitle: "The bell in the top bar.",
          sections: [
            {
              heading: "Notification Types",
              list: [
                "A new task assigned to you (or a task update / deadline).",
                "A mention/tag of you ('@you') in a document comment.",
              ],
              image: { src: "/notifsettings.png", caption: "Notification preferences (Settings → Notifications)" },
              note: "When there's nothing new, the panel shows 'No notifications yet'.",
            },
          ],
        },
        {
          id: "trash",
          title: "Trash & Recovery",
          subtitle: "Deleted items auto-remove after 30 days.",
          sections: [
            {
              heading: "The Trash Page",
              list: [
                "Stats: Total, Documents, Templates, Expiring soon, Size.",
                "Filter All / Docs / Templates + search.",
                "Each item: a Restore icon + a Delete-permanently icon (red confirmation).",
              ],
              image: { src: "/trashpage.png", caption: "Trash page" },
              callout: { tone: "warning", text: "Permanent delete cannot be undone." },
            },
          ],
        },
        {
          id: "security-tips",
          title: "Security Tips",
          subtitle: "Safe practices for using DocLoq.",
          sections: [
            {
              heading: "Must Remember",
              list: [
                "Never share passwords / OTP codes, DocLoq will never ask.",
                "Use a unique password; enable the authenticator (stronger than email OTP).",
                "Sign out on shared computers (profile, bottom-left).",
                "Review Active Sessions and sign out unknown devices.",
                "Be suspicious of sign-ins from unknown locations, change password + contact admin.",
              ],
            },
          ],
        },
      ],
    },
  ],
};

const DOCS_CONTENT = { id: ID, en: EN };

export default DOCS_CONTENT;
