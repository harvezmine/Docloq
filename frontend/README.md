# DocLoq - Document Management System

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-7.2.4-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.1.18-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Framer_Motion-12.23-FF0055?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion" />
</p>

A modern, secure document management system with blockchain verification, AI-powered assistance, and advanced security features including steganography watermarking and honey token tracking.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Running the Project](#-running-the-project)
- [Project Structure](#-project-structure)
- [Routes](#-routes)
- [Key Features Guide](#-key-features-guide)
- [Configuration](#-configuration)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

### 📁 Document Management
- **Folder Hierarchy** - Organize documents in nested folders
- **Drag & Drop Upload** - Easy file uploading with visual feedback
- **Document Preview & Editing** - View and edit documents in-app via the OnlyOffice editor/viewer
- **Version History** - Track document changes over time
- **Trash & Recovery** - Soft delete with restore capability
- **E-Signature** - Sign documents inside tasks with the signing panel (DocuSeal)
- **Share Links** - Generate public, preview-only share links (`/share/:token`)

### 🔐 Security Pipeline
- **SHA-256 Body Hash** - Cryptographic hash of document content
- **Head Hash Generation** - Hash of metadata (ID, user, timestamp)
- **Steganography Watermarking** - Invisible LSB watermarks for tracking
- **Honey Token Injection** - OSINT tracking for leak detection
- **Blockchain Verification** - Anchor document hashes on Polygon (Amoy testnet / Mainnet), pseudonymized — no PII on-chain

### 🔍 Document Verification
- **Soft File Verification** - Verify using document hash
- **Hard File Verification** - QR code scanning or document upload
- **Fuzzy Hashing (SSDEEP)** - Match scanned/physical documents
- **Similarity Scoring** - Percentage match for altered documents

### 🤖 AI Features
- **AI Assistant** - Context-aware chatbot on every page
- **AI Analysis** - Single-document Q&A and structured analysis (charts, metrics, sentiment)
- **AI Projects** - NotebookLM-style multi-source workspace: attach documents, folders, URLs
  and YouTube, chat with `[N]` citations that open a provenance modal back to the exact source.
  Share projects and invite collaborators, gate document access with a consent step
  (`GrantConsentModal`), and generate PPTX / studio outputs
- **OCR (self-hosted)** - Reads scanned PDFs and images (Tesseract, on-premise), with
  auto orientation correction and Indonesian + English support
- **Privacy-first** - Documents are blocked from AI by default; user grants access explicitly

### 📊 Additional Features
- **Dashboard Analytics** - Visual insights and statistics
- **Task Management** - Calendar-integrated task tracking
- **Forms Builder** - Create and manage digital forms
- **Role Management** - Permission-based access control
- **OSINT Tracker** - Monitor honey token activations
- **Notifications** - In-app notification center
- **Dark Mode** - Full dark/light theme support

### 🔑 Authentication & Multi-Tenancy
- **Multi-Tenant Signup** - Register a new tenant with organization + department (`RegisterTenant`)
- **2FA / OTP** - One-time-password verification on login
- **Google OAuth** - Sign in with Google
- **Idle-Timeout Auto-Logout** - Automatically signs out inactive sessions
- **Super-Admin Dashboard** - Hidden, password-gated console at `/kicawkicaw` with a
  retro CRT / terminal UI (xterm)

### 🌐 Platform & Pages
- **DoKi Assistant** - Floating, context-aware AI helper (`DokiWidget`) available across pages
- **Bilingual UI (EN / ID)** - Language switching via the i18n provider
- **Landing Page** - Marketing landing with an interactive 3D hero (three.js / Spline)
- **Settings, Docs & Contact** - In-app settings, documentation, and contact pages

---

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| **Language** | JavaScript + JSX (no TypeScript) |
| **Framework** | React 19.2 |
| **Build Tool** | Vite 7.2 (`@tailwindcss/vite`) |
| **Styling** | Tailwind CSS 4.1 (v4, CSS-first) |
| **Linting** | ESLint 9 (flat config) |
| **Routing** | React Router DOM 7.11 |
| **State Management** | Zustand 5 (`auth.store`, `featureFlags.store`) |
| **HTTP Client** | Axios 1.13 |
| **Animations** | Framer Motion 12.23 |
| **Toasts** | Sonner 2 |
| **Icons** | Lucide React |
| **Drag & Drop** | @dnd-kit (core + sortable + utilities) |
| **Charts / Data Viz** | Chart.js 4.5 + react-chartjs-2, D3 7 |
| **PPTX Export** | pptxgenjs 4 |
| **PDF Rendering** | pdfjs-dist 5.5 |
| **E-Signature** | @docuseal/react |
| **3D Landing Hero** | three, @react-three/fiber, @react-three/drei, @splinetool/react-spline |
| **Visual / Scroll FX** | @tsparticles/react, cobe, AOS, Lenis |
| **CAPTCHA** | @hcaptcha/react-hcaptcha, @marsidev/react-turnstile |
| **QR Scanning** | barcode-detector |
| **Super-Admin Terminal** | @xterm/xterm (+ addon-fit) |
| **Fonts** | @fontsource (Fraunces, JetBrains Mono, Press Start 2P, VT323) |

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| **Node.js** | 18.x or higher | `node --version` |
| **npm** | 9.x or higher | `npm --version` |
| **Git** | Latest | `git --version` |

### Recommended IDE Setup
- **VS Code** with the following extensions:
  - ESLint
  - Tailwind CSS IntelliSense
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter

---

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/Rafeejooo/Docloq-Document-Management-System.git
cd docloq/document/frontend
```

Or if you received the project as a zip file:
```bash
unzip /Docloq-Document-Management-System.zip
cd docloq/document/frontend
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages listed in `package.json`.

### Step 3: Environment Configuration (Optional)

Create a `.env` file in the `frontend` directory if you need custom configuration:

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api
```

> **Blockchain:** the frontend does NOT talk to Polygon directly. All anchoring/verification
> goes through the backend (`/api/blockchain/*`). Network, RPC, wallet, and contract address
> are configured in **backend/.env** — see backend/README.md → Blockchain Anchoring.

---

## ▶️ Running the Project

### Development Mode

Start the development server with hot-reload:

```bash
npm run dev
```

The application will be available at:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/
```

### Production Build

Create an optimized production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

### Linting

Check for code quality issues:

```bash
npm run lint
```

---

## 📂 Project Structure

```
frontend/
├── public/                          # Static assets
├── src/
│   ├── App.jsx                      # Root component
│   ├── main.jsx                     # Application entry point
│   │
│   ├── app/                         # Application core
│   │   ├── guards/                  # Route protection
│   │   │   └── RequirePermission.jsx
│   │   ├── providers/               # Context providers
│   │   │   ├── AuthProvider.jsx
│   │   │   ├── ThemeProvider.jsx
│   │   │   └── LanguageProvider.jsx # i18n (EN/ID)
│   │   ├── routes/                  # Route definitions
│   │   │   └── index.jsx
│   │   └── store/                   # Zustand stores
│   │       ├── auth.store.js
│   │       └── featureFlags.store.js
│   │
│   ├── components/                  # Cross-cutting components
│   │   ├── ai-assistant/            # AI assistant panel
│   │   │   └── AIAssistant.jsx
│   │   ├── chatbot/                 # DoKi floating assistant
│   │   │   └── DokiWidget.jsx
│   │   ├── documents/               # Shared document UI
│   │   │   └── CommentModal.jsx
│   │   ├── onlyoffice/              # OnlyOffice document editor/viewer
│   │   │   ├── OnlyOfficeEditor.jsx
│   │   │   └── OnlyOfficeSkeleton.jsx
│   │   ├── layout/                  # Layout components
│   │   │   └── DashboardLayout.jsx
│   │   ├── errors/                  # Error pages
│   │   │   ├── NotFound.jsx
│   │   │   └── AccessDenied.jsx
│   │   └── ui/                      # UI primitives + visual FX
│   │       ├── Button.jsx  Card.jsx  Input.jsx  ConfirmModal.jsx  Skeleton.jsx
│   │       ├── GlassIcon.jsx  iconRegistry.js
│   │       └── SparklesCore.jsx  RotatingGlobe.jsx  TextGenerateEffect.jsx  ...
│   │
│   ├── features/                    # Feature modules
│   │   ├── auth/                    # Authentication
│   │   │   ├── login.jsx
│   │   │   ├── RegisterTenant.jsx   # Multi-tenant signup
│   │   │   ├── OTPVerification.jsx  # 2FA / OTP
│   │   │   └── google-success.jsx   # Google OAuth callback
│   │   ├── ai-projects/             # NotebookLM-style AI workspace
│   │   │   ├── AIProjectsList.jsx
│   │   │   ├── AIProjectWorkspace.jsx
│   │   │   ├── JoinProject.jsx
│   │   │   ├── components/          # SourcesPanel, ChatPanel, StudioPanel,
│   │   │   │                        #   OutputsTab, CitationMarker, ProvenanceModal,
│   │   │   │                        #   ShareProjectModal, GrantConsentModal, Add*Modal, ...
│   │   │   └── hooks/usePolling.js
│   │   ├── documents/               # Document management
│   │   │   ├── Documents.jsx        # Main documents page
│   │   │   ├── FolderHierarchy.jsx
│   │   │   ├── Trash.jsx
│   │   │   ├── Verification.jsx
│   │   │   ├── ShareModal.jsx
│   │   │   ├── qrScan.util.js
│   │   │   └── useQrScanner.js
│   │   ├── dashboard/               # Main dashboard
│   │   │   └── Dashboard.jsx
│   │   ├── tasks/                   # Task management
│   │   │   ├── Tasks.jsx
│   │   │   ├── SigningPanel.jsx     # E-signature (DocuSeal)
│   │   │   └── TaskDocumentPreview.jsx
│   │   ├── forms/                   # Forms builder
│   │   │   └── Forms.jsx
│   │   ├── roles/                   # Role & permission management
│   │   │   └── RoleManagement.jsx
│   │   ├── osint-tracker/           # OSINT / honey token monitoring
│   │   │   ├── OSINTTracker.jsx
│   │   │   ├── components/          # ScanRadar, DetectionDonut, TrackingFunnel, ...
│   │   │   └── lib/osint-metrics.js
│   │   ├── superadmin/              # Super-admin dashboard (CRT/terminal UI)
│   │   │   ├── SuperAdminDashboard.jsx
│   │   │   └── ui/                  # terminal.jsx, viz.jsx, crt-hooks.js
│   │   ├── settings/  Settings.jsx
│   │   ├── chatbot/   Chatbot.jsx
│   │   ├── docs/      Docs.jsx  content.js
│   │   ├── contact/   Contact.jsx
│   │   ├── share/     SharePreview.jsx      # Public preview-only share link
│   │   └── landing/                 # Landing page + 3D hero
│   │       ├── LandingPage.jsx  LandingBackdrop.jsx  SmoothScrollProvider.jsx
│   │       ├── hero/               # HeroSection, HeroScene3D, Hero3DFallback, Preloader, ...
│   │       └── components/         # FeatureBento, SectionLabel, SecurityMarquee
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── useDebounce.js
│   │   └── useIdleTimeout.js        # Idle-timeout auto-logout
│   ├── services/                    # API services (~24 files)
│   │   ├── api.js                   # Axios instance / interceptors
│   │   ├── auth.service.js  document.service.js  folder.service.js  trash.service.js
│   │   ├── share.service.js  task.service.js  signing.service.js  form.service.js
│   │   ├── role.service.js  user.service.js  department.service.js  organization.service.js
│   │   ├── dashboard.service.js  ai-analysis.service.js  ai-project.service.js
│   │   ├── chatbot.service.js  osint.service.js  verification.service.js
│   │   ├── watermark-scanner.service.js  blockchain.service.js  notification.service.js
│   │   ├── totp.service.js  superadmin.service.js
│   │   └── ...
│   └── styles/                      # Global styles
│       └── main.css
│
├── index.html                       # HTML template
├── package.json                     # Dependencies
├── vite.config.js                   # Vite configuration (+ @tailwindcss/vite)
├── tailwind.config.js               # Tailwind configuration
├── postcss.config.js                # PostCSS configuration
└── eslint.config.js                 # ESLint flat config
```

---

## 🗺 Routes

Defined in `src/app/routes/index.jsx`.

| Path | Page | Notes |
|------|------|-------|
| `/` | Landing | 3D hero landing page |
| `/contact` | Contact | Public contact page |
| `/login` | Login | 2FA/OTP + Google OAuth |
| `/share/:token` | Share Preview | Public, preview-only share link |
| `/kicawkicaw` | Super-Admin | Hidden, password-gated CRT/terminal dashboard |
| `/auth/google/success` | Google OAuth callback | |
| `/verify-otp` | OTP Verification | |
| `/dashboard` | Dashboard | |
| `/tasks` | Tasks | Includes e-signature panel |
| `/forms` | Forms | |
| `/documents` | Documents | |
| `/folders` | Folder Hierarchy | |
| `/trash` | Trash | |
| `/verify` | Verification | Public (no auth guard) |
| `/verification` | Verification | Authenticated |
| `/ai-analysis` | → redirects to `/ai-projects` | |
| `/ai-projects` | AI Projects List | |
| `/ai-projects/join/:token` | Join Project | Invite link |
| `/ai-projects/:id` | AI Project Workspace | |
| `/chatbot` | Chatbot | |
| `/roles` | Role Management | Permission-gated (`RequirePermission`) |
| `/osint-tracker` | OSINT Tracker | |
| `/settings` | Settings | |
| `/docs` | Docs | |
| `*` | Not Found | 404 catch-all |

---

## 📖 Key Features Guide

### Document Upload Process

When uploading a document, the system performs:

1. **File Selection** - Choose files via drag-and-drop or file picker
2. **Validation** - Magic-byte check + malware scan; dangerous types (exe/bat/sh/dll/…) rejected
3. **Content Extraction** - Parse text per format; scanned PDFs and images go through OCR
4. **Body Hash (SHA-256)** - Generate hash of document body
5. **Head Hash** - Generate hash of metadata (ID + User + Timestamp)
6. **Steganography Watermark** - Embed invisible tracking watermark using LSB
7. **Honey Token** - Inject tracking token for OSINT leak detection
8. **Blockchain Save** (Optional) - Anchor hash on Polygon (Amoy testnet / Mainnet), pseudonymized — no PII on-chain

**Supported file types:** PDF (incl. scanned → OCR), DOCX/DOC, ODT, RTF, XLSX/XLS/ODS,
PPTX/PPT/ODP, PNG/JPEG/WebP/TIFF/BMP (→ OCR), TXT/CSV/Markdown. The same allow/block list
governs both regular upload and AI Project sources.

### Document Verification

Two verification methods are available:

#### Soft File (Hash Verification)
- Enter document's SHA-256 hash
- System checks if hash exists on blockchain
- Returns document info if verified

#### Hard File (Physical Document)
- **QR Scan** - Scan QR code embedded in document
- **Upload** - Upload scanned copy
- Uses SSDEEP fuzzy hashing for similarity matching
- Returns percentage match score

### Theme Configuration

The app supports dark/light mode. Theme preference is persisted in localStorage.

---

## ⚙️ Configuration

### Tailwind CSS

Custom theme colors are defined in `tailwind.config.js`:
- **Primary**: Indigo shades
- **Neutral**: Slate shades

### Vite Aliases

Path aliases are configured in `vite.config.js`:

```javascript
resolve: {
  alias: {
    '@': '/src'
  }
}
```

Use `@/` to import from the src directory:
```javascript
import Button from '@/components/ui/Button';
```

---

## 🤝 Contributing

### Getting Started

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Commit with descriptive messages**
   ```bash
   git commit -m "feat: add new verification method"
   ```
5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request**

### Commit Convention

We follow conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### Code Style

- Use functional components with hooks
- Follow the existing file structure
- Use Tailwind CSS for styling
- Add Framer Motion animations for interactive elements
- Maintain dark mode compatibility

---

## 🔧 Troubleshooting

### Common Issues

#### Node modules not found
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Port already in use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
# Or use a different port
npm run dev -- --port 3000
```

#### Tailwind styles not applying
```bash
# Rebuild Tailwind
npm run build
npm run dev
```

#### ESLint errors
```bash
# Auto-fix linting issues
npm run lint -- --fix
```

### Getting Help

If you encounter issues:
1. Check the browser console for errors
2. Ensure all dependencies are installed correctly
3. Verify Node.js version compatibility
4. Check the GitHub Issues for known problems

---

## 📄 License

This project is part of a capstone project. All rights reserved.

---

## 👥 Team

- **Project Lead**: [Your Name]
- **Contributors**: [Collaborator Names]

---

<p align="center">
  Made with ❤️ using React + Vite + Tailwind CSS
</p>
