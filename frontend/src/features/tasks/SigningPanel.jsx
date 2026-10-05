// DocuSeal e-signing panel: initiate signing, drag-select signature area, embed form, poll status.

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DocusealForm } from "@docuseal/react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import signingService from "@/services/signing.service";
import useAuthStore from "@/app/store/auth.store";
import { useLang } from "@/app/providers/LanguageProvider";

// Configure pdf.js worker, use Vite ?url import for reliable bundling
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// idle → initiating → signing (embed) → completed | declined | error

export default function SigningPanel({ task, onComplete }) {
  const { t } = useLang();
  const [step, setStep] = useState("idle");           // idle | initiating | signing | completed | declined | error
  const [sigData, setSigData] = useState(null);        // signature record from backend
  const [formUrl, setFormUrl] = useState(null);        // DocuSeal form URL (/s/slug)
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);

  // Signature drawing itself is handled by DocuSeal, not this component.

  const [pdfPages, setPdfPages] = useState([]);        // array of { pageNum, canvas } data URLs
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);   // 0-indexed
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [sigArea, setSigArea] = useState(null);         // { x, y, w, h } as fractions 0-1
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);     // { x, y } pixel coords
  const previewRef = useRef(null);

  useEffect(() => {
    checkExistingStatus();
  }, [task?.id]);

  useEffect(() => {
    if (step === "idle" && task?.relatedDocumentId) {
      loadPdfPreview();
    }
  }, [step, task?.relatedDocumentId]);

  const loadPdfPreview = async () => {
    if (!task?.relatedDocumentId) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const token = useAuthStore.getState().accessToken;

      // Try direct file first (if it's already a PDF)
      let pdfArrayBuffer;
      const directUrl = `${apiUrl}/documents/${task.relatedDocumentId}/file`;

      console.log("[SigningPanel] Trying direct PDF load:", directUrl);
      const directRes = await fetch(directUrl, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (directRes.ok) {
        const contentType = directRes.headers.get("content-type") || "";
        const buf = await directRes.arrayBuffer();

        // Check if response starts with %PDF (valid PDF)
        const firstBytes = new Uint8Array(buf.slice(0, 5));
        const isPdf = firstBytes[0] === 0x25 && firstBytes[1] === 0x50 &&
                      firstBytes[2] === 0x44 && firstBytes[3] === 0x46;

        if (isPdf) {
          pdfArrayBuffer = buf;
          console.log("[SigningPanel] Direct file is PDF, using it");
        } else {
          // Not a PDF, convert via OnlyOffice endpoint
          console.log("[SigningPanel] Not a PDF (type:", contentType, "), converting via OnlyOffice...");
          const convertUrl = `${apiUrl}/documents/${task.relatedDocumentId}/download-as?format=pdf`;
          const convertRes = await fetch(convertUrl, {
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (!convertRes.ok) {
            throw new Error(`Conversion failed (${convertRes.status})`);
          }
          pdfArrayBuffer = await convertRes.arrayBuffer();
          console.log("[SigningPanel] Conversion successful, got", pdfArrayBuffer.byteLength, "bytes");
        }
      } else {
        throw new Error(`Failed to load document (${directRes.status})`);
      }

      const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer, verbosity: 0 }).promise;
      console.log("[SigningPanel] PDF loaded, pages:", pdf.numPages);
      setTotalPages(pdf.numPages);

      const maxPages = Math.min(pdf.numPages, 20);
      const pages = [];
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push({
          pageNum: i,
          dataUrl: canvas.toDataURL("image/jpeg", 0.85),
          width: viewport.width,
          height: viewport.height,
          aspectRatio: viewport.width / viewport.height,
        });
      }
      setPdfPages(pages);
      setCurrentPage(pages.length - 1);
      console.log("[SigningPanel] PDF preview ready,", pages.length, "pages rendered");
    } catch (err) {
      console.error("[SigningPanel] PDF preview error:", err);
      setPdfError(err.message || t("tasks.sign.previewLoadFailed"));
      setPdfPages([]);
    } finally {
      setPdfLoading(false);
    }
  };

  const checkExistingStatus = async () => {
    if (!task?.id) return;
    try {
      const res = await signingService.getSigningStatus(task.id);
      if (res.success && res.data) {
        setSigData(res.data);
        if (res.data.status === "completed") {
          setStep("completed");
        } else if (res.data.status === "declined") {
          setStep("declined");
        } else if (res.data.formUrl) {
          setFormUrl(res.data.formUrl);
          setStep("signing");
        } else if (res.data.embedSrc) {
          // Fallback to embedSrc if formUrl not available
          setFormUrl(res.data.embedSrc);
          setStep("signing");
        }
      }
    } catch {
      // No existing signing, stay idle
    }
  };

  const handleInitiateSigning = async () => {
    if (!task?.relatedDocumentId) {
      setError(t("tasks.sign.noDocument"));
      return;
    }

    setStep("initiating");
    setError(null);

    let signatureAreas;
    if (sigArea) {
      // DocuSeal pages are 1-indexed, so convert our 0-indexed currentPage.
      signatureAreas = [{
        x: sigArea.x,
        y: sigArea.y,
        w: sigArea.w,
        h: sigArea.h,
        page: currentPage + 1,
      }];
    } else {
      // Fallback: bottom-left of last page
      signatureAreas = [{ x: 0.05, y: 0.82, w: 0.35, h: 0.08, page: -1 }];
    }

    try {
      const res = await signingService.requestSigning(task.id, task.relatedDocumentId, { signatureAreas });
      if (res.success) {
        setSigData(res.data);
        const url = res.data.formUrl || res.data.embedSrc;
        if (url) {
          setFormUrl(url);
          setStep("signing");
        } else {
          setError(t("tasks.sign.noFormUrl"));
          setStep("error");
        }
      } else {
        setError(res.message || t("tasks.sign.initiateFailed"));
        setStep("error");
      }
    } catch (err) {
      console.error("Initiate signing error:", err);
      setError(err.response?.data?.message || t("tasks.sign.contactFailed"));
      setStep("error");
    }
  };

  const handleCheckStatus = async () => {
    if (!task?.id) return;
    setPolling(true);
    try {
      const res = await signingService.checkSigningStatus(task.id);
      if (res.success && res.data) {
        setSigData(res.data);
        if (res.data.status === "completed") {
          setStep("completed");
          onComplete?.();
        } else if (res.data.status === "declined") {
          setStep("declined");
        }
      }
    } catch (err) {
      console.error("Check status error:", err);
    } finally {
      setPolling(false);
    }
  };

  const handleDocusealComplete = useCallback((data) => {
    console.log("[SigningPanel] DocuSeal form completed:", data);
    handleCheckStatus();
  }, [task?.id]);

  const handleDocusealDecline = useCallback((data) => {
    console.log("[SigningPanel] DocuSeal form declined:", data);
    setStep("declined");
    setSigData((prev) => ({ ...prev, declineReason: data?.reason || t("tasks.sign.declinedByUser") }));
  }, []);

  if (step === "completed") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{t("tasks.sign.documentSigned")}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              {sigData?.completedAt ? `${t("tasks.sign.completedPrefix")} ${new Date(sigData.completedAt).toLocaleString("en-US")}` : t("tasks.sign.signatureSuccessful")}
            </p>
          </div>
        </div>

        {sigData?.signedDocumentUrl && (
          <a href={sigData.signedDocumentUrl} target="_blank" rel="noopener noreferrer"
            className="w-full px-4 py-3 rounded-xl bg-accent hover:brightness-110 text-white font-semibold transition-all flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t("tasks.sign.downloadSignedDocument")}
          </a>
        )}
      </div>
    );
  }

  if (step === "declined") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
          <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">{t("tasks.sign.signatureDeclined")}</p>
            {sigData?.declineReason && (
              <p className="text-xs text-rose-600 dark:text-rose-500">{t("tasks.sign.reasonPrefix")} {sigData.declineReason}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === "signing" && formUrl) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("tasks.sign.signBelow")}
          </p>
          <button onClick={handleCheckStatus} disabled={polling}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5">
            {polling ? (
              <div className="w-3.5 h-3.5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {t("tasks.sign.checkStatus")}
          </button>
        </div>

        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" style={{ minHeight: "500px" }}>
          <DocusealForm
            src={formUrl}
            host="cdn.docuseal.com"
            onComplete={handleDocusealComplete}
            onDecline={handleDocusealDecline}
            withDownloadButton={false}
            withSendCopyButton={false}
            sendCopyEmail={false}
          />
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
          {t("tasks.sign.autoUpdate")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20"
          >
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t("tasks.sign.selectPositionHint")}
      </p>

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t("tasks.sign.signaturePosition")}
        </p>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          {t("tasks.sign.dragHint")}
        </p>

        {pdfLoading && (
          <div className="flex items-center justify-center py-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 mx-auto border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">{t("tasks.sign.loadingPreview")}</p>
            </div>
          </div>
        )}

        {!pdfLoading && pdfPages.length > 0 && (
          <div className="space-y-2">
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden="true" />
                  {t("common.previous")}
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("tasks.sign.page")} {currentPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pdfPages.length - 1, p + 1))}
                  disabled={currentPage >= pdfPages.length - 1}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-all"
                >
                  {t("common.next")}
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            )}

            <div
              ref={previewRef}
              className="relative rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white overflow-hidden cursor-crosshair select-none"
              onMouseDown={(e) => {
                const rect = previewRef.current.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                setDragStart({ x, y });
                setIsDragging(true);
                setSigArea(null);
              }}
              onMouseMove={(e) => {
                if (!isDragging || !dragStart) return;
                const rect = previewRef.current.getBoundingClientRect();
                const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                const area = {
                  x: Math.min(dragStart.x, x),
                  y: Math.min(dragStart.y, y),
                  w: Math.abs(x - dragStart.x),
                  h: Math.abs(y - dragStart.y),
                };
                // Enforce minimum size
                if (area.w > 0.03 && area.h > 0.02) {
                  setSigArea(area);
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                const rect = previewRef.current.getBoundingClientRect();
                const x = (touch.clientX - rect.left) / rect.width;
                const y = (touch.clientY - rect.top) / rect.height;
                setDragStart({ x, y });
                setIsDragging(true);
                setSigArea(null);
              }}
              onTouchMove={(e) => {
                if (!isDragging || !dragStart) return;
                e.preventDefault();
                const touch = e.touches[0];
                const rect = previewRef.current.getBoundingClientRect();
                const x = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
                const area = {
                  x: Math.min(dragStart.x, x),
                  y: Math.min(dragStart.y, y),
                  w: Math.abs(x - dragStart.x),
                  h: Math.abs(y - dragStart.y),
                };
                if (area.w > 0.03 && area.h > 0.02) {
                  setSigArea(area);
                }
              }}
              onTouchEnd={() => setIsDragging(false)}
            >
              <img
                src={pdfPages[currentPage]?.dataUrl}
                alt={`${t("tasks.sign.page")} ${currentPage + 1}`}
                className="w-full h-auto pointer-events-none"
                draggable={false}
              />

              {sigArea && (
                <div
                  className="absolute border-2 border-brand-500 bg-brand-500/15 rounded-sm pointer-events-none flex items-center justify-center"
                  style={{
                    left: `${sigArea.x * 100}%`,
                    top: `${sigArea.y * 100}%`,
                    width: `${sigArea.w * 100}%`,
                    height: `${sigArea.h * 100}%`,
                  }}
                >
                  <div className="flex items-center gap-1 text-brand-600 dark:text-brand-400 bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    {t("tasks.sign.signature")}
                  </div>
                </div>
              )}

              {isDragging && (
                <div className="absolute inset-0 bg-brand-500/5 pointer-events-none" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sigArea ? (
                  <span className="text-brand-500 dark:text-brand-400 font-medium inline-flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    {t("tasks.sign.areaSelected")} {currentPage + 1}
                  </span>
                ) : (
                  t("tasks.sign.dragToSelect")
                )}
              </p>
              {sigArea && (
                <button
                  onClick={() => setSigArea(null)}
                  className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
                >
                  {t("tasks.sign.clearArea")}
                </button>
              )}
            </div>
          </div>
        )}

        {!pdfLoading && pdfPages.length === 0 && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium mb-1">{t("tasks.sign.previewNotAvailable")}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mb-2">
              {pdfError
                ? `${t("tasks.sign.loadFailedPrefix")} ${pdfError}`
                : t("tasks.sign.notPdf")
              }
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mb-3">
              {t("tasks.sign.bottomLeftAuto")}
            </p>
            {pdfError && (
              <button
                onClick={loadPdfPreview}
                className="text-xs font-medium text-amber-700 dark:text-amber-400 underline hover:no-underline"
              >
                {t("tasks.sign.tryAgain")}
              </button>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleInitiateSigning}
        disabled={step === "initiating"}
        className="w-full px-4 py-3 rounded-xl bg-accent hover:brightness-110 disabled:opacity-50 text-white font-semibold transition-all flex items-center justify-center gap-2"
      >
        {step === "initiating" ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )}
        {step === "initiating" ? t("tasks.sign.processing") : t("tasks.sign.startSigning")}
      </button>
    </div>
  );
}
