// Forms feature: templates, workflow instances, modals. Key prefix: forms.*
export default {
  header: {
    eyebrow: { id: "Alur Kerja", en: "Workflow" },
    title: { id: "Formulir", en: "Forms" },
    subtitle: { id: "Buat dan kelola templat formulir serta alur kerja", en: "Create and manage form templates and workflows" },
    newTemplate: { id: "Templat Baru", en: "New Template" },
    createForm: { id: "Buat Formulir", en: "Create Form" },
  },

  sections: {
    templates: { id: "Templat", en: "Templates" },
    created: { id: "Dibuat", en: "Created" },
  },

  workflowActions: {
    fill: { id: "Isi", en: "Fill" },
    review: { id: "Tinjau", en: "Review" },
    approve: { id: "Setujui", en: "Approve" },
    sign: { id: "Tanda Tangan", en: "Sign" },
  },

  status: {
    active: { id: "Aktif", en: "Active" },
    draft: { id: "Draf", en: "Draft" },
    completed: { id: "Selesai", en: "Completed" },
    cancelled: { id: "Dibatalkan", en: "Cancelled" },
  },

  categories: {
    general: { id: "Umum", en: "General" },
    hr: { id: "SDM", en: "HR" },
    finance: { id: "Keuangan", en: "Finance" },
    legal: { id: "Hukum", en: "Legal" },
    operations: { id: "Operasional", en: "Operations" },
  },

  badge: {
    document: { id: "Dokumen", en: "Document" },
    schema: { id: "Skema", en: "Schema" },
    docx: { id: "DOCX", en: "DOCX" },
  },

  templatesEmpty: {
    title: { id: "Belum ada templat", en: "No templates yet" },
    subtitle: { id: "Buat templat formulir pertama Anda untuk memulai", en: "Create your first form template to get started" },
  },

  createdEmpty: {
    title: { id: "Belum ada formulir dibuat", en: "No forms created yet" },
    subtitle: { id: "Gunakan templat untuk membuat formulir pertama Anda", en: "Use a template to create your first form" },
  },

  card: {
    noDescription: { id: "Tidak ada deskripsi", en: "No description" },
    fields: { id: "kolom", en: "fields" },
    uses: { id: "penggunaan", en: "uses" },
    assignTask: { id: "Tetapkan Tugas", en: "Assign Task" },
    editTemplate: { id: "Ubah Templat", en: "Edit Template" },
  },

  instance: {
    basedOn: { id: "Berdasarkan", en: "Based on" },
    unknown: { id: "Tidak diketahui", en: "Unknown" },
    start: { id: "Mulai:", en: "Start:" },
    due: { id: "Tenggat:", en: "Due:" },
    stepsDone: { id: "langkah selesai", en: "steps done" },
    unassigned: { id: "Belum ditugaskan", en: "Unassigned" },
    pending: { id: "menunggu", en: "pending" },
  },

  createModal: {
    title: { id: "Buat Formulir Baru", en: "Create New Form" },
    subtitle: { id: "Atur detail formulir dan alur kerja", en: "Set up form details and workflow" },
    formName: { id: "Nama Formulir", en: "Form Name" },
    formNamePlaceholder: { id: "Masukkan nama formulir...", en: "Enter form name..." },
    template: { id: "Templat", en: "Template" },
    selectTemplate: { id: "Pilih templat...", en: "Select a template..." },
    startDate: { id: "Tanggal Mulai", en: "Start Date" },
    dueDate: { id: "Tanggal Tenggat", en: "Due Date" },
    workflowSteps: { id: "Langkah Alur Kerja", en: "Workflow Steps" },
    addStep: { id: "Tambah Langkah", en: "Add Step" },
    selectUser: { id: "Pilih pengguna...", en: "Select user..." },
    action: { id: "Tindakan...", en: "Action..." },
    noDescription: { id: "Tidak ada deskripsi", en: "No description" },
  },

  templateModal: {
    title: { id: "Templat Baru", en: "New Template" },
    subtitle: { id: "Tentukan kolom dan pengaturan formulir", en: "Define form fields and settings" },
    templateName: { id: "Nama Templat", en: "Template Name" },
    templateNamePlaceholder: { id: "mis., Orientasi Karyawan", en: "e.g., Employee Onboarding" },
    descriptionPlaceholder: { id: "Untuk apa templat ini?", en: "What is this template for?" },
    icon: { id: "Ikon", en: "Icon" },
    category: { id: "Kategori", en: "Category" },
    selectCategory: { id: "Pilih kategori...", en: "Select category..." },
    formFields: { id: "Kolom Formulir", en: "Form Fields" },
    addField: { id: "Tambah Kolom", en: "Add Field" },
    fieldLabel: { id: "Label kolom", en: "Field label" },
    req: { id: "Wajib", en: "Req" },
    createTemplate: { id: "Buat Templat", en: "Create Template" },
    fieldTypes: {
      text: { id: "Teks", en: "Text" },
      email: { id: "Email", en: "Email" },
      number: { id: "Angka", en: "Number" },
      date: { id: "Tanggal", en: "Date" },
      textarea: { id: "Area Teks", en: "Textarea" },
      select: { id: "Pilihan", en: "Select" },
      checkbox: { id: "Kotak Centang", en: "Checkbox" },
      file: { id: "Berkas", en: "File" },
    },
  },

  choiceModal: {
    title: { id: "Buat Templat Baru", en: "Create New Template" },
    subtitle: { id: "Pilih cara Anda ingin memulai", en: "Choose how you'd like to start" },
    blankTitle: { id: "Dokumen Kosong", en: "Blank Document" },
    blankDesc: { id: "Mulai dari awal dengan dokumen kosong. Langsung terbuka di editor.", en: "Start fresh with an empty document. Opens directly in the editor." },
    uploadTitle: { id: "Unggah Berkas", en: "Upload File" },
    uploadDesc: { id: "Unggah berkas DOCX atau PDF. PDF akan dikonversi otomatis untuk diedit.", en: "Upload a DOCX or PDF file. PDF will be auto-converted for editing." },
    or: { id: "atau", en: "or" },
    schemaTitle: { id: "Templat Skema Formulir", en: "Form Schema Template" },
    schemaDesc: { id: "Tentukan kolom formulir secara manual (tanpa dokumen)", en: "Define form fields manually (no document)" },
    creatingBlank: { id: "Membuat templat kosong...", en: "Creating blank template..." },
  },

  uploadModal: {
    title: { id: "Unggah Templat", en: "Upload Template" },
    subtitle: { id: "Unggah berkas DOCX atau PDF sebagai templat", en: "Upload a DOCX or PDF file as template" },
    willConvert: { id: "Akan dikonversi ke DOCX", en: "Will convert to DOCX" },
    fileReady: { id: "Berkas siap diunggah", en: "File ready to upload" },
    dropzone: { id: "Klik untuk telusuri atau seret & lepas", en: "Click to browse or drag & drop" },
    dropzoneHint: { id: "Mendukung DOCX, PDF, DOC, ODT (maks 50MB)", en: "Supports DOCX, PDF, DOC, ODT (max 50MB)" },
    templateName: { id: "Nama Templat", en: "Template Name" },
    templateNamePlaceholder: { id: "Terisi otomatis dari nama berkas", en: "Auto-filled from filename" },
    optional: { id: "(opsional)", en: "(optional)" },
    descriptionPlaceholder: { id: "Untuk apa templat ini?", en: "What is this template for?" },
    converting: { id: "Mengonversi...", en: "Converting..." },
    uploading: { id: "Mengunggah...", en: "Uploading..." },
    uploadTemplate: { id: "Unggah Templat", en: "Upload Template" },
  },

  settingsModal: {
    title: { id: "Templat Dibuat!", en: "Template Created!" },
    subtitle: { id: "Konfigurasi pengaturan templat sebelum Anda mulai", en: "Configure your template settings before you start" },
    templateName: { id: "Nama Templat", en: "Template Name" },
    templateNamePlaceholder: { id: "Masukkan nama templat...", en: "Enter template name..." },
    optional: { id: "(opsional)", en: "(optional)" },
    descriptionPlaceholder: { id: "Untuk apa templat ini?", en: "What is this template for?" },
    storeInFolder: { id: "Simpan di Folder", en: "Store in Folder" },
    rootNoFolder: { id: "Akar (tanpa folder)", en: "Root (no folder)" },
    selectFolder: { id: "Pilih folder...", en: "Select folder..." },
    notes: { id: "Catatan", en: "Notes" },
    notesPlaceholder: { id: "Catatan internal tentang templat ini...", en: "Internal notes about this template..." },
    saveAndClose: { id: "Simpan & Tutup", en: "Save & Close" },
    continueEditing: { id: "Lanjut Mengedit", en: "Continue Editing" },
  },

  detailModal: {
    noDescription: { id: "Tidak ada deskripsi", en: "No description" },
    uses: { id: "penggunaan", en: "uses" },
    editDocumentTitle: { id: "Edit Dokumen", en: "Edit Document" },
    editDocumentDesc: { id: "Buka di editor untuk mengubah konten", en: "Open in editor to modify content" },
    viewDocumentTitle: { id: "Lihat Dokumen", en: "View Document" },
    viewDocumentDesc: { id: "Buka pratinjau baca-saja", en: "Open read-only preview" },
    editMetaTitle: { id: "Edit Metadata", en: "Edit Metadata" },
    editMetaDesc: { id: "Ubah nama, deskripsi, kategori", en: "Change name, description, category" },
    assignTaskTitle: { id: "Tetapkan Tugas", en: "Assign Task" },
    assignTaskDesc: { id: "Buat formulir baru dan tetapkan ke pengguna", en: "Create a new form and assign to users" },
  },

  editMetaModal: {
    title: { id: "Edit Templat", en: "Edit Template" },
    subtitle: { id: "Perbarui detail templat", en: "Update template details" },
    templateName: { id: "Nama Templat", en: "Template Name" },
    descriptionPlaceholder: { id: "Untuk apa templat ini?", en: "What is this template for?" },
    saveChanges: { id: "Simpan Perubahan", en: "Save Changes" },
  },

  deleteModal: {
    deleteTemplate: { id: "Hapus Templat?", en: "Delete Template?" },
    deleteForm: { id: "Hapus Formulir?", en: "Delete Form?" },
    confirmText: { id: "Yakin ingin menghapus", en: "Are you sure you want to delete" },
    cannotUndo: { id: "Tindakan ini tidak dapat dibatalkan.", en: "This action cannot be undone." },
    thisForm: { id: "formulir ini", en: "this form" },
    thisTemplate: { id: "templat ini", en: "this template" },
  },
};
