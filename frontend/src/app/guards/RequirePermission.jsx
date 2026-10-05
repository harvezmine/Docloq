import { Navigate } from "react-router-dom";
import useAuthStore from "@/app/store/auth.store";
import AccessDenied from "@/components/errors/AccessDenied";

// Wraps role-restricted page elements; renders AccessDenied if user.role isn't in `roles`.
export default function RequirePermission({ children, roles = ["owner", "admin"] }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Not logged in → send to login (never leave a role-gated route as a blank page).
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  const allowed =
    typeof roles === "string"
      ? user.role === roles
      : Array.isArray(roles) && roles.includes(user.role);

  if (!allowed) return <AccessDenied />;

  return children;
}
