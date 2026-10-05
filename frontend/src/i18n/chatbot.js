// Chatbot / DoKi feature strings. Key prefix: chatbot.*
// Leaf shape: { id, en }. Reuse common.* for generic words.

export default {
  clearHistory: { id: "Hapus riwayat", en: "Clear history" },
  loadingDoki: { id: "Memuat DoKi…", en: "Loading DoKi…" },
  tagline: { id: "Document Knowledge Intelligence", en: "Document Knowledge Intelligence" },
  greeting: { id: "Hai", en: "Hi" },

  // Full-page empty-state intro (wraps a <strong>DoKi</strong>)
  intro: {
    pre: { id: "Saya ", en: "I'm " },
    post: {
      id: ", Document Knowledge Intelligence. Tanya apa saja soal dokumen dan fitur DocLoq.",
      en: ", Document Knowledge Intelligence. Ask anything about your documents and DocLoq features.",
    },
  },

  // Floating widget empty-state intro (single line)
  introWidget: {
    id: "Saya DoKi, asisten DocLoq kamu. Tanya apa saja soal dokumen & fitur DocLoq.",
    en: "I'm DoKi, your DocLoq assistant. Ask anything about your documents & DocLoq features.",
  },

  inputPlaceholder: { id: "Tanya DoKi soal DocLoq…", en: "Ask DoKi about DocLoq…" },
  openWidget: { id: "Buka DoKi", en: "Open DoKi" },
  closeWidget: { id: "Tutup DoKi", en: "Close DoKi" },
  footer: {
    id: "DoKi hanya menjawab seputar DocLoq • Ditenagai AI",
    en: "DoKi only answers about DocLoq • Powered by AI",
  },

  // Structured result cards
  cards: {
    showMorePrefix: { id: "Tampilkan", en: "Show" },
    showMoreSuffix: { id: "lagi", en: "more" },
    showLess: { id: "Tampilkan lebih sedikit", en: "Show less" },
    docActive: { id: "Aktif", en: "Active" },
    priority: {
      urgent: { id: "Urgent", en: "Urgent" },
      high: { id: "Tinggi", en: "High" },
      medium: { id: "Sedang", en: "Medium" },
      low: { id: "Rendah", en: "Low" },
    },
    status: {
      pending: { id: "Menunggu", en: "Pending" },
      in_progress: { id: "Berjalan", en: "In Progress" },
      completed: { id: "Selesai", en: "Completed" },
      cancelled: { id: "Dibatalkan", en: "Cancelled" },
    },
    due: {
      overduePre: { id: "Telat ", en: "" },
      overduePost: { id: " hari", en: " days overdue" },
      today: { id: "Hari ini", en: "Today" },
      tomorrow: { id: "Besok", en: "Tomorrow" },
      daysLeft: { id: "hari lagi", en: "days left" },
    },
  },

  // Legacy simulated AI assistant widget
  aiAssistant: {
    welcome: {
      id: "Halo! Saya Asisten AI DocLoq Anda. Saya dapat membantu Anda dengan manajemen dokumen, formulir, tugas, dan lainnya. Ada yang bisa saya bantu hari ini?",
      en: "Hello! I'm your DocLoq AI Assistant. I can help you with document management, forms, tasks, and more. How can I assist you today?",
    },
    title: { id: "Asisten AI", en: "AI Assistant" },
    status: { id: "Online • Siap membantu", en: "Online • Ready to help" },
    clearChat: { id: "Bersihkan obrolan", en: "Clear chat" },
    quickActionsTitle: { id: "Aksi cepat", en: "Quick actions" },
    inputPlaceholder: { id: "Ketik pesan Anda…", en: "Type your message..." },
    actions: {
      findDocument: { id: "Cari dokumen", en: "Find document" },
      createForm: { id: "Buat formulir", en: "Create form" },
      myTasks: { id: "Tugas saya", en: "My tasks" },
      help: { id: "Bantuan", en: "Help" },
    },
    queries: {
      findDocument: { id: "Bantu saya menemukan dokumen", en: "Help me find a document" },
      createForm: { id: "Bagaimana cara membuat template formulir baru?", en: "How do I create a new form template?" },
      myTasks: { id: "Tampilkan tugas saya yang tertunda", en: "Show me my pending tasks" },
      help: { id: "Bagaimana cara menggunakan sistem ini?", en: "How do I use this system?" },
    },
    responses: {
      document: {
        id: "Untuk menemukan dokumen, Anda dapat menggunakan halaman Dokumen dari sidebar. Anda bisa mencari berdasarkan nama, memfilter berdasarkan tanggal, atau menjelajahi folder. Apakah Anda ingin saya memandu prosesnya?",
        en: "To find a document, you can use the Documents page from the sidebar. You can search by name, filter by date, or browse folders. Would you like me to guide you through the process?",
      },
      form: {
        id: "Membuat formulir itu mudah! Buka halaman Formulir dari sidebar, klik 'Buat Formulir Baru', dan gunakan pembuat drag-and-drop kami. Anda dapat menambahkan berbagai jenis kolom dan menyimpannya sebagai template untuk digunakan nanti.",
        en: "Creating a form is easy! Go to the Forms page from the sidebar, click 'Create New Form', and use our drag-and-drop builder. You can add various field types and save as templates for future use.",
      },
      task: {
        id: "Tugas Anda tersedia di halaman Tugas. Anda dapat melihat tugas tertunda yang ditugaskan kepada Anda, termasuk tanda tangan dokumen, konfirmasi, dan pengiriman formulir. Setiap tugas memiliki prioritas dan tenggat waktu.",
        en: "Your tasks are available in the Tasks page. You can see pending tasks assigned to you, including document signatures, confirmations, and form submissions. Each task has a priority and deadline.",
      },
      default: {
        id: "Saya paham Anda menanyakan hal itu. Mari saya bantu! Anda dapat menavigasi melalui sidebar untuk mengakses berbagai fitur seperti Dokumen, Formulir, Tugas, dan lainnya. Ada sesuatu yang spesifik yang ingin Anda ketahui?",
        en: "I understand you're asking about that. Let me help you! You can navigate through the sidebar to access different features like Documents, Forms, Tasks, and more. Is there something specific you'd like to know?",
      },
    },
  },
};
