import { createBrowserRouter, Navigate } from "react-router-dom";

// Direct imports for stability
import LandingPage from "@/features/landing/LandingPage";
import Contact from "@/features/contact/Contact";
import Login from "@/features/auth/login";
import SuperAdminDashboard from "@/features/superadmin/SuperAdminDashboard";
import OTPVerification from "@/features/auth/OTPVerification";
import ForgotPassword from "@/features/auth/ForgotPassword";
import ResetPassword from "@/features/auth/ResetPassword";
import GoogleSuccess from "@/features/auth/google-success";
import Dashboard from "@/features/dashboard/Dashboard";
import Documents from "@/features/documents/Documents";
import Trash from "@/features/documents/Trash";
import Verification from "@/features/documents/Verification";
import FolderHierarchy from "@/features/documents/FolderHierarchy";
import Chatbot from "@/features/chatbot/Chatbot";
import RoleManagement from "@/features/roles/RoleManagement";
import OSINTTracker from "@/features/osint-tracker/OSINTTracker";
import Activity from "@/features/activity/Activity";
import Forms from "@/features/forms/Forms";
import Tasks from "@/features/tasks/Tasks";
import AIProjectsList from "@/features/ai-projects/AIProjectsList";
import AIProjectWorkspace from "@/features/ai-projects/AIProjectWorkspace";
import JoinProject from "@/features/ai-projects/JoinProject";
import Settings from "@/features/settings/Settings";
import Docs from "@/features/docs/Docs";
import SharePreview from "@/features/share/SharePreview";

// Error pages & guards
import NotFound from "@/components/errors/NotFound";
import RequirePermission from "@/app/guards/RequirePermission";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/contact", element: <Contact /> },
  { path: "/login", element: <Login /> },
  { path: "/share/:token", element: <SharePreview /> }, // public preview-only share link
  { path: "/kicawkicaw", element: <SuperAdminDashboard /> }, // hidden: super-admin dashboard (password-gated)
  { path: "/auth/google/success", element: <GoogleSuccess /> },
  { path: "/verify-otp", element: <OTPVerification /> },
  { path: "/forgot-password", element: <ForgotPassword /> }, // public password recovery
  { path: "/reset-password", element: <ResetPassword /> }, // token-gated new-password form
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/tasks", element: <Tasks /> },
  { path: "/forms", element: <Forms /> },
  { path: "/documents", element: <Documents /> },
  { path: "/folders", element: <FolderHierarchy /> },
  { path: "/trash", element: <Trash /> },
  { path: "/verify", element: <RequirePermission roles="owner"><Verification public /></RequirePermission> }, // verification is owner-only (no public access)
  { path: "/verification", element: <RequirePermission roles="owner"><Verification /></RequirePermission> },
  { path: "/ai-analysis", element: <Navigate to="/ai-projects" replace /> },
  { path: "/ai-projects", element: <AIProjectsList /> },
  // Literal 'join' before ':id', or the workspace would capture the token as an id.
  { path: "/ai-projects/join/:token", element: <JoinProject /> },
  { path: "/ai-projects/:id", element: <AIProjectWorkspace /> },
  { path: "/chatbot", element: <Chatbot /> },
  { path: "/roles", element: <RequirePermission><RoleManagement /></RequirePermission> },
  { path: "/osint-tracker", element: <RequirePermission roles="owner"><OSINTTracker /></RequirePermission> },
  { path: "/activity", element: <RequirePermission roles="owner"><Activity /></RequirePermission> },
  { path: "/settings", element: <Settings /> },
  { path: "/docs", element: <Docs /> },

  // Catch-all 404
  { path: "*", element: <NotFound /> },
]);
