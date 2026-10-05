// Handles the OAuth redirect: reads tokens from URL hash, hydrates auth store, navigates to dashboard.
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../app/store/auth.store";
import { useLang } from "@/app/providers/LanguageProvider";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function GoogleSuccess() {
  const navigate = useNavigate();
  const processed = useRef(false);
  const { t } = useLang();

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const handle = async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("accessToken");
      const refreshToken = hash.get("refreshToken");

      // Strip hash from browser history immediately
      window.history.replaceState(null, "", window.location.pathname);

      if (!accessToken || !refreshToken) {
        navigate("/login?error=server_error", { replace: true });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          navigate("/login?error=server_error", { replace: true });
          return;
        }

        useAuthStore.getState().loginSuccess({
          user: data.data.user,
          accessToken,
          refreshToken,
        });

        navigate("/dashboard", { replace: true });
      } catch {
        navigate("/login?error=server_error", { replace: true });
      }
    };

    handle();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <svg className="w-10 h-10 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-slate-400 text-sm">{t("auth.google.completing")}</p>
      </div>
    </div>
  );
}
