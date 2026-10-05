import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "@/app/routes";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { PreferencesProvider } from "@/app/providers/PreferencesProvider";
import useIdleTimeout from "@/hooks/useIdleTimeout";
import AOS from "aos";
import "aos/dist/aos.css";

function IdleTimeoutProvider({ children }) {
  useIdleTimeout();
  return children;
}

export default function App() {
  useEffect(() => {
    AOS.init({
      duration: 500,
      once: true,
      easing: "ease-out-cubic",
      disable: window.innerWidth < 768,
    });
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <PreferencesProvider>
          <IdleTimeoutProvider>
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors closeButton />
          </IdleTimeoutProvider>
        </PreferencesProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
