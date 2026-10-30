import "@/styles/main.css";
import App from "./App";

import React from "react";
import ReactDOM from "react-dom/client";

// A tab opened before a deploy still runs the old bundle, whose lazy chunks (pptxgenjs, the QR
// ponyfill) were replaced by new hashes, so the import 404s. Reload once to pick up the new build;
// the 30s guard stops a reload loop if the new build is broken too.
window.addEventListener("vite:preloadError", (event) => {
  let last = 0;
  try { last = Number(sessionStorage.getItem("docloq:chunkReloadAt")) || 0; } catch { /* storage blocked */ }
  if (Date.now() - last < 30_000) return;
  try { sessionStorage.setItem("docloq:chunkReloadAt", String(Date.now())); } catch { /* storage blocked */ }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);
